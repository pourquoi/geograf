use serde::Serialize;
use thiserror::Error;
use ts_rs::TS;

#[derive(Error, TS, Serialize, Debug, Clone)]
#[ts(export)]
pub enum ExpressionError {
    #[error("syntaxt error: {msg}")]
    ParseError { msg: String, span: (usize, usize) },

    #[error("{0}")]
    IllegalArgument(String),

    #[error("function or method not supported: {name}")]
    Unsupported {
        name: String,
        span: (usize, usize),
        rule: Option<String>,
    },
}
