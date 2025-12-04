use crate::flow::{commands::save_flow, Flow};
use ts_rs::TS;

lazy_static::lazy_static! {
    static ref DEMOS: Vec<Demo> = vec![
        Demo {
            name: "Titanic dataset".to_string(),
            flow: include_str!("../data-demo/titanic-flow.json").to_string(),
            description: "Titanic dataset".to_string(),
            category: DemoCategory::Exploration,
        },
        Demo {
            name: "Flights 2016 dataset".to_string(),
            flow: include_str!("../data-demo/flights-flow.json").to_string(),
            description: "Flights 2016 dataset".to_string(),
            category: DemoCategory::Exploration,
        },

        Demo {
            name: "Convert JSON / CSV".to_string(),
            flow: include_str!("../data-demo/json-csv-flow.json").to_string(),
            description: "JSON to CSV".to_string(),
            category: DemoCategory::Basic,
        },
        Demo {
            name: "Concat 2 datasets".to_string(),
            flow: include_str!("../data-demo/concat-flow.json").to_string(),
            description: "Concat 2 datasets".to_string(),
            category: DemoCategory::Basic,
        },

        Demo {
            name: "Describe dataset".to_string(),
            flow: include_str!("../data-demo/concat-flow.json").to_string(),
            description: "Concat 2 datasets".to_string(),
            category: DemoCategory::Stats,
        },
    ];
}

#[derive(Clone, serde::Serialize, TS)]
pub enum DemoCategory {
    Basic,
    Stats,
    Exploration,
}

#[derive(Clone, serde::Serialize, TS)]
#[ts(export)]
pub struct Demo {
    pub name: String,
    pub description: String,
    pub category: DemoCategory,
    pub flow: String,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_demos_format() {
        let demos = DEMOS.to_vec();
        for demo in demos {
            let flow: Flow = serde_json::from_str(&demo.flow).unwrap();
            assert!(flow.id.len() > 0);
            assert!(flow.name.len() > 0);
            assert!(flow.nodes.len() > 0);
            assert!(flow.edges.len() > 0);
        }
    }
}
