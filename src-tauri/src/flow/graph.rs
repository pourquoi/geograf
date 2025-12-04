use crate::{
    flow::{
        executor::{
            load_cached_execution, InputMap, NodeExecutionMessage, NodeExecutionOutput,
            NodeExecutorOptions, OutputMap,
        },
        reader::{NodeReadOutput, NodeReader, NodeReaderOptions},
        Flow, DEFAULT_OUTPUT,
    },
    AppState,
};
use anyhow::Context;
use uuid::Uuid;

use super::{Edge, Node};
use std::{collections::HashMap, future::Future, pin::Pin, sync::Arc, time::Instant};
use tokio::{
    sync::{mpsc, Mutex},
    task::JoinSet,
};

#[derive(Debug, Clone)]
pub struct FlowGraph {
    pub id: String,
    pub nodes: HashMap<String, Arc<Node>>,
    pub outbound: HashMap<String, Vec<Arc<Edge>>>,
    pub inbound: HashMap<String, Vec<Arc<Edge>>>,
}

impl From<Flow> for FlowGraph {
    fn from(flow: Flow) -> Self {
        Self::new(flow.id, flow.nodes, flow.edges)
    }
}

impl FlowGraph {
    pub fn new(id: String, nodes: Vec<Node>, edges: Vec<Edge>) -> Self {
        let nodes: HashMap<_, _> = nodes
            .into_iter()
            .map(|n| (n.id.clone(), Arc::new(n)))
            .collect();

        let edges: Vec<Arc<Edge>> = edges.into_iter().map(Arc::new).collect();

        let mut outbound = HashMap::new();
        let mut inbound = HashMap::new();

        for n in nodes.values() {
            outbound.insert(n.id.clone(), vec![]);
            inbound.insert(n.id.clone(), vec![]);
        }

        for e in &edges {
            if let Some(outbound) = outbound.get_mut(&e.source) {
                outbound.push(e.clone());
            }
            if let Some(inbound) = inbound.get_mut(&e.target) {
                inbound.push(e.clone());
            }
        }

        Self {
            id,
            nodes,
            outbound,
            inbound,
        }
    }

    pub async fn read_data(
        self,
        state: Arc<AppState>,
        target_node_id: &str,
        options: Option<NodeReaderOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> anyhow::Result<NodeReadOutput> {
        let options = options.unwrap_or_default();

        let exec_options = Arc::new(NodeExecutorOptions {
            run_id: Uuid::new_v4().to_string(),
            page: 1,
            page_size: 1,
            diagnostic: false,
            run_start: Instant::now(),
        });

        let exec_results = self
            .execute_node(state, target_node_id, exec_options, tx)
            .await?;
        let exec_result = exec_results
            .get(target_node_id)
            .context("Output not found for node".to_string())?;
        let exec_result = exec_result
            .get(options.output.as_str())
            .context("No result".to_string())?;
        let df = exec_result
            .df
            .as_ref()
            .context("Empty data for node".to_string())?;

        let output = NodeReadOutput::try_from_df(df.clone(), &options).await?;
        Ok(output)
    }

    pub async fn execute_node(
        self,
        state: Arc<AppState>,
        target_node_id: &str,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> anyhow::Result<HashMap<String, OutputMap>> {
        let graph = Arc::new(self.clone());
        let cache = Arc::new(Mutex::new(HashMap::new()));

        graph
            .execute_recursive(
                state,
                target_node_id.to_owned(),
                cache.clone(),
                options,
                tx.clone(),
                target_node_id.to_string().clone(),
            )
            .await?;

        let cache = cache.lock().await;
        Ok(cache.clone())
    }

    pub async fn execute_all(
        self,
        state: Arc<AppState>,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
    ) -> anyhow::Result<HashMap<String, OutputMap>> {
        let graph = Arc::new(self.clone());
        let cache = Arc::new(Mutex::new(HashMap::new()));
        let sinks: Vec<String> = self.find_sinks();

        let tasks: JoinSet<_> = sinks
            .into_iter()
            .map(|id| {
                let graph = graph.clone();
                let state = state.clone();
                let cache = cache.clone();
                let options = options.clone();
                let id = id.clone();
                let tx = tx.clone();
                async move {
                    graph
                        .execute_recursive(state, id.clone(), cache, options, tx, id.clone())
                        .await
                        .map(|out| (id, out))
                }
            })
            .collect();

        let res = tasks.join_all().await;
        res.into_iter().collect()
    }

    fn execute_recursive(
        self: Arc<Self>,
        state: Arc<AppState>,
        node_id: String,
        cache: Arc<Mutex<HashMap<String, HashMap<String, NodeExecutionOutput>>>>,
        options: Arc<NodeExecutorOptions>,
        tx: mpsc::Sender<NodeExecutionMessage>,
        root_node_id: String,
    ) -> Pin<Box<dyn Future<Output = anyhow::Result<OutputMap>> + Send + 'static>> {
        Box::pin(async move {
            {
                let guard = cache.lock().await;
                if let Some(output) = guard.get(&node_id) {
                    return Ok(output.clone());
                }
            }

            let node = self
                .nodes
                .get(&node_id)
                .context(format!("Node '{}' not found", node_id))?
                .clone();

            if options.diagnostic || root_node_id == node_id {
                let msg = NodeExecutionMessage::Queued {
                    node_id: node_id.clone(),
                    run_id: options.run_id.clone(),
                    ts: options.run_start.elapsed().as_micros(),
                };
                _ = tx.send(msg).await;
            } else {
                let msg = NodeExecutionMessage::Piped {
                    node_id: node_id.clone(),
                    run_id: options.run_id.clone(),
                    ts: options.run_start.elapsed().as_micros(),
                };
                _ = tx.send(msg).await;
            }

            if root_node_id != node_id {
                if let Some(output) =
                    load_cached_execution(node.as_ref(), state.clone(), options.clone(), tx.clone())
                        .await
                {
                    {
                        let mut guard = cache.lock().await;
                        guard.insert(node_id.to_string(), output.clone());
                    }

                    return Ok(output);
                }
            }

            let mut inputs_by_handle: InputMap = HashMap::new();

            if let Some(edges) = self.inbound.get(&node_id) {
                let mut handles = Vec::new();

                for edge in edges {
                    let handle = tokio::spawn({
                        let graph = self.clone();
                        let state = state.clone();
                        let cache = cache.clone();
                        let options = options.clone();
                        let tx = tx.clone();
                        let edge = edge.clone();
                        let root_node_id = root_node_id.clone();
                        async move {
                            let output = graph
                                .clone()
                                .execute_recursive(
                                    state,
                                    edge.source.clone(),
                                    cache,
                                    options,
                                    tx,
                                    root_node_id,
                                )
                                .await;
                            (edge, output)
                        }
                    });
                    handles.push(handle);
                }

                let res = futures::future::join_all(handles).await;
                for res in res.into_iter() {
                    let res = res?;

                    let handle = res.0.target_handle.clone().unwrap_or_default();
                    let source = res
                        .0
                        .source_handle
                        .clone()
                        .unwrap_or(DEFAULT_OUTPUT.to_string());

                    if let Some(output) = res.1?.get(&source) {
                        inputs_by_handle
                            .entry(handle.clone())
                            .or_insert(output.clone());
                    }
                }
            }

            let output = crate::flow::executor::execute_node(
                node.as_ref(),
                state,
                inputs_by_handle,
                options,
                tx.clone(),
                root_node_id.clone() == node_id,
            )
            .await;

            {
                let mut guard = cache.lock().await;
                guard.insert(node_id.to_string(), output.clone());
            }

            Ok(output)
        })
    }

    pub fn find_sinks(&self) -> Vec<String> {
        self.outbound
            .iter()
            .filter(|(_, edges)| edges.is_empty())
            .map(|(id, _)| id.clone())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use tempfile::NamedTempFile;

    use super::*;
    use crate::flow::Flow;

    const FLOW_DUMMY: &str = include_str!("../../data-test/flow_test_unknown.json");
    const FLOW_SELECT: &str = include_str!("../../data-test/flow_test_select.json");
    const FLOW_JOIN: &str = include_str!("../../data-test/flow_test_join.json");

    #[test]
    fn test_find_sinks() {
        let flow = serde_json::from_str::<Flow>(FLOW_DUMMY).unwrap();
        let graph = FlowGraph::new("foo".to_string(), flow.nodes, flow.edges);
        let sinks = graph.find_sinks();

        assert!(sinks.len() == 1);
    }

    #[test]
    fn test_load_flow() {
        let flow = serde_json::from_str::<Flow>(FLOW_DUMMY).unwrap();
        let graph = FlowGraph::new("foo".to_string(), flow.nodes, flow.edges);

        assert_eq!(graph.outbound["1"].len(), 1);
        assert_eq!(graph.outbound["2"].len(), 2);
        assert_eq!(graph.outbound["3"].len(), 0);

        assert_eq!(graph.inbound["1"].len(), 0);
        assert_eq!(graph.inbound["2"].len(), 1);
        assert_eq!(graph.inbound["3"].len(), 2);
    }

    #[tokio::test]
    async fn test_execute_node() {
        let flow = serde_json::from_str::<Flow>(FLOW_SELECT).unwrap();
        let graph = FlowGraph::new("foo".to_string(), flow.nodes, flow.edges);
        let tempfile = NamedTempFile::new().unwrap();
        let state = Arc::new(AppState {
            db: crate::db::Database::try_new(tempfile.path().to_path_buf(), true)
                .await
                .unwrap(),
            graph: Arc::new(Mutex::new(Some(graph.clone()))),
            app_dir: None,
            output_cache: Default::default(),
        });
        let options = Arc::new(NodeExecutorOptions::default());
        let (tx, _) = mpsc::channel::<NodeExecutionMessage>(100);
        let res = graph.execute_node(state, "1", options, tx).await.unwrap();

        let df = res.get("1").unwrap().get("").unwrap().df.as_ref();
        assert!(df.is_some());

        let df = df.unwrap().clone();
        let df = tokio::task::spawn_blocking(move || df.collect().unwrap())
            .await
            .unwrap();

        assert!(df.height() > 0);
    }

    #[tokio::test]
    async fn test_execute_all() {
        let flow = serde_json::from_str::<Flow>(FLOW_SELECT).unwrap();
        let graph = FlowGraph::new("foo".to_string(), flow.nodes, flow.edges);
        let tempfile = NamedTempFile::new().unwrap();
        let state = Arc::new(AppState {
            db: crate::db::Database::try_new(tempfile.path().to_path_buf(), true)
                .await
                .unwrap(),
            graph: Arc::new(Mutex::new(Some(graph.clone()))),
            app_dir: None,
            output_cache: Default::default(),
        });
        let options = Arc::new(NodeExecutorOptions::default());
        let (rx, _) = mpsc::channel::<NodeExecutionMessage>(100);
        let res = graph.execute_all(state, options, rx).await.unwrap();

        let errors = res.get("2").unwrap().get("").unwrap().errors.clone();
        assert!(errors.is_empty());

        let df = res.get("2").unwrap().get("").unwrap().df.as_ref();
        assert!(df.is_some());

        let df = df.unwrap().clone();
        let df = tokio::task::spawn_blocking(move || df.collect().unwrap())
            .await
            .unwrap();

        assert!(df.height() > 0);
    }

    #[tokio::test]
    async fn test_execute_join() {
        let flow = serde_json::from_str::<Flow>(FLOW_JOIN).unwrap();
        let graph = FlowGraph::new("foo".to_string(), flow.nodes, flow.edges);
        let tempfile = NamedTempFile::new().unwrap();
        let state = Arc::new(AppState {
            db: crate::db::Database::try_new(tempfile.path().to_path_buf(), true)
                .await
                .unwrap(),
            graph: Arc::new(Mutex::new(Some(graph.clone()))),
            app_dir: None,
            output_cache: Default::default(),
        });
        let options = Arc::new(NodeExecutorOptions::default());
        let (tx, _) = mpsc::channel::<NodeExecutionMessage>(100);
        let res = graph.execute_node(state, "3", options, tx).await.unwrap();

        let errors = res.get("3").unwrap().get("").unwrap().errors.clone();
        assert!(errors.is_empty());

        let df = res.get("3").unwrap().get("").unwrap().df.as_ref();
        assert!(df.is_some());

        let df = df.unwrap().clone();
        let df = tokio::task::spawn_blocking(move || df.collect().unwrap())
            .await
            .unwrap();

        assert!(df.height() > 0);
    }
}
