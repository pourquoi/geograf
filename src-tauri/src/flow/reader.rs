use std::io::Cursor;

use crate::{
    expressions::{ast_to_expr, parse_program, ExpressionError},
    flow::{
        node::{get_data_cache_path, DataFormat, NodeType, SinkNodeData, SourceNodeData},
        Node, DEFAULT_OUTPUT,
    },
    AppState,
};
use polars::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::sync::Arc;
use thiserror::Error;
use ts_rs::TS;

pub trait NodeReader: Send + Sync {
    async fn load_lf(
        &self,
        state: Arc<AppState>,
        options: &NodeReaderOptions,
    ) -> Result<LazyFrame, NodeReadError>;
}

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct NodeReaderOptions {
    pub output: String,
    pub page: u32,
    pub page_size: u32,
    pub select: Option<Vec<String>>,
    #[serde(default)]
    pub append: bool,
    pub filter: Option<String>,
    pub sort: Option<Vec<(String, bool)>>,
}

impl Default for NodeReaderOptions {
    fn default() -> Self {
        Self {
            output: DEFAULT_OUTPUT.to_string(),
            page: 1,
            page_size: 100,
            select: None,
            filter: None,
            sort: None,
            append: false,
        }
    }
}

#[derive(Debug, Error)]
pub enum NodeReadError {
    #[error("Invalid configuration in node '{node_id}': {message}")]
    NodeConfigInvalid { node_id: String, message: String },
    #[error("Node type does not support reading data for node '{node_id}'")]
    NodeTypeInvalid { node_id: String },
    #[error(transparent)]
    PolarsError(#[from] PolarsError),
    #[error(transparent)]
    InvalidQuery(#[from] ExpressionError),
    #[error("{0}")]
    Custom(String),
}

#[derive(Clone, Debug, Serialize, TS, Default)]
#[ts(export)]
pub struct NodeReadOutput {
    #[ts(type = "any")]
    pub data: Option<Box<serde_json::value::RawValue>>,
    pub total: u32,
    #[ts(type = "{name: string, dtype: string}[] | null")]
    pub columns: Option<Vec<NodeReadColumn>>,
    pub options: NodeReaderOptions,
}

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export)]
pub struct NodeReadColumn {
    name: String,
    dtype: String,
}

impl NodeReadOutput {
    pub async fn try_from_df(
        df: LazyFrame,
        options: &NodeReaderOptions,
    ) -> Result<Self, NodeReadError> {
        let select = if let Some(ref select) = options.select {
            let mut asts: Vec<_> = vec![];
            for expr in select.iter().filter(|s| !s.is_empty()) {
                let ast = parse_program(expr).map_err(NodeReadError::InvalidQuery)?;
                asts.push(ast);
            }

            let mut exprs: Vec<_> = vec![];
            for ast in asts.iter() {
                let expr = ast_to_expr(ast).map_err(NodeReadError::InvalidQuery)?;
                exprs.push(expr);
            }

            if exprs.is_empty() {
                None
            } else {
                Some(exprs)
            }
        } else {
            None
        };

        let filter = if let Some(ref filter) = options.filter {
            if filter.is_empty() {
                None
            } else {
                let ast = parse_program(filter).map_err(NodeReadError::InvalidQuery)?;
                let expr = ast_to_expr(&ast).map_err(NodeReadError::InvalidQuery)?;
                Some(expr)
            }
        } else {
            None
        };

        let (data, total, schema) = tokio::task::spawn_blocking({
            let options = options.clone();
            move || {
                let total = df.clone().count().collect()?;
                let total = total[0].u32()?.get(0).unwrap();

                let mut df = df.clone();
                if let Some(select) = select {
                    df = df.with_columns(select);
                }
                if let Some(filter) = filter {
                    df = df.filter(filter);
                }
                if let Some(sort) = options.sort {
                    let sort_columns: Vec<&str> = sort.iter().map(|s| s.0.as_str()).collect();
                    let desc_options = sort.iter().map(|s| !s.1);
                    let sort_options = SortMultipleOptions::new()
                        .with_order_descending_multi(desc_options)
                        .with_nulls_last(true);
                    df = df.sort(sort_columns, sort_options);
                }

                let mut df = df
                    .slice(
                        ((options.page - 1) * options.page_size) as i64,
                        options.page_size,
                    )
                    .collect()?;

                let schema = df
                    .schema()
                    .iter()
                    .map(|f| NodeReadColumn {
                        name: f.0.to_string(),
                        dtype: f.1.to_string(),
                    })
                    .collect();

                let data = df_to_json_bytes(&mut df)?;

                Ok((data, total, schema))
            }
        })
        .await
        .unwrap()
        .map_err(NodeReadError::PolarsError)?;

        let data =
            serde_json::value::RawValue::from_string(String::from_utf8_lossy(&data).to_string())
                .map_err(|e| NodeReadError::Custom(e.to_string()))?;
        let data = Some(data);

        Ok(NodeReadOutput {
            data,
            total,
            columns: Some(schema),
            options: options.clone(),
        })
    }
}

impl NodeReader for Node {
    async fn load_lf(
        &self,
        state: Arc<AppState>,
        _options: &NodeReaderOptions,
    ) -> Result<LazyFrame, NodeReadError> {
        let Some(node_type) = self.node_type else {
            return Err(NodeReadError::NodeTypeInvalid {
                node_id: self.id.clone(),
            });
        };

        match node_type {
            NodeType::SourceNode | NodeType::SinkNode => {}
            _ => {
                return Err(NodeReadError::NodeTypeInvalid {
                    node_id: self.id.clone(),
                })
            }
        }

        let (source, format) = match node_type {
            NodeType::SourceNode => {
                let data: SourceNodeData =
                    self.data_as()
                        .map_err(|e| NodeReadError::NodeConfigInvalid {
                            node_id: self.id.clone(),
                            message: e.to_string(),
                        })?;
                // todo: refactor (see executor::source, executor::sink)
                let mut source = data.source.clone();
                if data.source.starts_with("http://") || data.source.starts_with("https://") {
                    let cache_path = get_data_cache_path(state.clone(), &data.source, &data.format);

                    if data.cache && std::fs::metadata(&cache_path).is_ok() {
                        source = cache_path;
                    }
                }
                (source, data.format)
            }
            NodeType::SinkNode => {
                let data: SinkNodeData =
                    self.data_as()
                        .map_err(|e| NodeReadError::NodeConfigInvalid {
                            node_id: self.id.clone(),
                            message: e.to_string(),
                        })?;
                (data.dest, data.format)
            }
            _ => {
                return Err(NodeReadError::NodeTypeInvalid {
                    node_id: self.id.clone(),
                })
            }
        };

        match format {
            DataFormat::Csv { comma_delimiter } => {
                let path = PlPath::from_string(source.clone());

                // todo: pull from options
                let df = LazyCsvReader::new(path)
                    .with_has_header(true)
                    .with_separator(if comma_delimiter { b',' } else { b';' })
                    .with_truncate_ragged_lines(true)
                    .with_encoding(CsvEncoding::LossyUtf8)
                    .with_infer_schema_length(Some(1000))
                    .with_ignore_errors(true)
                    .finish()
                    .map_err(NodeReadError::PolarsError)?;

                Ok(df)
            }
            DataFormat::Json => {
                let file =
                    File::open(source.clone()).map_err(|e| NodeReadError::Custom(e.to_string()))?;

                let df = JsonReader::new(file)
                    .finish()
                    .map_err(|e| NodeReadError::Custom(e.to_string()))?;
                let df = df.lazy();

                Ok(df)
            }
            DataFormat::Jsonl => {
                let path = PlPath::from_string(source.clone());

                let df = LazyJsonLineReader::new(path)
                    .with_infer_schema_length(Some(1000.try_into().unwrap()))
                    .with_ignore_errors(true)
                    .finish()
                    .map_err(NodeReadError::PolarsError)?;

                Ok(df)
            }
            DataFormat::Parquet => {
                let path = PlPath::from_string(source.clone());

                let df = LazyFrame::scan_parquet(path, Default::default())
                    .map_err(NodeReadError::PolarsError)?;

                Ok(df)
            }
        }
    }
}

pub fn df_to_json_bytes(df: &mut DataFrame) -> PolarsResult<Vec<u8>> {
    let mut buf = Vec::new();
    {
        let mut cursor = Cursor::new(&mut buf);

        let mut writer = JsonWriter::new(&mut cursor).with_json_format(JsonFormat::Json);

        writer.finish(df)?;
    }

    Ok(buf)
}
