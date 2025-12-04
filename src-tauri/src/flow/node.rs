use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    hash::{DefaultHasher, Hash, Hasher},
    sync::Arc,
};
use ts_rs::TS;

use crate::{flow::Node, AppState};

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
