use crate::loader::{load_local_lf, Loader};
use futures_util::StreamExt;
use polars::prelude::*;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::{collections::HashMap, fs::File, io::Write, time::Instant};
use tokio::sync::mpsc;

use async_trait::async_trait;

use crate::{
    executor::{
        NodeExecutionError, NodeExecutionMessage, NodeExecutionOutput, NodeExecutor,
        NodeExecutorOptions,
    },
    flow::{get_data_cache_path, DataFormat, Node, SourceNodeData, DEFAULT_OUTPUT},
    AppState,
};

pub struct SourceNodeExecutor {
    node: Box<Node>,
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
            node: Box::new(node.clone()),
            source: data.source,
            format: data.format,
            cache: data.cache,
            headers,
        })
    }
}

#[async_trait]
impl NodeExecutor for SourceNodeExecutor {
    async fn load_cached(
        &self,
        state: Arc<AppState>,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
        _is_last: bool,
    ) -> Option<super::OutputMap> {
        if !self.cache {
            return None;
        }

        if !self.source.starts_with("http://") && !self.source.starts_with("https://") {
            return None;
        }

        let lf = self.node.load_lf(state).await;

        if let Some(lf) = lf {
            let msg = NodeExecutionMessage::Log {
                node_id: self.node.id.clone(),
                run_id: options.run_id.clone(),
                ts: options.run_start.elapsed().as_micros(),
                message: format!("using cache"),
            };
            _ = tx.send(msg).await;

            Some(HashMap::from([(
                DEFAULT_OUTPUT.to_string(),
                NodeExecutionOutput::success(lf),
            )]))
        } else {
            None
        }
    }

    async fn execute(
        &self,
        state: Arc<AppState>,
        _inputs: &super::InputMap,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> Result<super::OutputMap, NodeExecutionError> {
        let mut path = self.source.clone();

        if self.source.starts_with("http://") || self.source.starts_with("https://") {
            let cache_path = get_data_cache_path(state.clone(), &self.source, &self.format);

            _ = tx
                .send(NodeExecutionMessage::Log {
                    node_id: self.node.id.clone(),
                    run_id: options.run_id.clone(),
                    message: format!("downloading {}", self.source),
                    ts: options.run_start.elapsed().as_micros(),
                })
                .await;
            let url = self.source.clone();
            let mut req = reqwest::Request::new(
                reqwest::Method::GET,
                reqwest::Url::parse(&url).map_err(|e| NodeExecutionError::IoError {
                    node_id: self.node.id.clone(),
                    message: format!("failed to parse url {}: {}", url, e),
                })?,
            );
            if let Some(headers) = self.headers.clone() {
                req.headers_mut().extend(headers);
            }
            let res = reqwest::get(&url)
                .await
                .map_err(|e| NodeExecutionError::IoError {
                    node_id: self.node.id.clone(),
                    message: format!("request failed for {}: {}", url, e),
                })?;

            let content_length = match res.content_length() {
                Some(content_length) if content_length > 0 => content_length,
                _ => {
                    return Err(NodeExecutionError::IoError {
                        node_id: self.node.id.clone(),
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
            let mut file = File::create(&tmp_path).map_err(|e| NodeExecutionError::IoError {
                node_id: self.node.id.clone(),
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
                                        node_id: self.node.id.clone(),
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
                                node_id: self.node.id.clone(),
                                message: format!("failed to write to temporary file: {}", e),
                            });
                        }
                    }
                }
            }

            _ = tx
                .send(NodeExecutionMessage::Progress {
                    node_id: self.node.id.clone(),
                    run_id: options.run_id.clone(),
                    duration: options.run_start.elapsed().as_micros(),
                    progress: 100_f64,
                    ts: options.run_start.elapsed().as_micros(),
                })
                .await;

            _ = file.flush();
            drop(file);

            _ = std::fs::rename(&tmp_path, &cache_path).map_err(|e| NodeExecutionError::IoError {
                node_id: self.node.id.clone(),
                message: format!(
                    "failed to rename temporary file {} to {}: {}",
                    tmp_path, cache_path, e
                ),
            });
            path = cache_path
        }

        let lf = load_local_lf(&path, &self.format)
            .map_err(|e| NodeExecutionError::Custom(e.to_string()))?;

        _ = tx
            .send(NodeExecutionMessage::Log {
                node_id: self.node.id.clone(),
                run_id: options.run_id.clone(),
                ts: options.run_start.elapsed().as_micros(),
                message: format!("loaded {}", path),
            })
            .await;

        Ok(HashMap::from([(
            DEFAULT_OUTPUT.to_string(),
            NodeExecutionOutput::success(lf),
        )]))
    }
}
