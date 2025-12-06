use std::collections::HashMap;

use async_trait::async_trait;
use polars::prelude::*;
use tokio::sync::mpsc;

use crate::{
    executor::{
        NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
        NodeExecutorOptions,
    },
    flow::{Node, SelectNodeData, DEFAULT_INPUT, DEFAULT_OUTPUT},
    AppState,
};

pub struct SelectNodeExecutor {
    node_id: String,
    exprs: Vec<Expr>,
    with_columns: bool,
}

impl SelectNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: SelectNodeData = serde_json::from_value(
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

        let mut asts: Vec<(String, _)> = vec![];
        for expr in data.exprs.iter().filter(|s| !s.is_empty()) {
            let ast = crate::expressions::parse_program(expr).map_err(|err| {
                NodeExecutionError::ExpressionParseError {
                    node_id: node.id.clone(),
                    expr: expr.clone(),
                    message: err.to_string(),
                    source: err,
                }
            })?;
            asts.push((expr.clone(), ast));
        }

        let mut exprs: Vec<Expr> = vec![];
        for (raw_expr, ast) in asts.iter() {
            let expr = crate::expressions::ast_to_expr(ast).map_err(|err| {
                NodeExecutionError::ExpressionConversionError {
                    node_id: node.id.clone(),
                    expr: raw_expr.clone(),
                    message: err.to_string(),
                    source: err,
                }
            })?;
            exprs.push(expr);
        }

        Ok(Self {
            node_id: node.id.clone(),
            exprs,
            with_columns: data.with_columns,
        })
    }
}

#[async_trait]
impl NodeExecutor for SelectNodeExecutor {
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

        let lf = input
            .df
            .as_ref()
            .ok_or_else(|| NodeExecutionError::InputDataEmpty {
                node_id: self.node_id.clone(),
            })?;

        let lf_out = if !self.exprs.is_empty() {
            if self.with_columns {
                lf.clone().with_columns(self.exprs.clone())
            } else {
                lf.clone().select(self.exprs.clone())
            }
        } else {
            lf.clone()
        };

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(lf_out),
        )]))
    }
}
