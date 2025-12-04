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
        node::FilterNodeData,
        Node, DEFAULT_INPUT, DEFAULT_OUTPUT,
    },
    AppState,
};

pub struct FilterNodeExecutor {
    node_id: String,
    expr: Expr,
}

impl FilterNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: FilterNodeData = serde_json::from_value(
            node.data
                .as_ref()
                .ok_or(NodeExecutionError::NodeConfigInvalid {
                    message: "missing data".to_string(),
                    node_id: node.id.clone(),
                    source: None,
                })?
                .clone(),
        )
        .map_err(|e| NodeExecutionError::NodeConfigInvalid {
            node_id: node.id.clone(),
            message: e.to_string(),
            source: Some(Arc::new(e)),
        })?;

        let ast = crate::expressions::parse_program(&data.expr).map_err(|err| {
            NodeExecutionError::ExpressionParseError {
                node_id: node.id.clone(),
                expr: data.expr.clone(),
                message: err.to_string(),
                source: err,
            }
        })?;

        let expr = crate::expressions::ast_to_expr(&ast).map_err(|err| {
            NodeExecutionError::ExpressionConversionError {
                node_id: node.id.clone(),
                expr: data.expr.clone(),
                message: err.to_string(),
                source: err,
            }
        })?;

        Ok(Self {
            node_id: node.id.clone(),
            expr,
        })
    }
}

#[async_trait]
impl NodeExecutor for FilterNodeExecutor {
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

        let df_out = df.clone().filter(self.expr.clone());

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(df_out),
        )]))
    }
}
