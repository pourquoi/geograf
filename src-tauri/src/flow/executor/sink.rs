use std::{collections::HashMap, fs::File};

use async_trait::async_trait;
use polars::prelude::*;
use tokio::sync::mpsc;

use crate::{
    flow::{
        executor::{
            NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
            NodeExecutorOptions,
        },
        node::{DataFormat, SinkNodeData},
        reader::{NodeReader, NodeReaderOptions},
        Node, DEFAULT_INPUT, DEFAULT_OUTPUT,
    },
    AppState,
};

pub struct SinkNodeExecutor {
    node: Box<Node>,
    dest: String,
    format: DataFormat,
    limit: Option<u32>,
    cache: bool,
}

impl SinkNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: SinkNodeData = serde_json::from_value(
            node.data
                .as_ref()
                .ok_or(NodeExecutionError::NodeConfigInvalid {
                    node_id: node.id.clone(),
                    message: "missing data".into(),
                    source: None,
                })?
                .clone(),
        )
        .map_err(|e| NodeExecutionError::NodeConfigInvalid {
            node_id: node.id.clone(),
            message: e.to_string(),
            source: Some(Arc::new(e)),
        })?;

        Ok(Self {
            node: Box::new(node.clone()),
            dest: data.dest,
            format: data.format,
            limit: data.limit,
            cache: true,
        })
    }
}

#[async_trait]
impl NodeExecutor for SinkNodeExecutor {
    async fn load_cached(
        &self,
        state: Arc<AppState>,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Option<super::OutputMap> {
        if !self.cache {
            return None;
        }

        let read_options = NodeReaderOptions {
            page_size: self.limit.unwrap_or(100),
            ..Default::default()
        };

        let df = self.node.load_lf(state, &read_options).await.ok();

        if let Some(df) = df {
            let msg = NodeExecutionMessage::Log {
                node_id: self.node.id.clone(),
                run_id: options.run_id.clone(),
                ts: options.run_start.elapsed().as_micros(),
                message: format!("using stored {}", self.dest),
            };
            _ = tx.send(msg).await;

            Some(HashMap::from([(
                DEFAULT_OUTPUT.to_string(),
                NodeExecutionOutput::success(df),
            )]))
        } else {
            let msg = NodeExecutionMessage::Log {
                node_id: self.node.id.clone(),
                run_id: options.run_id.clone(),
                ts: options.run_start.elapsed().as_micros(),
                message: format!("cache not found {}", self.dest),
            };
            _ = tx.send(msg).await;

            None
        }
    }

    async fn execute(
        &self,
        _state: Arc<AppState>,
        inputs: &super::InputMap,
        _options: Arc<NodeExecutorOptions>,
        _tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Result<super::OutputMap, NodeExecutionError> {
        let input = inputs
            .get(DEFAULT_INPUT)
            .ok_or_else(|| NodeExecutionError::InputNotFound {
                node_id: self.node.id.clone(),
                port: DEFAULT_INPUT.to_string(),
            })?;
        let mut df = input
            .df
            .as_ref()
            .ok_or_else(|| NodeExecutionError::InputDataEmpty {
                node_id: self.node.id.clone(),
            })?
            .clone();

        if let Some(limit) = self.limit {
            if limit > 0 {
                df = df.limit(limit);
            }
        }

        // todo: lazy writer
        match &self.format {
            DataFormat::Csv { comma_delimiter } => {
                let df = df.clone();
                let df_out = tokio::task::spawn_blocking(move || {
                    df.clone()
                        .collect()
                        .map_err(NodeExecutionError::PolarsError)
                })
                .await
                .map_err(|e| NodeExecutionError::Custom(e.to_string()))?;

                let mut df_out = df_out?;

                let mut file =
                    File::create(self.dest.clone()).map_err(|e| NodeExecutionError::IoError {
                        node_id: self.node.id.clone(),
                        message: e.to_string(),
                    })?;

                CsvWriter::new(&mut file)
                    .include_header(true)
                    .with_separator(if *comma_delimiter { b',' } else { b';' })
                    .finish(&mut df_out)
                    .map_err(NodeExecutionError::PolarsError)?;
                df_out
            }
            format @ (DataFormat::Jsonl | DataFormat::Json) => {
                let df = df.clone();
                let df_out = tokio::task::spawn_blocking(move || {
                    df.clone()
                        .collect()
                        .map_err(NodeExecutionError::PolarsError)
                })
                .await
                .map_err(|e| NodeExecutionError::Custom(e.to_string()))?;

                let mut df_out = df_out?;

                let mut file =
                    File::create(self.dest.clone()).map_err(|e| NodeExecutionError::IoError {
                        node_id: self.node.id.clone(),
                        message: e.to_string(),
                    })?;

                JsonWriter::new(&mut file)
                    .with_json_format(match format {
                        DataFormat::Json => JsonFormat::Json,
                        DataFormat::Jsonl => JsonFormat::JsonLines,
                        _ => unreachable!(),
                    })
                    .finish(&mut df_out)
                    .map_err(NodeExecutionError::PolarsError)?;

                df_out
            }
            DataFormat::Parquet => {
                let path = PlPath::from_string(self.dest.clone());
                let df = df.clone();
                let df_out = tokio::task::spawn_blocking(move || {
                    let df = df.sink_parquet(
                        SinkTarget::Path(path),
                        ParquetWriteOptions::default(),
                        None,
                        SinkOptions::default(),
                    )?;
                    df.collect()
                })
                .await
                .map_err(|e| NodeExecutionError::Custom(e.to_string()))?
                .map_err(NodeExecutionError::PolarsError)?;

                df_out
            }
        };

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(df),
        )]))
    }
}
