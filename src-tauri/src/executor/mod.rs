use async_trait::async_trait;
use polars::prelude::*;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Instant};
use tokio::sync::mpsc;
use ts_rs::TS;

mod concat;
mod describe;
mod error;
mod filter;
mod groupby;
mod join;
mod select;
mod sink;
mod sort;
mod source;

pub use error::*;

use concat::ConcatNodeExecutor;
use describe::DescribeNodeExecutor;
use filter::FilterNodeExecutor;
use groupby::GroupByNodeExecutor;
use join::JoinNodeExecutor;
use select::SelectNodeExecutor;
use sink::SinkNodeExecutor;
use sort::SortNodeExecutor;
use source::SourceNodeExecutor;
use uuid::Uuid;

use crate::{
    flow::{Node, NodeType, DEFAULT_OUTPUT},
    reader::{NodeReadOutput, NodeReaderOptions},
    AppState,
};

#[async_trait]
pub trait NodeExecutor: Send + Sync {
    async fn load_cached(
        &self,
        _state: Arc<AppState>,
        _options: Arc<NodeExecutorOptions>,
        _tx: mpsc::Sender<NodeExecutionMessage>,
        _is_last: bool,
    ) -> Option<OutputMap> {
        None
    }

    async fn execute(
        &self,
        state: Arc<AppState>,
        inputs: &InputMap,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Result<OutputMap, NodeExecutionError>;
}

struct RelayExecutor;

#[async_trait]
impl NodeExecutor for RelayExecutor {
    async fn execute(
        &self,
        _state: Arc<AppState>,
        inputs: &InputMap,
        _options: Arc<NodeExecutorOptions>,
        _tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Result<OutputMap, NodeExecutionError> {
        Ok(inputs.clone())
    }
}

fn default_run_start() -> Instant {
    Instant::now()
}

#[derive(Clone, Debug, Deserialize, ts_rs::TS)]
#[ts(export)]
pub struct NodeExecutorOptions {
    pub run_id: String,
    pub page: u32,
    pub page_size: u32,
    pub diagnostic: bool,
    #[serde(skip, default = "default_run_start")]
    pub run_start: Instant,
}

impl Default for NodeExecutorOptions {
    fn default() -> Self {
        Self {
            diagnostic: true,
            run_id: Uuid::new_v4().to_string(),
            run_start: Instant::now(),
            page: 1,
            page_size: 10,
        }
    }
}

#[derive(Clone, Default)]
pub struct NodeExecutionOutput {
    pub df: Option<LazyFrame>,
    pub errors: Vec<NodeExecutionError>,
}

impl NodeExecutionOutput {
    pub fn success(df: LazyFrame) -> Self {
        Self {
            df: Some(df),
            errors: vec![],
        }
    }

    pub fn error(err: NodeExecutionError) -> Self {
        Self {
            df: None,
            errors: vec![err],
        }
    }
}

impl NodeExecutionOutput {
    pub async fn as_preview(&self, limit: u32) -> anyhow::Result<NodeExecutionPreview> {
        let df = &self.df;
        let errors = self
            .errors
            .clone()
            .into_iter()
            .map(|e| e.to_string())
            .collect();

        let Some(df) = df else {
            return Ok(NodeExecutionPreview {
                output: None,
                errors,
            });
        };

        let read_options = NodeReaderOptions {
            page_size: limit,
            ..Default::default()
        };

        let output = NodeReadOutput::try_from_df(df.clone(), &read_options).await?;
        let output = Some(output);

        Ok(NodeExecutionPreview { output, errors })
    }
}

#[derive(Serialize, TS, Debug, Clone)]
#[ts(export)]
pub struct NodeExecutionPreview {
    pub output: Option<NodeReadOutput>,
    pub errors: Vec<String>,
}

pub type InputMap = HashMap<String, NodeExecutionOutput>;
pub type OutputMap = HashMap<String, NodeExecutionOutput>;

#[derive(Debug, Serialize, TS, Clone)]
#[ts(export)]
#[serde(tag = "type")]
pub enum NodeExecutionMessage {
    Queued {
        node_id: String,
        run_id: String,
        #[ts(type = "number")]
        ts: u128,
    },
    Piped {
        node_id: String,
        run_id: String,
        #[ts(type = "number")]
        ts: u128,
    },
    Start {
        node_id: String,
        run_id: String,
        #[ts(type = "number")]
        ts: u128,
    },
    Progress {
        node_id: String,
        run_id: String,
        #[ts(type = "number")]
        duration: u128,
        progress: f64,
        #[ts(type = "number")]
        ts: u128,
    },
    Error {
        node_id: String,
        run_id: String,
        error: String,
        #[ts(type = "number")]
        ts: u128,
    },
    Success {
        node_id: String,
        run_id: String,
        #[ts(type = "number")]
        duration: u128,
        #[ts(type = "number")]
        ts: u128,
        preview: Option<NodeExecutionPreview>,
    },
    Log {
        node_id: String,
        run_id: String,
        #[ts(type = "number")]
        ts: u128,
        message: String,
    },
}

impl Node {
    pub fn executor(&self) -> Result<Box<dyn NodeExecutor>, NodeExecutionError> {
        match self.node_type {
            Some(NodeType::SelectNode) => Ok(Box::new(SelectNodeExecutor::from_node(self)?)),
            Some(NodeType::FilterNode) => Ok(Box::new(FilterNodeExecutor::from_node(self)?)),
            Some(NodeType::GroupByNode) => Ok(Box::new(GroupByNodeExecutor::from_node(self)?)),
            Some(NodeType::JoinNode) => Ok(Box::new(JoinNodeExecutor::from_node(self)?)),
            Some(NodeType::SourceNode) => Ok(Box::new(SourceNodeExecutor::from_node(self)?)),
            Some(NodeType::SortNode) => Ok(Box::new(SortNodeExecutor::from_node(self)?)),
            Some(NodeType::SinkNode) => Ok(Box::new(SinkNodeExecutor::from_node(self)?)),
            Some(NodeType::ConcatNode) => Ok(Box::new(ConcatNodeExecutor::from_node(self)?)),
            Some(NodeType::DescribeNode) => Ok(Box::new(DescribeNodeExecutor::from_node(self)?)),
            Some(_other) => Ok(Box::new(RelayExecutor)),
            None => Err(NodeExecutionError::NodeTypeInvalid {
                node_id: self.id.clone(),
                node_type: "missing".into(),
            }),
        }
    }
}

pub async fn load_cached_execution(
    node: &Node,
    state: Arc<AppState>,
    options: Arc<NodeExecutorOptions>,
    tx: mpsc::Sender<NodeExecutionMessage>,
    is_last: bool,
) -> Option<OutputMap> {
    let executor = node.executor().ok()?;
    executor.load_cached(state, options, tx, is_last).await
}

pub async fn execute_node(
    node: &Node,
    state: Arc<AppState>,
    inputs: InputMap,
    options: Arc<NodeExecutorOptions>,
    tx: mpsc::Sender<NodeExecutionMessage>,
    is_last: bool,
) -> HashMap<String, NodeExecutionOutput> {
    let ts = || options.run_start.elapsed().as_micros();

    let executor = match node.executor() {
        Ok(exec) => exec,
        Err(err) => {
            _ = tx
                .send(NodeExecutionMessage::Error {
                    node_id: node.id.clone(),
                    run_id: options.run_id.clone(),
                    error: err.to_string(),
                    ts: ts(),
                })
                .await;

            return HashMap::new();
        }
    };

    let now = Instant::now();

    if options.diagnostic || is_last {
        _ = tx
            .send(NodeExecutionMessage::Start {
                node_id: node.id.clone(),
                run_id: options.run_id.clone(),
                ts: ts(),
            })
            .await;
    }

    let message: Option<NodeExecutionMessage>;

    let output = match executor
        .execute(state, &inputs, options.clone(), tx.clone())
        .await
    {
        Ok(output) => {
            message = if options.diagnostic || is_last {
                match output.get(DEFAULT_OUTPUT) {
                    Some(output) => match output.as_preview(options.page_size).await {
                        Ok(preview) => Some(NodeExecutionMessage::Success {
                            node_id: node.id.clone(),
                            run_id: options.run_id.clone(),
                            duration: now.elapsed().as_micros(),
                            ts: ts(),
                            preview: Some(preview),
                        }),
                        Err(err) => Some(NodeExecutionMessage::Error {
                            node_id: node.id.clone(),
                            run_id: options.run_id.clone(),
                            error: err.to_string(),
                            ts: options.run_start.elapsed().as_micros(),
                        }),
                    },
                    None => Some(NodeExecutionMessage::Success {
                        node_id: node.id.clone(),
                        run_id: options.run_id.clone(),
                        duration: now.elapsed().as_micros(),
                        ts: ts(),
                        preview: None,
                    }),
                }
            } else {
                None
            };

            output
        }
        Err(err) => {
            message = Some(NodeExecutionMessage::Error {
                node_id: node.id.clone(),
                run_id: options.run_id.clone(),
                error: err.to_string(),
                ts: ts(),
            });

            HashMap::from([(DEFAULT_OUTPUT.to_string(), NodeExecutionOutput::error(err))])
        }
    };

    if let Some(message) = message {
        tx.send(message).await.ok();
    }

    output
}
