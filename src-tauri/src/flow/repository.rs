use super::{Edge, Flow, Node};
use sqlx::prelude::FromRow;
use sqlx::types::Json;

#[derive(FromRow)]
pub struct FlowRecord {
    pub id: String,
    pub name: String,
    pub nodes: Json<Vec<Node>>,
    pub edges: Json<Vec<Edge>>,
}

impl From<FlowRecord> for Flow {
    fn from(record: FlowRecord) -> Self {
        Self {
            id: record.id,
            name: record.name,
            nodes: record.nodes.0,
            edges: record.edges.0,
        }
    }
}

pub async fn find_all(state: &crate::AppState) -> anyhow::Result<Vec<FlowRecord>> {
    let projects = sqlx::query_as!(
            FlowRecord, 
            r#"SELECT id, name, nodes as "nodes: Json<Vec<Node>>", edges as "edges: Json<Vec<Edge>>" FROM flow"#,
        )
        .fetch_all(&state.db.db)
        .await?;
    Ok(projects.into_iter().map(|r| r.into()).collect())
}

pub async fn load_flow(state: &crate::AppState, id: &str) -> anyhow::Result<Flow> {
    let record =    sqlx::query_as!(
        FlowRecord,
        r#"SELECT id, name, nodes as "nodes: Json<Vec<Node>>", edges as "edges: Json<Vec<Edge>>" FROM flow WHERE id = ?"#,
        id
    )
    .fetch_one(&state.db.db)
    .await?;

    Ok(record.into())
}

pub async fn save_flow(state: &crate::AppState, flow: &super::Flow) -> anyhow::Result<()> {
    let existing = load_flow(state, &flow.id).await;
    let nodes = serde_json::to_string(&flow.nodes).unwrap();
    let edges = serde_json::to_string(&flow.edges).unwrap();
    if existing.is_ok() {
        sqlx::query!(
            "UPDATE flow SET name = ?, nodes = ?, edges = ? WHERE id = ?",
            flow.name,
            nodes,
            edges,
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

pub async fn delete(state: &crate::AppState, id: String) -> anyhow::Result<()> {
    sqlx::query!("DELETE FROM flow WHERE id = ?", id)
        .execute(&state.db.db)
        .await?;
    Ok(())
}
