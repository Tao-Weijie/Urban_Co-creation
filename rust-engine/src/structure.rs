use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UrbanUnit {
    pub id: i32,
    pub parentid: i32,
    pub r#type: i32, // UnitType: 0 (EMPTY), 1 (RESIDENTIAL), 2 (GREEN)
    pub height: i32,
    pub value: f64,
    pub population: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EvaluateMetrics {
    pub government_tax: i32,
    pub developer_profit: f64,
    pub total_population: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Metadata {
    pub game_started: bool,
    pub timer: i32,
    pub player_order: Vec<i32>,
    pub next_player: Option<i32>,
    pub valid_type: Option<Vec<i32>>,
    pub valid_action: Option<Vec<i32>>,
    pub evaulate: Option<EvaluateMetrics>, // Match JS spelling 'evaulate'
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Block {
    pub id: i32,
    pub neighbor: Vec<i32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UrbanGraph {
    pub blocks: Vec<Block>,
    pub units: Vec<UrbanUnit>,
    pub metadata: Metadata,
}
