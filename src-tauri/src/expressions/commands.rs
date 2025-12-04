use crate::expressions::{converter::ast_to_expr, parser::parse_program};

#[tauri::command]
pub async fn check_syntax(expr: String) -> Result<(), String> {
    let ast = parse_program(&expr).map_err(|e| e.to_string())?;
    let _expr = ast_to_expr(&ast).map_err(|e| e.to_string())?;
    Ok(())
}
