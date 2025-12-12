use crate::loader::{load_local_lf, Loader};
use std::{collections::HashMap, fs::File};

use async_trait::async_trait;
use polars::prelude::*;
use tokio::sync::mpsc;

use crate::{
    executor::{
        NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
        NodeExecutorOptions,
    },
    flow::{DataFormat, Node, SinkNodeData, DEFAULT_INPUT, DEFAULT_OUTPUT},
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
            dest: data.dest.clone(),
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
        is_last: bool,
    ) -> Option<super::OutputMap> {
        if !self.cache || is_last {
            return None;
        }
        let lf = self.node.load_lf(state).await;

        if let Some(lf) = lf {
            let msg = NodeExecutionMessage::Log {
                node_id: self.node.id.clone(),
                run_id: options.run_id.clone(),
                ts: options.run_start.elapsed().as_micros(),
                message: format!("using cache"),
            };
            _ = tx.send(msg).await;

            Some(HashMap::from([(
                DEFAULT_OUTPUT.to_string(),
                NodeExecutionOutput::success(lf),
            )]))
        } else {
            None
        }
    }

    async fn execute(
        &self,
        state: Arc<AppState>,
        inputs: &super::InputMap,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Result<super::OutputMap, NodeExecutionError> {
        let dest: String;
        dest = format!(
            "{}/{}.{}",
            state
                .app_dir
                .as_ref()
                .unwrap()
                .clone()
                .into_os_string()
                .to_str()
                .unwrap(),
            self.node.id,
            self.format.to_string()
        );

        let input = inputs
            .get(DEFAULT_INPUT)
            .ok_or_else(|| NodeExecutionError::InputNotFound {
                node_id: self.node.id.clone(),
                port: DEFAULT_INPUT.to_string(),
            })?;
        let mut lf = input
            .df
            .as_ref()
            .ok_or_else(|| NodeExecutionError::InputDataEmpty {
                node_id: self.node.id.clone(),
            })?
            .clone();

        if let Some(limit) = self.limit {
            if limit > 0 {
                lf = lf.limit(limit);
            }
        }

        // todo: lazy writer
        match &self.format {
            DataFormat::Csv { comma_delimiter } => {
                let lf = lf.clone();
                let lf_out = tokio::task::spawn_blocking(move || lf.clone().collect())
                    .await
                    .map_err(|e| NodeExecutionError::Custom(e.to_string()))?;

                let mut lf_out = lf_out?;

                let mut file =
                    File::create(dest.clone()).map_err(|e| NodeExecutionError::IoError {
                        node_id: self.node.id.clone(),
                        message: e.to_string(),
                    })?;

                CsvWriter::new(&mut file)
                    .include_header(true)
                    .with_separator(if *comma_delimiter { b',' } else { b';' })
                    .finish(&mut lf_out)?;
                lf_out
            }
            format @ (DataFormat::Jsonl | DataFormat::Json) => {
                let lf = lf.clone();
                let lf_out = tokio::task::spawn_blocking(move || {
                    lf.clone()
                        .collect()
                        .map_err(NodeExecutionError::PolarsError)
                })
                .await
                .map_err(|e| NodeExecutionError::Custom(e.to_string()))?;

                let mut lf_out = lf_out?;

                let mut file =
                    File::create(dest.clone()).map_err(|e| NodeExecutionError::IoError {
                        node_id: self.node.id.clone(),
                        message: e.to_string(),
                    })?;

                JsonWriter::new(&mut file)
                    .with_json_format(match format {
                        DataFormat::Json => JsonFormat::Json,
                        DataFormat::Jsonl => JsonFormat::JsonLines,
                        _ => unreachable!(),
                    })
                    .finish(&mut lf_out)?;

                lf_out
            }
            DataFormat::Parquet => {
                let path = PlPath::from_string(dest.clone());
                let lf = lf.clone();
                let lf_out = tokio::task::spawn_blocking(move || {
                    let lf = lf.sink_parquet(
                        SinkTarget::Path(path),
                        ParquetWriteOptions::default(),
                        None,
                        SinkOptions::default(),
                    )?;
                    lf.collect()
                })
                .await
                .map_err(|e| NodeExecutionError::Custom(e.to_string()))??;

                lf_out
            }
        };

        _ = tx
            .send(NodeExecutionMessage::Log {
                node_id: self.node.id.clone(),
                run_id: options.run_id.clone(),
                ts: options.run_start.elapsed().as_micros(),
                message: format!("saved to {}", dest),
            })
            .await;

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(lf),
        )]))
    }
}
