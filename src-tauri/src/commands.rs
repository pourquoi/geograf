use crate::{
    demo::Demo,
    expressions::{ast_to_expr, parse_program},
    flow::{DataFormat, Flow},
    loader::Loader,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::{
    collections::HashMap,
    io::{BufReader, Read},
    sync::Arc,
};
use std::{fs::File, io::Write};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::{reveal_item_in_dir, OpenerExt};
use tauri_plugin_os::platform;

use tauri::{AppHandle, Emitter, Manager};
use tokio::{sync::mpsc, task::JoinSet};

use crate::{
    dag::FlowGraph,
    demo::DEMOS,
    executor::{NodeExecutionMessage, NodeExecutionPreview, NodeExecutorOptions},
    reader::{NodeReadOutput, NodeReaderOptions},
    AppState,
};

#[tauri::command]
pub async fn pick_file(app: tauri::AppHandle) -> Option<String> {
    tokio::task::spawn_blocking(move || {
        let file_path = app.dialog().file().blocking_pick_file();
        file_path.map(|p| p.to_string())
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn save_file(app: tauri::AppHandle) -> Option<String> {
    tokio::task::spawn_blocking(move || {
        let file_path = app.dialog().file().blocking_save_file();
        file_path.map(|p| p.to_string())
    })
    .await
    .unwrap()
}

#[tauri::command]
pub async fn has_node_file(
    state: tauri::State<'_, crate::AppState>,
    flow_id: String,
    node_id: String,
) -> Result<Option<(String, DataFormat)>, String> {
    let graph = load_graph(&flow_id, &state).await.unwrap();
    let node = graph.nodes.get(&node_id).ok_or("Node not found")?;
    let state = AppState::from_tauri(state);
    if node.has_local_file(state.clone()) {
        Ok(node.get_local_path(state))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn open_node_file(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
    flow_id: String,
    node_id: String,
) -> Result<String, String> {
    let graph = load_graph(&flow_id, &state).await?;

    let node = graph.nodes.get(&node_id).ok_or("Node not found")?;
    let (path, format) = node
        .get_local_path(AppState::from_tauri(state))
        .ok_or("File not found")?;

    let path = match platform() {
        "ios" | "android" => {
            let dl = app.path().download_dir().map_err(|e| e.to_string())?;
            let dl = dl.join(format!("{}.{}", node_id, format));

            std::fs::copy(&path, &dl).map_err(|e| e.to_string())?;
            dl.to_string_lossy().to_string()
        }
        _ => {
            reveal_item_in_dir(&path).map_err(|e| e.to_string())?;
            path
        }
    };

    app.opener()
        .open_path(&path, None::<&str>)
        .map_err(|e| e.to_string())?;

    Ok(path)
}

#[tauri::command]
pub async fn stream_file(app: AppHandle, path: String, event_id: String) -> Result<(), String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);

    let mut buffer = vec![0u8; 64 * 1024];

    loop {
        let n = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }

        let chunk = STANDARD.encode(&buffer[..n]);

        app.emit(&format!("stream:{}:chunk", event_id), chunk)
            .map_err(|e| e.to_string())?;
    }

    app.emit(&format!("stream:{}:end", event_id), ())
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn upload_start(
    state: tauri::State<'_, crate::AppState>,
    name: String,
    format: DataFormat,
) -> Result<String, String> {
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
        name,
        format.to_string()
    );

    let file = File::create(&path).map_err(|e| e.to_string())?;

    state.uploads.lock().unwrap().insert(name.clone(), file);

    return Ok(path.to_string());
}

#[tauri::command]
pub async fn upload_chunk(
    state: tauri::State<'_, crate::AppState>,
    name: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut uploads = state.uploads.lock().unwrap();
    let file = uploads
        .get_mut(&name)
        .ok_or(format!("Transfer error: {} not found", name))?;
    file.write_all(&data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn upload_end(
    state: tauri::State<'_, crate::AppState>,
    name: String,
) -> Result<(), String> {
    let mut uploads = state.uploads.lock().unwrap();
    let file = uploads
        .get_mut(&name)
        .ok_or("Uploader error: File not found")?;
    file.flush().map_err(|e| e.to_string())?;
    uploads.remove(&name);
    Ok(())
}

#[tauri::command]
pub async fn list_flows(state: tauri::State<'_, crate::AppState>) -> Result<Vec<Flow>, String> {
    let flows = super::repository::find_all(&state)
        .await
        .map_err(|e| e.to_string())?;
    Ok(flows.into_iter().map(|f| f.into()).collect())
}

#[tauri::command]
pub async fn load_flow(
    state: tauri::State<'_, crate::AppState>,
    id: String,
) -> Result<Flow, String> {
    let flow = super::repository::load_flow(&state, &id)
        .await
        .map_err(|e| e.to_string())?;
    let mut graph = state.graph.lock().map_err(|e| e.to_string())?;
    *graph = Some(flow.clone().into());
    Ok(flow)
}

#[tauri::command]
pub async fn save_flow(state: tauri::State<'_, crate::AppState>, flow: Flow) -> Result<(), String> {
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
    let flow = super::repository::load_flow(&state, &id)
        .await
        .map_err(|e| e.to_string())?;

    super::repository::delete(&state, &id)
        .await
        .map_err(|e| e.to_string())?;

    let state = AppState::from_tauri(state);
    flow.nodes.iter().for_each(|n| {
        _ = crate::loader::delete_node_data(state.clone(), &id, n);
    });

    Ok(())
}

// deprecated
// use client download instead
#[tauri::command]
pub async fn export_flow(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
    id: String,
) -> Result<String, String> {
    let path: String;
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        path = format!(
            "{}/{}.json",
            state
                .app_dir
                .as_ref()
                .unwrap()
                .clone()
                .into_os_string()
                .to_str()
                .unwrap(),
            id
        );
    }
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        path = tokio::task::spawn_blocking(move || {
            let file_path = app.dialog().file().blocking_save_file();
            file_path.map(|p| p.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
        .unwrap();
    }

    let flow = super::repository::load_flow(&state, &id)
        .await
        .map_err(|e| e.to_string())?;

    let raw = serde_json::to_string_pretty(&flow).map_err(|e| e.to_string())?;

    std::fs::write(&path, raw).map_err(|e| e.to_string())?;

    Ok(path)
}

#[tauri::command]
pub async fn import_flow(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::AppState>,
    content: Option<Vec<u8>>,
) -> Result<String, String> {
    let mut flow: Flow;
    if let Some(content) = content {
        flow = serde_json::from_slice(&content).map_err(|e| e.to_string())?;
        flow.id = uuid::Uuid::new_v4().to_string();
    } else {
        let path = tokio::task::spawn_blocking(move || {
            let file_path = app.dialog().file().blocking_pick_file();
            file_path.map(|p| p.to_string())
        })
        .await
        .map_err(|e| e.to_string())?
        .unwrap();

        let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
        flow = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    }

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
    let node_exec_result = exec_results.get(&node_id).ok_or("No result".to_string())?;
    let node_exec_result = node_exec_result.clone();

    let tasks: JoinSet<_> = node_exec_result
        .into_iter()
        .map(|(id, exec_output)| async move {
            let preview = exec_output
                .as_preview(options.page_size)
                .await
                .map_err(|e| e.to_string())?;
            Ok((id.clone(), preview))
        })
        .collect();

    let results: Vec<anyhow::Result<(String, NodeExecutionPreview), String>> =
        tasks.join_all().await;

    results.into_iter().collect()
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
    crate::loader::delete_node_data(state, &id, (*node).as_ref()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn check_syntax(expr: String) -> Result<(), String> {
    let ast = parse_program(&expr).map_err(|e| e.to_string())?;
    let _expr = ast_to_expr(&ast).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_demos() -> Vec<Demo> {
    DEMOS.to_vec()
}

#[tauri::command]
pub async fn load_demo(
    state: tauri::State<'_, crate::AppState>,
    demo_name: String,
    flow_name: String,
) -> Result<String, String> {
    let Some(demo) = DEMOS.iter().find(|d| d.name == demo_name) else {
        return Err("Demo not found".to_string());
    };

    let mut flow: Flow = serde_json::from_str(&demo.flow).map_err(|e| e.to_string())?;
    flow.id = uuid::Uuid::new_v4().to_string();
    flow.name = flow_name;

    save_flow(state, flow.clone())
        .await
        .map_err(|e| e.to_string())?;

    Ok(flow.id)
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
