use std::collections::HashMap;

use async_trait::async_trait;
use polars::prelude::*;
use tokio::sync::mpsc;

use crate::{
    executor::{
        NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
        NodeExecutorOptions,
    },
    flow::{JoinNodeData, Node, DEFAULT_OUTPUT, JOIN_LEFT_INPUT, JOIN_RIGHT_INPUT},
    AppState,
};

pub struct JoinNodeExecutor {
    node_id: String,
    how: JoinType,
    left_on: Expr,
    right_on: Expr,
}

impl JoinNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: JoinNodeData = serde_json::from_value(
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

        let on = data
            .on
            .and_then(|on| if on.is_empty() { None } else { Some(on) })
            .and_then(|on| crate::expressions::parse_program(&on).ok());

        let left_on = data
            .left_on
            .as_ref()
            .and_then(|left_on| {
                if left_on.is_empty() {
                    None
                } else {
                    Some(left_on)
                }
            })
            .and_then(|left_on| crate::expressions::parse_program(left_on).ok());

        let right_on = data
            .right_on
            .as_ref()
            .and_then(|right_on| {
                if right_on.is_empty() {
                    None
                } else {
                    Some(right_on)
                }
            })
            .and_then(|left_on| crate::expressions::parse_program(left_on).ok());

        let left_on = if left_on.is_none() {
            on.clone()
        } else {
            left_on
        };
        let right_on = if right_on.is_none() {
            on.clone()
        } else {
            right_on
        };

        if left_on.is_none() || right_on.is_none() {
            return Err(NodeExecutionError::NodeConfigInvalid {
                node_id: node.id.clone(),
                message: "Missing on or left_on/right_on".to_string(),
                source: None,
            });
        }

        let left_on = crate::expressions::ast_to_expr(left_on.as_ref().unwrap()).map_err(|err| {
            NodeExecutionError::ExpressionConversionError {
                node_id: node.id.clone(),
                expr: match data.left_on.as_ref() {
                    Some(left_on) => left_on.clone(),
                    None => "".into(),
                },
                message: err.to_string(),
                source: err,
            }
        });
        let right_on = crate::expressions::ast_to_expr(right_on.as_ref().unwrap()).map_err(|err| {
            NodeExecutionError::ExpressionConversionError {
                node_id: node.id.clone(),
                expr: match data.right_on.as_ref() {
                    Some(left_on) => left_on.clone(),
                    None => "".into(),
                },
                message: err.to_string(),
                source: err,
            }
        });

        let how = match data.how.as_str() {
            "inner" => JoinType::Inner,
            "left" => JoinType::Left,
            "right" => JoinType::Right,
            "full" => JoinType::Full,
            _ => JoinType::Inner,
        };

        Ok(Self {
            node_id: node.id.clone(),
            how,
            left_on: left_on.unwrap(),
            right_on: right_on.unwrap(),
        })
    }
}

#[async_trait]
impl NodeExecutor for JoinNodeExecutor {
    async fn execute(
        &self,
        _state: Arc<AppState>,
        inputs: &super::InputMap,
        _options: Arc<NodeExecutorOptions>,
        _tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Result<super::OutputMap, NodeExecutionError> {
        let right_input =
            inputs
                .get(JOIN_RIGHT_INPUT)
                .ok_or_else(|| NodeExecutionError::InputNotFound {
                    node_id: self.node_id.clone(),
                    port: JOIN_RIGHT_INPUT.to_string(),
                })?;
        let left_input =
            inputs
                .get(JOIN_LEFT_INPUT)
                .ok_or_else(|| NodeExecutionError::InputNotFound {
                    node_id: self.node_id.clone(),
                    port: JOIN_LEFT_INPUT.to_string(),
                })?;

        let right_lf =
            right_input
                .df
                .as_ref()
                .ok_or_else(|| NodeExecutionError::InputDataEmpty {
                    node_id: self.node_id.clone(),
                })?;
        let left_lf = left_input
            .df
            .as_ref()
            .ok_or_else(|| NodeExecutionError::InputDataEmpty {
                node_id: self.node_id.clone(),
            })?;

        let lf_out = left_lf.clone().join(
            right_lf.clone(),
            [self.left_on.clone()],
            [self.right_on.clone()],
            self.how.clone().into(),
        );

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(lf_out),
        )]))
    }
}
