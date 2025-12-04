use async_trait::async_trait;
use polars::prelude::*;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::mpsc;

use crate::{
    flow::{
        executor::{
            NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
            NodeExecutorOptions,
        },
        node::DescribeNodeData,
        Node, DEFAULT_INPUT, DEFAULT_OUTPUT,
    },
    AppState,
};

pub struct DescribeNodeExecutor {
    node_id: String,
    config: DescribeNodeData,
}

impl DescribeNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: DescribeNodeData = serde_json::from_value(
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
            node_id: node.id.clone(),
            config: data,
        })
    }
}

#[async_trait]
impl NodeExecutor for DescribeNodeExecutor {
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
                node_id: self.node_id.clone(),
                port: DEFAULT_INPUT.to_string(),
            })?;

        let df = input
            .df
            .as_ref()
            .ok_or_else(|| NodeExecutionError::InputDataEmpty {
                node_id: self.node_id.clone(),
            })?;

        let min = df.clone().min();
        let max = df.clone().max();
        let mean = df.clone().mean();
        let std = df.clone().std(1);
        let count = df.clone().count();

        Ok(HashMap::from([
            ("min".to_string(), NodeExecutionOutput::success(min)),
            ("max".to_string(), NodeExecutionOutput::success(max)),
            ("mean".to_string(), NodeExecutionOutput::success(mean)),
            ("std".to_string(), NodeExecutionOutput::success(std)),
            ("count".to_string(), NodeExecutionOutput::success(count)),
        ]))
    }
}
