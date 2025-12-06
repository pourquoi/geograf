use crate::{
    flow::{get_data_cache_path, DataFormat, Node, NodeType, SinkNodeData, SourceNodeData},
    AppState,
};
use polars::prelude::*;
use std::fs::File;
use std::sync::Arc;
use thiserror::Error;

pub trait Loader: Send + Sync {
    async fn load_lf(&self, state: Arc<AppState>) -> Option<LazyFrame>;
}

#[derive(Debug, Error)]
pub enum LoaderError {
    #[error(transparent)]
    PolarsError(#[from] PolarsError),
    #[error("{0}")]
    Custom(String),
}

impl Loader for Node {
    async fn load_lf(&self, state: Arc<AppState>) -> Option<LazyFrame> {
        let Some(node_type) = self.node_type else {
            return None;
        };

        match node_type {
            NodeType::SourceNode | NodeType::SinkNode => {}
            _ => return None,
        }

        let (source, format) = match node_type {
            NodeType::SourceNode => {
                let data: SourceNodeData = self.data_as().ok()?;
                let mut source = data.source.clone();
                if data.source.starts_with("http://") || data.source.starts_with("https://") {
                    let cache_path = get_data_cache_path(state.clone(), &data.source, &data.format);

                    if data.cache && std::fs::metadata(&cache_path).is_ok() {
                        source = cache_path;
                    } else {
                        return None;
                    }
                }
                (source, data.format)
            }
            NodeType::SinkNode => {
                let data: SinkNodeData = self.data_as().ok()?;
                (data.dest, data.format)
            }
            _ => return None,
        };

        load_local_lf(&source, &format).ok()
    }
}

pub fn load_local_lf(source: &str, format: &DataFormat) -> Result<LazyFrame, LoaderError> {
    match format {
        DataFormat::Csv { comma_delimiter } => {
            let path = PlPath::from_str(source);

            let df = LazyCsvReader::new(path)
                .with_has_header(true)
                .with_separator(if *comma_delimiter { b',' } else { b';' })
                .with_truncate_ragged_lines(true)
                .with_encoding(CsvEncoding::LossyUtf8)
                .with_infer_schema_length(Some(1000))
                .with_ignore_errors(true)
                .finish()?;

            Ok(df)
        }
        DataFormat::Json => {
            let file = File::open(source).map_err(|e| LoaderError::Custom(e.to_string()))?;

            let df = JsonReader::new(file)
                .finish()
                .map_err(|e| LoaderError::Custom(e.to_string()))?;
            let df = df.lazy();

            Ok(df)
        }
        DataFormat::Jsonl => {
            let path = PlPath::from_str(source);

            let df = LazyJsonLineReader::new(path)
                .with_infer_schema_length(Some(1000.try_into().unwrap()))
                .with_ignore_errors(true)
                .finish()?;

            Ok(df)
        }
        DataFormat::Parquet => {
            let path = PlPath::from_str(source);

            let df = LazyFrame::scan_parquet(path, Default::default())?;

            Ok(df)
        }
    }
}
