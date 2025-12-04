use std::{collections::HashMap, sync::Arc};
use tauri_plugin_dialog::DialogExt;

use tauri::Emitter;
use tokio::sync::mpsc;

use crate::{
    flow::{
        executor::{NodeExecutionMessage, NodeExecutionPreview, NodeExecutorOptions},
        graph::FlowGraph,
        reader::{NodeReadOutput, NodeReaderOptions},
        Flow, DEFAULT_OUTPUT,
    },
    AppState,
};

#[tauri::command]
pub async fn list_flows(
    state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<super::Flow>, String> {
    let flows = super::repository::find_all(&state)
        .await
        .map_err(|e| e.to_string())?;
    Ok(flows.into_iter().map(|f| f.into()).collect())
}

#[tauri::command]
pub async fn load_flow(
    state: tauri::State<'_, crate::AppState>,
    id: String,
) -> Result<super::Flow, String> {
    let flow = super::repository::load_flow(&state, &id)
        .await
        .map_err(|e| e.to_string())?;
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    *graph = Some(flow.clone().into());
    Ok(flow)
}

#[tauri::command]
pub async fn save_flow(
    state: tauri::State<'_, crate::AppState>,
    flow: super::Flow,
) -> Result<(), String> {
    {
        let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
        *graph = Some(flow.clone().into());
    }
    super::repository::save_flow(&state, &flow)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_flow(
    state: tauri::State<'_, crate::AppState>,
    id: String,
) -> Result<(), String> {
    super::repository::delete(&state, id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn export_flow(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
    id: String,
) -> Result<(), String> {
    let path = tokio::task::spawn_blocking(move || {
        let file_path = app.dialog().file().blocking_save_file();
        file_path.map(|p| p.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
    .unwrap();

    let flow = super::repository::load_flow(&state, &id)
        .await
        .map_err(|e| e.to_string())?;

    let raw = serde_json::to_string_pretty(&flow).map_err(|e| e.to_string())?;
    std::fs::write(path, raw).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn import_flow(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
) -> Result<String, String> {
    let path = tokio::task::spawn_blocking(move || {
        let file_path = app.dialog().file().blocking_pick_file();
        file_path.map(|p| p.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
    .unwrap();

    let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut flow: Flow = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    flow.id = uuid::Uuid::new_v4().to_string();

    super::repository::save_flow(&state, &flow)
        .await
        .map_err(|e| e.to_string())?;

    Ok(flow.id)
}

#[tauri::command]
pub async fn duplicate_flow(
    state: tauri::State<'_, crate::AppState>,
    id: String,
) -> Result<String, String> {
    let flow = super::repository::load_flow(&state, &id)
        .await
        .map_err(|e| e.to_string())?;

    let mut flow = flow.clone();
    flow.id = uuid::Uuid::new_v4().to_string();

    super::repository::save_flow(&state, &flow)
        .await
        .map_err(|e| e.to_string())?;

    Ok(flow.id)
}

#[tauri::command]
pub async fn execute_node(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
    node_id: String,
    options: Option<NodeExecutorOptions>,
) -> Result<HashMap<String, NodeExecutionPreview>, String> {
    let graph = load_graph(&id, &state).await?;

    let state: Arc<AppState> = Arc::new((*state).clone());
    let (tx, mut rx) = mpsc::channel::<NodeExecutionMessage>(100);
    tokio::spawn({
        let app = app.clone();
        async move {
            while let Some(ref msg) = rx.recv().await {
                app.emit("node_execution_message", msg).unwrap();
            }
        }
    });
    let options = options.unwrap_or_default();

    let exec_results = graph
        .execute_node(state, &node_id, Arc::new(options.clone()), tx)
        .await
        .map_err(|e| e.to_string())?;
    let exec_result = exec_results.get(&node_id).ok_or("No result".to_string())?;

    let mut previews = HashMap::new();
    // todo parrallel
    for (key, value) in exec_result.iter() {
        let preview = value
            .as_preview(options.page_size)
            .await
            .map_err(|e| e.to_string())?;
        previews.insert(key.clone(), preview);
    }

    Ok(previews)
}

#[tauri::command]
pub async fn read_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
    node_id: String,
    options: Option<NodeReaderOptions>,
) -> Result<NodeReadOutput, String> {
    let graph = load_graph(&id, &state).await?;

    let state: Arc<AppState> = Arc::new((*state).clone());

    let (tx, mut rx) = mpsc::channel::<NodeExecutionMessage>(100);
    tokio::spawn({
        let app = app.clone();
        async move {
            while let Some(ref msg) = rx.recv().await {
                app.emit("node_execution_message", msg).unwrap();
            }
        }
    });

    graph
        .read_data(state, &node_id, options, tx)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_node_data(
    state: tauri::State<'_, AppState>,
    id: String,
    node_id: String,
) -> Result<(), String> {
    let graph = load_graph(&id, &state).await?;
    let node = graph.nodes.get(&node_id).ok_or("Node not found")?;

    let state: Arc<AppState> = Arc::new((*state).clone());
    super::node::delete_node_data(state, &id, (*node).as_ref()).map_err(|e| e.to_string())?;
    Ok(())
}

async fn load_graph(id: &str, state: &tauri::State<'_, AppState>) -> Result<FlowGraph, String> {
    let loaded_graph = {
        let guard = state.graph.lock().map_err(|e| e.to_string())?;
        guard.as_ref().filter(|g| g.id == id).cloned()
    };

    let graph = match loaded_graph {
        Some(graph) => graph,
        None => super::repository::load_flow(state, id)
            .await
            .map_err(|e| e.to_string())?
            .into(),
    };

    Ok(graph)
}
