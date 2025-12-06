use std::{
    collections::HashMap,
    env,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::RwLock;

use crate::flow::OutputMap;

mod commands;
mod dag;
mod demo;
mod executor;
mod expressions;
mod flow;
mod loader;
mod reader;
mod repository;

#[derive(Clone)]
pub struct AppState {
    pub db: repository::Database,
    pub graph: Arc<Mutex<Option<flow::FlowGraph>>>,
    pub app_dir: Option<PathBuf>,
    pub output_cache: Arc<RwLock<HashMap<String, OutputMap>>>,
}

#[tauri::command]
async fn pick_file(app: tauri::AppHandle) -> Option<String> {
    tokio::task::spawn_blocking(move || {
        let file_path = app.dialog().file().blocking_pick_file();
        file_path.map(|p| p.to_string())
    })
    .await
    .unwrap()
}

#[tauri::command]
async fn save_file(app: tauri::AppHandle) -> Option<String> {
    tokio::task::spawn_blocking(move || {
        let file_path = app.dialog().file().blocking_save_file();
        file_path.map(|p| p.to_string())
    })
    .await
    .unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir()?;
            let db_path = app_dir.join("db.sqlite");
            let reset = env::var("RESET_DB").is_ok_and(|v| v == "1");

            let db = tauri::async_runtime::block_on(async {
                repository::Database::try_new(db_path, reset).await
            })?;
            app.manage(AppState {
                db,
                graph: Arc::new(Mutex::new(None)),
                app_dir: Some(app_dir),
                output_cache: Default::default(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_file,
            save_file,
            commands::list_flows,
            commands::load_flow,
            commands::save_flow,
            commands::delete_flow,
            commands::execute_node,
            commands::read_data,
            commands::delete_node_data,
            commands::export_flow,
            commands::import_flow,
            commands::duplicate_flow,
            commands::check_syntax,
            commands::list_demos,
            commands::load_demo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
