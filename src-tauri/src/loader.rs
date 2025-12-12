use crate::{
    flow::{get_data_cache_path, DataFormat, Node, NodeType, SinkNodeData, SourceNodeData},
    AppState,
};
use polars::prelude::*;
use std::fs::File;
use std::sync::Arc;
use thiserror::Error;

pub trait Loader: Send + Sync {
    fn has_local_file(&self, state: Arc<AppState>) -> bool;
    fn get_local_path(&self, state: Arc<AppState>) -> Option<(String, DataFormat)>;
    async fn load_lf(&self, state: Arc<AppState>) -> Option<LazyFrame>;
}

#[derive(Debug, Error)]
pub enum LoaderError {
    #[error(transparent)]
    PolarsError(#[from] PolarsError),
    #[error("{0}")]
    Custom(String),
}

impl Loader for Node {
    fn has_local_file(&self, state: Arc<AppState>) -> bool {
        match self.get_local_path(state) {
            Some((path, _)) => std::path::Path::new(&path).exists(),
            None => false,
        }
    }

    fn get_local_path(&self, state: Arc<AppState>) -> Option<(String, DataFormat)> {
        match self.node_type {
            Some(NodeType::SourceNode) => {
                let data: SourceNodeData = self.data_as().ok()?;
                let source = data.source.clone();
                if source.is_empty() {
                    return None;
                }

                if data.source.starts_with("http://") || data.source.starts_with("https://") {
                    let cache_path = get_data_cache_path(state.clone(), &data.source, &data.format);

                    if data.cache && std::fs::metadata(&cache_path).is_ok() {
                        Some((cache_path, data.format))
                    } else {
                        None
                    }
                } else {
                    Some((source, data.format))
                }
            }
            Some(NodeType::SinkNode) => {
                let data: SinkNodeData = self.data_as().ok()?;
                Some((
                    get_node_file_path(state.clone(), &self.id, &data.format),
                    data.format,
                ))
            }
            _ => None,
        }
    }

    async fn load_lf(&self, state: Arc<AppState>) -> Option<LazyFrame> {
        if let Some((source, format)) = self.get_local_path(state.clone()) {
            load_local_lf(&source, &format).ok()
        } else {
            None
        }
    }
}

pub fn get_node_file_path(state: Arc<AppState>, node_id: &str, format: &DataFormat) -> String {
    let path = format!(
        "{}/{}.{}",
        state
            .app_dir
            .as_ref()
            .unwrap()
            .clone()
            .into_os_string()
            .to_str()
            .unwrap(),
        node_id,
        format.to_string()
    );
    path
}

pub fn load_local_lf(source: &str, format: &DataFormat) -> Result<LazyFrame, LoaderError> {
    println!("load_local_lf {} {}", source, format);
    match format {
        DataFormat::Csv { comma_delimiter } => {
            let path = PlPath::from_str(source);

            let df = LazyCsvReader::new(path)
                .with_has_header(true)
                .with_separator(if *comma_delimiter { b',' } else { b';' })
                .with_truncate_ragged_lines(true)
                .with_encoding(CsvEncoding::LossyUtf8)
                .with_infer_schema_length(Some(1000))
                .with_ignore_errors(true)
                .finish()?;

            Ok(df)
        }
        DataFormat::Json => {
            let file = File::open(source).map_err(|e| LoaderError::Custom(e.to_string()))?;

            let df = JsonReader::new(file)
                .finish()
                .map_err(|e| LoaderError::Custom(e.to_string()))?;
            let df = df.lazy();

            Ok(df)
        }
        DataFormat::Jsonl => {
            let path = PlPath::from_str(source);

            let df = LazyJsonLineReader::new(path)
                .with_infer_schema_length(Some(1000.try_into().unwrap()))
                .with_ignore_errors(true)
                .finish()?;

            Ok(df)
        }
        DataFormat::Parquet => {
            let path = PlPath::from_str(source);

            let df = LazyFrame::scan_parquet(path, Default::default())?;

            Ok(df)
        }
    }
}

pub fn delete_node_data(
    state: Arc<AppState>,
    _project_id: &str,
    node: &Node,
) -> anyhow::Result<()> {
    if let Some((path, _)) = node.get_local_path(state.clone()) {
        _ = std::fs::remove_file(path);
    }

    Ok(())
}
