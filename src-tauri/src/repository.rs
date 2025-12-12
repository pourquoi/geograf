use crate::flow::{Edge, Flow, Node};
use chrono::NaiveDateTime;
use sqlx::prelude::FromRow;
use sqlx::types::Json;
use std::{env, fs, path::PathBuf};

#[derive(Clone)]
pub struct Database {
    pub db: sqlx::SqlitePool,
}

impl Database {
    pub async fn try_new(db_path: PathBuf, reset: bool) -> anyhow::Result<Self> {
        let parent_dir = db_path.parent().unwrap();
        std::fs::create_dir_all(parent_dir)?;

        if reset {
            println!("--- DELETING DATABASE ---");
            fs::remove_file(&db_path).ok();
            fs::remove_file(parent_dir.join("db.sqlite-shm")).ok();
            fs::remove_file(parent_dir.join("db.sqlite-wal")).ok();
        }

        env::set_var("DATABASE_URL", format!("sqlite://{}", db_path.display()));

        println!(
            "--- DATABASE_URL ---\n{}",
            env::var("DATABASE_URL").unwrap()
        );

        let connect_options = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

        let pool = sqlx::SqlitePool::connect_with(connect_options).await?;

        sqlx::migrate!("./migrations").run(&pool).await?;

        Ok(Self { db: pool })
    }
}

#[derive(FromRow)]
pub struct FlowRecord {
    pub id: String,
    pub name: String,
    pub nodes: Json<Vec<Node>>,
    pub edges: Json<Vec<Edge>>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

impl From<FlowRecord> for Flow {
    fn from(record: FlowRecord) -> Self {
        Self {
            id: record.id,
            name: record.name,
            nodes: record.nodes.0,
            edges: record.edges.0,
            created_at: record.created_at.and_utc(),
            updated_at: record.updated_at.and_utc(),
        }
    }
}

pub async fn find_all(state: &crate::AppState) -> anyhow::Result<Vec<FlowRecord>> {
    let projects = sqlx::query_as!(
            FlowRecord, 
            r#"SELECT id, name, nodes as "nodes: Json<Vec<Node>>", edges as "edges: Json<Vec<Edge>>", created_at, updated_at FROM flow ORDER BY updated_at DESC"#,
        )
        .fetch_all(&state.db.db)
        .await?;
    Ok(projects.into_iter().map(|r| r.into()).collect())
}

pub async fn load_flow(state: &crate::AppState, id: &str) -> anyhow::Result<Flow> {
    let record =    sqlx::query_as!(
        FlowRecord,
        r#"SELECT id, name, nodes as "nodes: Json<Vec<Node>>", edges as "edges: Json<Vec<Edge>>", created_at, updated_at FROM flow WHERE id = ?"#,
        id
    )
    .fetch_one(&state.db.db)
    .await?;

    Ok(record.into())
}

pub async fn save_flow(state: &crate::AppState, flow: &Flow) -> anyhow::Result<()> {
    let existing = load_flow(state, &flow.id).await;
    let nodes = serde_json::to_string(&flow.nodes).unwrap();
    let edges = serde_json::to_string(&flow.edges).unwrap();
    if existing.is_ok() {
        let updated_at = flow.updated_at.naive_utc();
        sqlx::query!(
            "UPDATE flow SET name = ?, nodes = ?, edges = ?, updated_at = ? WHERE id = ?",
            flow.name,
            nodes,
            edges,
            updated_at,
            flow.id
        )
        .execute(&state.db.db)
        .await?;
    } else {
        sqlx::query!(
            "INSERT INTO flow (id, name, nodes, edges) VALUES (?, ?, ?, ?)",
            flow.id,
            flow.name,
            nodes,
            edges
        )
        .execute(&state.db.db)
        .await?;
    }

    Ok(())
}

pub async fn delete(state: &crate::AppState, id: &str) -> anyhow::Result<()> {
    sqlx::query!("DELETE FROM flow WHERE id = ?", id)
        .execute(&state.db.db)
        .await?;
    Ok(())
}
