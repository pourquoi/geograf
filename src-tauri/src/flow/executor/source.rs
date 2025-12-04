use futures_util::StreamExt;
use polars::prelude::*;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::{collections::HashMap, fs::File, io::Write, time::Instant};
use tokio::sync::mpsc;

use async_trait::async_trait;

use crate::{
    flow::{
        executor::{
            NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
            NodeExecutorOptions,
        },
        node::{get_data_cache_path, DataFormat, SourceNodeData},
        Node, DEFAULT_OUTPUT,
    },
    AppState,
};

pub struct SourceNodeExecutor {
    node_id: String,
    source: String,
    format: DataFormat,
    cache: bool,
    headers: Option<reqwest::header::HeaderMap>,
}

impl SourceNodeExecutor {
    pub fn from_node(node: &Node) -> Result<Self, NodeExecutionError> {
        let data: SourceNodeData =
            node.data_as()
                .map_err(|e| NodeExecutionError::NodeConfigInvalid {
                    node_id: node.id.clone(),
                    message: e.to_string(),
                    source: Some(Arc::new(e)),
                })?;
        let headers = if let Some(headers) = data.headers.clone() {
            let mut hm = HeaderMap::new();

            for (key, value) in headers {
                let name = HeaderName::from_bytes(key.as_bytes()).map_err(|e| {
                    NodeExecutionError::NodeConfigInvalid {
                        node_id: node.id.clone(),
                        message: e.to_string(),
                        source: Some(Arc::new(e)),
                    }
                })?;
                let val = HeaderValue::from_str(&value).map_err(|e| {
                    NodeExecutionError::NodeConfigInvalid {
                        node_id: node.id.clone(),
                        message: e.to_string(),
                        source: Some(Arc::new(e)),
                    }
                })?;
                hm.insert(name, val);
            }
            Some(hm)
        } else {
            None
        };

        Ok(Self {
            node_id: node.id.clone(),
            source: data.source,
            format: data.format,
            cache: data.cache,
            headers,
        })
    }
}

#[async_trait]
impl NodeExecutor for SourceNodeExecutor {
    async fn execute(
        &self,
        state: Arc<AppState>,
        _inputs: &super::InputMap,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Result<super::OutputMap, NodeExecutionError> {
        let mut path = self.source.clone();

        // todo: refactor
        if self.source.starts_with("http://") || self.source.starts_with("https://") {
            let cache_path = get_data_cache_path(state.clone(), &self.source, &self.format);

            if self.cache && std::fs::metadata(&cache_path).is_ok() {
                path = cache_path;
                _ = tx
                    .send(NodeExecutionMessage::Log {
                        node_id: self.node_id.clone(),
                        run_id: options.run_id.clone(),
                        message: format!("using cached {}", path),
                        ts: options.run_start.elapsed().as_micros(),
                    })
                    .await;
            } else {
                _ = tx
                    .send(NodeExecutionMessage::Log {
                        node_id: self.node_id.clone(),
                        run_id: options.run_id.clone(),
                        message: format!("downloading {}", self.source),
                        ts: options.run_start.elapsed().as_micros(),
                    })
                    .await;
                let url = self.source.clone();
                let mut req = reqwest::Request::new(
                    reqwest::Method::GET,
                    reqwest::Url::parse(&url).map_err(|e| NodeExecutionError::IoError {
                        node_id: self.node_id.clone(),
                        message: format!("failed to parse url {}: {}", url, e),
                    })?,
                );
                if let Some(headers) = self.headers.clone() {
                    req.headers_mut().extend(headers);
                }
                let res = reqwest::get(&url)
                    .await
                    .map_err(|e| NodeExecutionError::IoError {
                        node_id: self.node_id.clone(),
                        message: format!("request failed for {}: {}", url, e),
                    })?;

                let content_length = match res.content_length() {
                    Some(content_length) if content_length > 0 => content_length,
                    _ => {
                        return Err(NodeExecutionError::IoError {
                            node_id: self.node_id.clone(),
                            message: format!("no content length on {}", url),
                        });
                    }
                };

                let mut stream = res.bytes_stream();
                let tmp_path = get_data_cache_path(
                    state.clone(),
                    format!("{}.tmp.{}", self.source, self.format),
                    &self.format,
                );
                let mut file =
                    File::create(&tmp_path).map_err(|e| NodeExecutionError::IoError {
                        node_id: self.node_id.clone(),
                        message: format!("failed to create temporary file {}: {}", tmp_path, e),
                    })?;

                let mut progress = 0_f64;
                let t = Instant::now();

                while let Some(chunk) = stream.next().await {
                    if let Ok(chunk) = chunk {
                        match file.write(&chunk) {
                            Ok(written) => {
                                progress += written as f64 / content_length as f64;
                                if t.elapsed() >= std::time::Duration::from_secs(3) {
                                    _ = tx
                                        .send(NodeExecutionMessage::Progress {
                                            node_id: self.node_id.clone(),
                                            run_id: options.run_id.clone(),
                                            duration: options.run_start.elapsed().as_micros(),
                                            progress: (progress * 100_f64)
                                                .clamp(0_f64, 100_f64)
                                                .round(),
                                            ts: options.run_start.elapsed().as_micros(),
                                        })
                                        .await;
                                }
                            }
                            Err(e) => {
                                drop(file);
                                _ = std::fs::remove_file(&tmp_path);
                                return Err(NodeExecutionError::IoError {
                                    node_id: self.node_id.clone(),
                                    message: format!("failed to write to temporary file: {}", e),
                                });
                            }
                        }
                    }
                }

                _ = tx
                    .send(NodeExecutionMessage::Progress {
                        node_id: self.node_id.clone(),
                        run_id: options.run_id.clone(),
                        duration: options.run_start.elapsed().as_micros(),
                        progress: 100_f64,
                        ts: options.run_start.elapsed().as_micros(),
                    })
                    .await;

                _ = file.flush();
                drop(file);

                _ = std::fs::rename(&tmp_path, &cache_path).map_err(|e| {
                    NodeExecutionError::IoError {
                        node_id: self.node_id.clone(),
                        message: format!(
                            "failed to rename temporary file {} to {}: {}",
                            tmp_path, cache_path, e
                        ),
                    }
                });
                path = cache_path
            }
        }

        let output = match &self.format {
            DataFormat::Csv { comma_delimiter } => {
                let path = PlPath::from_string(path.clone());

                // todo: pull from options
                let df = LazyCsvReader::new(path)
                    .with_has_header(true)
                    .with_separator(if *comma_delimiter { b',' } else { b';' })
                    .with_truncate_ragged_lines(true)
                    .with_encoding(CsvEncoding::LossyUtf8)
                    .with_infer_schema_length(Some(1000))
                    .with_ignore_errors(true)
                    .finish()
                    .map_err(NodeExecutionError::PolarsError)?;

                Ok(HashMap::from([(
                    DEFAULT_OUTPUT.to_string(),
                    NodeExecutionOutput::success(df),
                )]))
            }
            DataFormat::Json => {
                let file = File::open(path.clone()).map_err(|e| NodeExecutionError::IoError {
                    node_id: self.node_id.clone(),
                    message: format!("failed to open file {}: {}", path, e),
                })?;

                let df = JsonReader::new(file)
                    .finish()
                    .map_err(NodeExecutionError::PolarsError)?;

                Ok(HashMap::from([(
                    DEFAULT_OUTPUT.to_string(),
                    NodeExecutionOutput::success(df.lazy()),
                )]))
            }
            DataFormat::Jsonl => {
                let path = PlPath::from_string(path.clone());

                let df = LazyJsonLineReader::new(path)
                    .with_infer_schema_length(Some(1000.try_into().unwrap()))
                    .with_ignore_errors(true)
                    .finish()
                    .map_err(|e| NodeExecutionError::PolarsError(e))?;

                Ok(HashMap::from([(
                    DEFAULT_OUTPUT.to_string(),
                    NodeExecutionOutput::success(df),
                )]))
            }
            DataFormat::Parquet => {
                let path = PlPath::from_string(path.clone());
                let lf = LazyFrame::scan_parquet(path, Default::default())
                    .map_err(NodeExecutionError::PolarsError)?;
                Ok(HashMap::from([(
                    DEFAULT_OUTPUT.to_string(),
                    NodeExecutionOutput::success(lf),
                )]))
            }
        };

        output
    }
}
