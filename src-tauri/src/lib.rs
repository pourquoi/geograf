use std::{
    collections::HashMap,
    env,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::Manager;
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
    pub uploads: Arc<Mutex<HashMap<String, std::fs::File>>>,
}

impl AppState {
    pub fn from_tauri(state: tauri::State<'_, Self>) -> Arc<Self> {
        Arc::new((*state).clone())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
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
                uploads: Default::default(),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pick_file,
            commands::save_file,
            commands::open_node_file,
            commands::has_node_file,
            commands::stream_file,
            commands::upload_start,
            commands::upload_chunk,
            commands::upload_end,
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
