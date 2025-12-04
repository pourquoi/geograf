use async_trait::async_trait;
use polars::prelude::UnionArgs;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::mpsc;

use crate::{
    flow::{
        executor::{
            NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
            NodeExecutorOptions,
        },
        node::ConcatNodeData,
        Node, CONCAT_FIRST_INPUT, CONCAT_SECOND_INPUT, DEFAULT_OUTPUT,
    },
    AppState,
};

pub struct ConcatNodeExecutor {
    node_id: String,
    horizontal: bool,
}

impl ConcatNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: ConcatNodeData = serde_json::from_value(
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
            horizontal: data.horizontal.unwrap_or(false),
        })
    }
}

#[async_trait]
impl NodeExecutor for ConcatNodeExecutor {
    async fn execute(
        &self,
        _state: Arc<AppState>,
        inputs: &super::InputMap,
        _options: Arc<NodeExecutorOptions>,
        _tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Result<super::OutputMap, NodeExecutionError> {
        let first_input =
            inputs
                .get(CONCAT_FIRST_INPUT)
                .ok_or_else(|| NodeExecutionError::InputNotFound {
                    node_id: self.node_id.clone(),
                    port: CONCAT_FIRST_INPUT.to_string(),
                })?;
        let second_input =
            inputs
                .get(CONCAT_SECOND_INPUT)
                .ok_or_else(|| NodeExecutionError::InputNotFound {
                    node_id: self.node_id.clone(),
                    port: CONCAT_SECOND_INPUT.to_string(),
                })?;

        let first_df =
            first_input
                .df
                .as_ref()
                .ok_or_else(|| NodeExecutionError::InputDataEmpty {
                    node_id: self.node_id.clone(),
                })?;
        let second_df =
            second_input
                .df
                .as_ref()
                .ok_or_else(|| NodeExecutionError::InputDataEmpty {
                    node_id: self.node_id.clone(),
                })?;

        let lfs = vec![first_df.clone(), second_df.clone()];

        let lf_out = if self.horizontal {
            polars::prelude::concat_lf_horizontal(lfs, UnionArgs::default())?
        } else {
            polars::prelude::concat(lfs, UnionArgs::default())?
        };

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(lf_out),
        )]))
    }
}
