use std::collections::HashMap;

use async_trait::async_trait;
use polars::prelude::*;
use tokio::sync::mpsc;

use crate::{
    flow::{
        executor::{
            NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
            NodeExecutorOptions,
        },
        node::SortNodeData,
        Node, DEFAULT_INPUT, DEFAULT_OUTPUT,
    },
    AppState,
};

pub struct SortNodeExecutor {
    node_id: String,
    by: Vec<PlSmallStr>,
    ascending: Vec<bool>,
}

impl SortNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: SortNodeData = serde_json::from_value(
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

        let by = data.by.iter().map(|by| by.name.clone().into()).collect();
        let ascending = data.by.iter().map(|by| by.asc).collect();

        Ok(Self {
            node_id: node.id.clone(),
            by,
            ascending,
        })
    }
}

#[async_trait]
impl NodeExecutor for SortNodeExecutor {
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

        let desc_options = self.ascending.clone().into_iter().map(|asc| !asc);
        let sort_options = SortMultipleOptions::new().with_order_descending_multi(desc_options);

        let df_out = df.clone().sort(self.by.clone(), sort_options);

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(df_out),
        )]))
    }
}
