use std::sync::Arc;

use crate::expressions::ExpressionError;
use polars::error::PolarsError;
use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum NodeExecutionError {
    #[error("Invalid configuration in node '{node_id}': {message}")]
    NodeConfigInvalid {
        node_id: String,
        message: String,
        source: Option<Arc<dyn std::error::Error + Send + Sync>>,
    },

    #[error("IO error in node '{node_id}': {message}")]
    IoError { node_id: String, message: String },

    #[error("Failed to parse expression '{expr}' in node '{node_id}': {message}")]
    ExpressionParseError {
        node_id: String,
        expr: String,
        message: String,
        source: ExpressionError,
    },

    #[error("Failed to convert AST to Polars expression in node '{node_id}': {message}")]
    ExpressionConversionError {
        node_id: String,
        expr: String,
        message: String,
        source: ExpressionError,
    },

    #[error("Missing required input '{port}' for node '{node_id}'")]
    InputNotFound { node_id: String, port: String },

    #[error("Input dataframe is empty or not materialized for node '{node_id}'")]
    InputDataEmpty { node_id: String },

    #[error(transparent)]
    PolarsError(#[from] PolarsError),

    #[error("Invalid node type '{node_type}' in node '{node_id}'")]
    NodeTypeInvalid { node_id: String, node_type: String },

    #[error("{0}")]
    Custom(String),
}
