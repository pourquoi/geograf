use std::hash::{DefaultHasher, Hash, Hasher};
use std::sync::Arc;

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use sqlx::{prelude::Type, FromRow};
use ts_rs::TS;

pub use crate::dag::FlowGraph;
pub use crate::executor::OutputMap;
use crate::AppState;

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

#[derive(Serialize, TS, Deserialize, Debug, Clone, Copy, PartialEq, strum::Display, Default)]
pub enum NodeType {
    SourceNode,
    SinkNode,
    SelectNode,
    FilterNode,
    GroupByNode,
    JoinNode,
    SortNode,
    ChartNode,
    ConcatNode,
    DescribeNode,
    #[serde(other)]
    #[default]
    Unknown,
}

#[derive(Serialize, TS, Deserialize, Debug, Clone, strum::Display)]
#[ts(export)]
#[serde(tag = "type")]
#[strum(serialize_all = "lowercase")]
pub enum DataFormat {
    Json,
    Jsonl,
    Csv { comma_delimiter: bool },
    Parquet,
}

macro_rules! node_data {
    ($($name:ident {$($field:ident: $ty:ty),*$(,)?})*) => {
        $(
            #[derive(Serialize, TS, Deserialize, Debug, Clone)]
            #[ts(export)]
            pub struct $name {
                pub label: String,
                $(pub $field: $ty,)*
            }
        )*
    };
}

node_data! {
    SourceNodeData {
        source: String,
        format: DataFormat,
        headers: Option<Vec<(String, String)>>,
        cache: bool,
    }
    SinkNodeData {
        dest: String,
        format: DataFormat,
        limit: Option<u32>,
        options: Option<Value>,
    }
    SelectNodeData {
        exprs: Vec<String>,
        with_columns: bool,
    }
    FilterNodeData {
        expr: String,
    }
    GroupByNodeData {
        exprs: Vec<String>,
        aggrs: Vec<String>,
        sort: Option<String>,
    }
    JoinNodeData {
        how: String,
        on: Option<String>,
        left_on: Option<String>,
        right_on: Option<String>,
    }
    SortNodeData {
        by: Vec<SortBy>,
    }
    ConcatNodeData {
        horizontal: Option<bool>,
    }
    DescribeNodeData {
    }
}

#[derive(Serialize, TS, Deserialize, Debug, Clone)]
#[ts(export)]
pub struct SortBy {
    pub name: String,
    pub asc: bool,
}

pub fn get_data_cache_path<T>(state: Arc<AppState>, filename: T, format: &DataFormat) -> String
where
    T: AsRef<str> + Hash,
{
    let app_dir = state.app_dir.clone().expect("app dir required");
    let mut hasher = DefaultHasher::new();
    filename.hash(&mut hasher);
    let hash = hasher.finish();
    app_dir
        .join(format!("{}.{}", hash, format))
        .to_string_lossy()
        .to_string()
}

pub fn delete_node_data(
    state: Arc<AppState>,
    _project_id: &str,
    node: &Node,
) -> anyhow::Result<()> {
    let mut to_delete = vec![];
    match node.node_type {
        Some(NodeType::SourceNode) => {
            let data = node.data_as::<SourceNodeData>()?;
            if data.source.starts_with("http://") || data.source.starts_with("https://") {
                to_delete.push(get_data_cache_path(
                    state.clone(),
                    &data.source,
                    &data.format,
                ));
                to_delete.push(get_data_cache_path(
                    state.clone(),
                    format!("{}.tmp.{}", data.source, data.format),
                    &data.format,
                ));
            }
        }
        _ => {}
    }

    for path in to_delete {
        _ = std::fs::remove_file(path);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const FLOW_1: &str = include_str!("../data-test/flow_test_unknown.json");

    #[test]
    fn test_deserialize_flow() {
        let flow = serde_json::from_str::<Flow>(FLOW_1);
        assert!(flow.is_ok());
    }
}
