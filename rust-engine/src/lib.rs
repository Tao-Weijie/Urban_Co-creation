use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use once_cell::sync::Lazy;

pub mod structure;
pub mod game;

use structure::{UrbanGraph, UrbanUnit, EvaluateMetrics, Metadata, Block};
use game::{evaluate, get_valid_actions_impl, apply_action, finalize_metadata};


// Global persistent states (Mutex wrapped, safe in single-threaded JS runtime)
static ACTIVE_GAME_GRAPH: Lazy<Mutex<Option<UrbanGraph>>> = Lazy::new(|| Mutex::new(None));
static ACTIVE_GAME_VALID_ACTIONS: Lazy<Mutex<Vec<Vec<Option<i32>>>>> = Lazy::new(|| Mutex::new(Vec::new()));

static TRAINING_GRAPH: Lazy<Mutex<Option<UrbanGraph>>> = Lazy::new(|| Mutex::new(None));
static TRAINING_VALID_ACTIONS: Lazy<Mutex<Vec<Vec<Option<i32>>>>> = Lazy::new(|| Mutex::new(Vec::new()));



#[wasm_bindgen]
pub fn initialize_player() -> String {
    r#"{"1":{"name":"Developer","allowed_types":[1],"allowed_actions":[0,1]},"2":{"name":"Government","allowed_types":[2],"allowed_actions":[0,1]}}"#.to_string()
}

#[wasm_bindgen]
pub fn build_game(payload_json_str: &str) -> Result<String, JsValue> {
    let mut graph: UrbanGraph = serde_json::from_str(payload_json_str)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    graph.metadata.game_started = false;
    graph.metadata.timer = 0;
    graph.metadata.player_order = Vec::new();
    
    let metrics = evaluate(&mut graph);
    graph.metadata.evaulate = Some(metrics);
    graph.metadata = finalize_metadata(graph.metadata);
    
    let serialized = serde_json::to_string(&graph)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    // Update global state
    if let Ok(mut lock) = ACTIVE_GAME_GRAPH.lock() {
        *lock = Some(graph);
    }
    if let Ok(mut lock) = ACTIVE_GAME_VALID_ACTIONS.lock() {
        *lock = Vec::new();
    }
    
    Ok(serialized)
}

#[wasm_bindgen]
pub fn start_game(payload_json_str: &str) -> Result<String, JsValue> {
    let mut graph = {
        let lock = ACTIVE_GAME_GRAPH.lock().map_err(|_| JsValue::from_str("Lock error"))?;
        lock.clone().ok_or_else(|| JsValue::from_str("Game session not found. Please upload map grid first."))?
    };
    
    if graph.metadata.game_started {
        return Err(JsValue::from_str("Game has already started. Turn order cannot be modified."));
    }
    
    // Parse order from payload {"player_order": [1, 2]}
    let payload: serde_json::Value = serde_json::from_str(payload_json_str)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    let order_array = payload.get("player_order")
        .and_then(|v| v.as_array())
        .ok_or_else(|| JsValue::from_str("Invalid player_order in payload"))?;
        
    let mut player_order = Vec::new();
    for v in order_array {
        let p = v.as_i64().ok_or_else(|| JsValue::from_str("Invalid player value"))? as i32;
        player_order.push(p);
    }
    
    graph.metadata.player_order = player_order;
    graph.metadata.game_started = true;
    graph.metadata.timer = 0;
    
    let metrics = evaluate(&mut graph);
    graph.metadata.evaulate = Some(metrics);
    graph.metadata = finalize_metadata(graph.metadata);
    
    let valid_actions = get_valid_actions_impl(&graph);
    
    // Update globals
    if let Ok(mut lock) = ACTIVE_GAME_GRAPH.lock() {
        *lock = Some(graph.clone());
    }
    if let Ok(mut lock) = ACTIVE_GAME_VALID_ACTIONS.lock() {
        *lock = valid_actions;
    }
    
    let serialized = serde_json::to_string(&graph)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    Ok(serialized)
}

#[wasm_bindgen]
pub fn run_game_step(payload_json_str: &str) -> Result<String, JsValue> {
    let graph = {
        let lock = ACTIVE_GAME_GRAPH.lock().map_err(|_| JsValue::from_str("Lock error"))?;
        lock.clone().ok_or_else(|| JsValue::from_str("Game session not found. Please start the game first."))?
    };
    
    if !graph.metadata.game_started || graph.metadata.player_order.is_empty() {
        return Err(JsValue::from_str("Game session not started or turn order not defined."));
    }
    
    let valid_actions = {
        let lock = ACTIVE_GAME_VALID_ACTIONS.lock().map_err(|_| JsValue::from_str("Lock error"))?;
        lock.clone()
    };
    
    // Parse action from payload {"action_type": 1, "unit_id": 5, "unit_type": 1}
    let payload: serde_json::Value = serde_json::from_str(payload_json_str)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    let action_type = payload.get("action_type")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| JsValue::from_str("action_type is required"))? as i32;
        
    let unit_id = payload.get("unit_id")
        .and_then(|v| if v.is_null() { None } else { v.as_i64() })
        .map(|n| n as i32);
        
    let unit_type = payload.get("unit_type")
        .and_then(|v| if v.is_null() { None } else { v.as_i64() })
        .map(|n| n as i32)
        .unwrap_or(0); // EMPTY if null
        
    let mut updated_graph = apply_action(graph, &valid_actions, action_type, unit_id, unit_type)
        .map_err(|e| JsValue::from_str(&e))?;
        
    let metrics = evaluate(&mut updated_graph);
    updated_graph.metadata.evaulate = Some(metrics);
    updated_graph.metadata = finalize_metadata(updated_graph.metadata);
    
    let next_valid_actions = get_valid_actions_impl(&updated_graph);
    
    // Update globals
    if let Ok(mut lock) = ACTIVE_GAME_GRAPH.lock() {
        *lock = Some(updated_graph.clone());
    }
    if let Ok(mut lock) = ACTIVE_GAME_VALID_ACTIONS.lock() {
        *lock = next_valid_actions;
    }
    
    let serialized = serde_json::to_string(&updated_graph)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    Ok(serialized)
}

#[wasm_bindgen]
pub fn get_valid_actions(role: i32) -> Result<String, JsValue> {
    let graph = {
        let lock = ACTIVE_GAME_GRAPH.lock().map_err(|_| JsValue::from_str("Lock error"))?;
        lock.clone().ok_or_else(|| JsValue::from_str("Game session not found."))?
    };
    
    if !graph.metadata.game_started || graph.metadata.player_order.is_empty() {
        return Ok(r#"{"actions":[]}"#.to_string());
    }
    
    let active_player = graph.metadata.player_order[0];
    if role != active_player {
        return Ok(r#"{"actions":[]}"#.to_string());
    }
    
    let valid_actions = {
        let lock = ACTIVE_GAME_VALID_ACTIONS.lock().map_err(|_| JsValue::from_str("Lock error"))?;
        lock.clone()
    };
    
    let res = serde_json::json!({
        "actions": valid_actions
    });
    
    Ok(res.to_string())
}

#[wasm_bindgen]
pub fn training_start(payload_json_str: &str) -> Result<String, JsValue> {
    let payload: serde_json::Value = serde_json::from_str(payload_json_str)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    let graph_val = payload.get("graph")
        .ok_or_else(|| JsValue::from_str("graph is required"))?;
        
    let mut graph: UrbanGraph = serde_json::from_value(graph_val.clone())
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
    let order_array = payload.get("player_order")
        .and_then(|v| v.as_array())
        .ok_or_else(|| JsValue::from_str("player_order is required"))?;
        
    let player_order: Vec<i32> = order_array.iter()
        .map(|v| v.as_i64().unwrap_or(0) as i32)
        .collect();
        
    graph.metadata.player_order = player_order;
    graph.metadata.game_started = true;
    graph.metadata.timer = 0;
    
    let metrics = evaluate(&mut graph);
    graph.metadata.evaulate = Some(metrics);
    graph.metadata = finalize_metadata(graph.metadata);
    
    let valid_actions = get_valid_actions_impl(&graph);
    
    // Update globals
    if let Ok(mut lock) = TRAINING_GRAPH.lock() {
        *lock = Some(graph.clone());
    }
    if let Ok(mut lock) = TRAINING_VALID_ACTIONS.lock() {
        *lock = valid_actions;
    }
    
    let res = serde_json::json!({
        "units": graph.units.iter().map(|u| serde_json::json!({"id": u.id, "type": u.r#type, "height": u.height})).collect::<Vec<_>>(),
        "metadata": graph.metadata
    });
    
    Ok(res.to_string())
}

#[wasm_bindgen]
pub fn training_step(action_type: i32, unit_id_val: JsValue, unit_type: i32) -> Result<String, JsValue> {
    let graph = {
        let lock = TRAINING_GRAPH.lock().map_err(|_| JsValue::from_str("Lock error"))?;
        lock.clone().ok_or_else(|| JsValue::from_str("Training graph not initialized."))?
    };
    
    let valid_actions = {
        let lock = TRAINING_VALID_ACTIONS.lock().map_err(|_| JsValue::from_str("Lock error"))?;
        lock.clone()
    };
    
    let unit_id = if unit_id_val.is_null() || unit_id_val.is_undefined() {
        None
    } else {
        unit_id_val.as_f64().map(|n| n as i32)
    };
    
    let mut updated_graph = apply_action(graph, &valid_actions, action_type, unit_id, unit_type)
        .map_err(|e| JsValue::from_str(&e))?;
        
    let metrics = evaluate(&mut updated_graph);
    updated_graph.metadata.evaulate = Some(metrics);
    updated_graph.metadata = finalize_metadata(updated_graph.metadata);
    
    let next_valid_actions = get_valid_actions_impl(&updated_graph);
    
    // Update globals
    if let Ok(mut lock) = TRAINING_GRAPH.lock() {
        *lock = Some(updated_graph.clone());
    }
    if let Ok(mut lock) = TRAINING_VALID_ACTIONS.lock() {
        *lock = next_valid_actions;
    }
    
    let res = serde_json::json!({
        "units": updated_graph.units.iter().map(|u| serde_json::json!({"id": u.id, "type": u.r#type, "height": u.height})).collect::<Vec<_>>(),
        "metadata": updated_graph.metadata
    });
    
    Ok(res.to_string())
}
