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
        node::GroupByNodeData,
        Node, DEFAULT_INPUT, DEFAULT_OUTPUT,
    },
    AppState,
};

pub struct GroupByNodeExecutor {
    node_id: String,
    exprs: Vec<Expr>,
    aggrs: Vec<Expr>,
}

impl GroupByNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: GroupByNodeData = serde_json::from_value(
            node.data
                .as_ref()
                .ok_or(NodeExecutionError::NodeConfigInvalid {
                    message: "missing data".into(),
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

        let mut asts: Vec<(String, _)> = vec![];
        for expr in data.exprs.iter() {
            let ast = crate::expressions::parse_program(expr).map_err(|e| {
                NodeExecutionError::ExpressionParseError {
                    node_id: node.id.clone(),
                    expr: expr.clone(),
                    message: e.to_string(),
                    source: e,
                }
            })?;
            asts.push((expr.clone(), ast));
        }

        let mut exprs: Vec<_> = vec![];
        for (raw_expr, ast) in asts.iter() {
            let expr = crate::expressions::ast_to_expr(ast).map_err(|e| {
                NodeExecutionError::ExpressionConversionError {
                    node_id: node.id.clone(),
                    expr: raw_expr.clone(),
                    message: e.to_string(),
                    source: e,
                }
            })?;
            exprs.push(expr);
        }

        let mut asts: Vec<(String, _)> = vec![];
        for expr in data.aggrs.iter() {
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

        let mut aggrs = vec![];
        for (raw_expr, ast) in asts.iter() {
            let expr = crate::expressions::ast_to_expr(ast).map_err(|err| {
                NodeExecutionError::ExpressionConversionError {
                    node_id: node.id.clone(),
                    expr: raw_expr.clone(),
                    message: err.to_string(),
                    source: err,
                }
            })?;
            aggrs.push(expr);
        }

        Ok(Self {
            node_id: node.id.clone(),
            exprs,
            aggrs,
        })
    }
}

#[async_trait]
impl NodeExecutor for GroupByNodeExecutor {
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

        let df_out = df
            .clone()
            .group_by(self.exprs.clone())
            .agg(self.aggrs.clone());

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(df_out),
        )]))
    }
}
