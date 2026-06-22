use crate::structure::{UrbanGraph, EvaluateMetrics, Metadata};
use std::collections::HashMap;

pub trait RoundDecimals {
    fn round_to_decimals(self, decimals: i32) -> f64;
}

impl RoundDecimals for f64 {
    fn round_to_decimals(self, decimals: i32) -> f64 {
        let factor = 10f64.powi(decimals);
        (self * factor).round() / factor
    }
}

pub fn evaluate(graph: &mut UrbanGraph) -> EvaluateMetrics {
    // Build block-to-units lookup for fast queries
    let mut block_to_units: HashMap<i32, Vec<usize>> = HashMap::new();
    for (idx, u) in graph.units.iter().enumerate() {
        block_to_units.entry(u.parentid).or_default().push(idx);
    }

    // Build block id to index mapping for neighbors
    let mut block_id_to_idx: HashMap<i32, usize> = HashMap::new();
    for (idx, b) in graph.blocks.iter().enumerate() {
        block_id_to_idx.insert(b.id, idx);
    }

    let get_neighbors = |block_id: i32, graph: &UrbanGraph| -> Vec<i32> {
        if let Some(&idx) = block_id_to_idx.get(&block_id) {
            graph.blocks[idx].neighbor.clone()
        } else {
            Vec::new()
        }
    };

    // Calculate value score for all units
    let mut new_values = vec![0.0; graph.units.len()];
    
    for idx in 0..graph.units.len() {
        let u = &graph.units[idx];
        let parentid = u.parentid;
        
        let empty_vec = Vec::new();
        let same_block_unit_indices = block_to_units.get(&parentid).unwrap_or(&empty_vec);
        
        let total_green_units = same_block_unit_indices.iter()
            .filter(|&&oidx| graph.units[oidx].r#type == 2) // GREEN
            .count() as f64;
            
        let total_residential_units = same_block_unit_indices.iter()
            .filter(|&&oidx| graph.units[oidx].r#type == 1) // RESIDENTIAL
            .count() as f64;

        let mut neighbor_green_units = 0.0;
        let mut neighbor_res_units = 0.0;
        
        let neighbors = get_neighbors(parentid, graph);
        for neighbor_id in neighbors {
            if let Some(neighbor_unit_indices) = block_to_units.get(&neighbor_id) {
                neighbor_green_units += neighbor_unit_indices.iter()
                    .filter(|&&nidx| graph.units[nidx].r#type == 2)
                    .count() as f64;
                neighbor_res_units += neighbor_unit_indices.iter()
                    .filter(|&&nidx| graph.units[nidx].r#type == 1)
                    .count() as f64;
            }
        }

        let u_count_to_subtract = if u.r#type == 1 { 1.0 } else { 0.0 };
        
        let value_green = 40.0 * total_green_units.sqrt() + 20.0 * neighbor_green_units.sqrt();
        
        let r_same = total_residential_units - u_count_to_subtract;
        let value_penalty = 6.0 * r_same + 3.0 * neighbor_res_units;
        
        let val = 30.0 + value_green - value_penalty;
        let final_val = val.max(15.0).min(100.0);
        new_values[idx] = final_val;
    }

    // Apply values back to units
    for idx in 0..graph.units.len() {
        graph.units[idx].value = new_values[idx];
    }

    // Calculate population and financial indicators
    let mu = 60.0;
    let sigma = 20.0;
    let p_max = 150.0;

    let mut total_city_population = 0;
    let mut total_developer_revenue = 0.0;
    let mut total_developer_cost = 0.0;
    let mut total_land_price = 0.0;
    let mut total_tax_revenue = 0.0;

    for u in &mut graph.units {
        if u.r#type == 1 { // RESIDENTIAL
            let v = u.value;
            let exponent = -((v - mu).powi(2)) / (2.0 * sigma.powi(2));
            let pop_per_floor = p_max * exponent.exp();
            let rounded_pop = pop_per_floor.round() as i32 * u.height;
            u.population = rounded_pop as f64;

            total_city_population += rounded_pop;
            total_developer_revenue += rounded_pop as f64 * v * 0.5;
            total_developer_cost += 0.0;
            total_land_price += v * u.height as f64 * 10.0;
            total_tax_revenue += rounded_pop as f64 * 10.0;
        } else {
            u.population = 0.0;
        }
    }

    let developer_net_profit = (total_developer_revenue - total_developer_cost - total_land_price).round_to_decimals(1);
    let government_net_reserve = (total_land_price + total_tax_revenue).round_to_decimals(1);

    EvaluateMetrics {
        government_tax: government_net_reserve.round() as i32,
        developer_profit: developer_net_profit,
        total_population: total_city_population,
    }
}

pub fn get_valid_actions_impl(graph: &UrbanGraph) -> Vec<Vec<Option<i32>>> {
    let mut valid_actions = Vec::new();
    if !graph.metadata.game_started || graph.metadata.player_order.is_empty() {
        return valid_actions;
    }

    let active_player = graph.metadata.player_order[0];
    
    // Player configurations:
    // Developer (1): Allowed types [1] (Residential), actions [0 (Skip), 1 (Place)]
    // Government (2): Allowed types [2] (Green), actions [0 (Skip), 1 (Place)]
    let allowed_actions = if active_player == 1 {
        vec![0, 1] // Skip, Place
    } else if active_player == 2 {
        vec![0, 1] // Skip, Place
    } else {
        Vec::new()
    };

    if allowed_actions.contains(&0) { // SKIP
        valid_actions.push(vec![Some(0), None]);
    }

    let has_place = allowed_actions.contains(&1);
    let has_replace = allowed_actions.contains(&2);

    if has_place || has_replace {
        for unit in &graph.units {
            if has_place && unit.r#type == 0 { // EMPTY
                valid_actions.push(vec![Some(1), Some(unit.id)]);
            } else if has_replace && unit.r#type != 0 {
                valid_actions.push(vec![Some(2), Some(unit.id)]);
            }
        }
    }

    valid_actions
}

pub fn apply_action(
    mut graph: UrbanGraph,
    valid_actions: &[Vec<Option<i32>>],
    action_type: i32,
    unit_id: Option<i32>,
    built_type: i32
) -> Result<UrbanGraph, String> {
    // Validate requested action
    let requested = vec![Some(action_type), unit_id];
    if !valid_actions.contains(&requested) {
        return Err(format!("Action {:?} is not valid in the current state.", requested));
    }

    if action_type == 0 { // SKIP
        graph.metadata.timer += 1;
    } else if action_type == 1 || action_type == 2 { // PLACE or REPLACE
        if let Some(uid) = unit_id {
            if let Some(unit) = graph.units.iter_mut().find(|u| u.id == uid) {
                unit.r#type = built_type;
                graph.metadata.timer += 1;
            } else {
                return Err(format!("Unit with ID {} not found.", uid));
            }
        } else {
            return Err("Unit ID is required for place/replace action.".to_string());
        }
    }

    // Shift player order
    if !graph.metadata.player_order.is_empty() {
        let first = graph.metadata.player_order.remove(0);
        graph.metadata.player_order.push(first);
    }

    Ok(graph)
}

pub fn finalize_metadata(mut metadata: Metadata) -> Metadata {
    if !metadata.player_order.is_empty() {
        let next_player = metadata.player_order[0];
        metadata.next_player = Some(next_player);
        
        if next_player == 1 {
            metadata.valid_type = Some(vec![1]);
            metadata.valid_action = Some(vec![0, 1]);
        } else if next_player == 2 {
            metadata.valid_type = Some(vec![2]);
            metadata.valid_action = Some(vec![0, 1]);
        }
    } else {
        metadata.next_player = None;
        metadata.valid_type = None;
        metadata.valid_action = None;
    }
    metadata
}
