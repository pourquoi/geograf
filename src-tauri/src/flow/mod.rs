use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use sqlx::{prelude::Type, FromRow};
use ts_rs::TS;

pub mod commands;
mod executor;
mod graph;
mod node;
mod reader;
pub mod repository;

pub use executor::OutputMap;
pub use graph::FlowGraph;

use crate::flow::node::NodeType;

pub const DEFAULT_INPUT: &str = "";
pub const DEFAULT_OUTPUT: &str = "";

pub const JOIN_RIGHT_INPUT: &str = "right";
pub const JOIN_LEFT_INPUT: &str = "left";

pub const CONCAT_FIRST_INPUT: &str = "first";
pub const CONCAT_SECOND_INPUT: &str = "second";

#[derive(Serialize, TS, Deserialize, Debug, Clone, FromRow)]
#[ts(export)]
pub struct Flow {
    pub id: String,
    pub name: String,
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

#[derive(Serialize, TS, Deserialize, Debug, Clone, Type)]
#[ts(export)]
pub struct Node {
    pub id: String,
    #[ts(type = "any")]
    pub data: Option<Value>,
    #[serde(rename = "type")]
    pub node_type: Option<NodeType>,
    pub position: NodePosition,
}

impl Node {
    pub fn data_as<T: DeserializeOwned>(&self) -> Result<T, serde_json::Error> {
        serde_json::from_value(self.data.clone().unwrap_or_default())
    }
}

#[derive(Serialize, TS, Deserialize, Debug, Clone, Type)]
#[ts(export)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Serialize, TS, Deserialize, Debug, Clone, Copy, PartialEq)]
pub enum EdgeType {
    CustomEdge,
    Unknown,
}

#[derive(Serialize, TS, Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Edge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub source_handle: Option<String>,
    pub target_handle: Option<String>,
    #[serde(rename = "type")]
    pub edge_type: Option<EdgeType>,
    #[ts(type = "any")]
    pub data: Option<Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    const FLOW_1: &str = include_str!("../../data-test/flow_test_unknown.json");

    #[test]
    fn test_deserialize_flow() {
        let flow = serde_json::from_str::<Flow>(FLOW_1);
        assert!(flow.is_ok());
    }
}
