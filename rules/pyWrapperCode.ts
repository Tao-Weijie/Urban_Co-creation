export const pyWrapperCode = `import json
import sys
if '/home/pyodide' not in sys.path:
    sys.path.append('/home/pyodide')

from backend.game import GameEngine
from backend.graph import UrbanGraph, PlayerType, ActionType, UnitType

# Global state
active_game_graph = None
active_game_valid_actions = []

def initialize_player():
    serialized_config = {}
    for role_enum, config in GameEngine.PLAYER_CONFIG.items():
        serialized_config[str(int(role_enum))] = {
            "name": config[0],
            "allowed_types": [int(b) for b in config[1]],
            "allowed_actions": [int(b) for b in config[2]]
        }
    return json.dumps(serialized_config)

def build_game(payload_json_str):
    global active_game_graph, active_game_valid_actions
    payload_dict = json.loads(payload_json_str)
    
    graph = GameEngine.build_game(payload_dict)
    metrics = GameEngine.evaluate(graph)
    updated_data = graph.to_json()
    
    active_game_graph = graph
    active_game_valid_actions = []
    
    metadata = updated_data["metadata"]
    metadata["evaulate"] = {
        "government_tax": metrics["government_tax"],
        "developer_profit": metrics["developer_profit"],
        "total_population": metrics["total_population"]
    }
    return json.dumps({
        "units": updated_data["units"],
        "metadata": metadata
    })

def start_game(payload_json_str):
    global active_game_graph, active_game_valid_actions
    if active_game_graph is None:
        raise ValueError("Game session not found. Please upload map grid first.")
        
    payload_dict = json.loads(payload_json_str)
    player_order = payload_dict["player_order"]
    
    # Strict validation of role types
    for r in player_order:
        PlayerType(r)
        
    graph = GameEngine.start_game(active_game_graph, player_order)
    metrics = GameEngine.evaluate(graph)
    active_game_graph = graph
    active_game_valid_actions = GameEngine.get_valid_actions(graph)
    
    updated_data = graph.to_json()
    metadata = updated_data["metadata"]
    metadata["evaulate"] = {
        "government_tax": metrics["government_tax"],
        "developer_profit": metrics["developer_profit"],
        "total_population": metrics["total_population"]
    }
    return json.dumps({
        "units": updated_data["units"],
        "metadata": metadata
    })

def run_game_step(payload_json_str):
    global active_game_graph, active_game_valid_actions
    if active_game_graph is None:
        raise ValueError("Game session not found. Please start the game first.")
    if not active_game_graph.game_started or not active_game_graph.player_order:
        raise ValueError("Game session not started or turn order not defined.")
        
    payload_dict = json.loads(payload_json_str)
    action_type = ActionType(payload_dict["action_type"])
    requested_action = [int(action_type), payload_dict.get("unit_id")]
    
    if requested_action not in active_game_valid_actions:
        raise ValueError(f"Action {requested_action} is not valid in the current state.")
        
    unit_type_val = payload_dict.get("unit_type")
    built_type = UnitType(unit_type_val) if unit_type_val is not None else UnitType.EMPTY
    
    new_graph = GameEngine.action(
        active_game_graph,
        active_game_valid_actions,
        action_type,
        payload_dict.get("unit_id"),
        built_type
    )
    
    metrics = GameEngine.evaluate(new_graph)
    active_game_graph = new_graph
    active_game_valid_actions = GameEngine.get_valid_actions(new_graph)
    
    updated_data = active_game_graph.to_json()
    metadata = updated_data["metadata"]
    metadata["evaulate"] = {
        "government_tax": metrics["government_tax"],
        "developer_profit": metrics["developer_profit"],
        "total_population": metrics["total_population"]
    }
    return json.dumps({
        "units": updated_data["units"],
        "metadata": metadata
    })

def get_valid_actions(role):
    global active_game_graph, active_game_valid_actions
    if active_game_graph is None:
        raise ValueError("Game session not found. Please start the game first.")
        
    role_type = PlayerType(role)
    if not active_game_graph.game_started or not active_game_graph.player_order:
        return json.dumps({"actions": []})
        
    active_player = active_game_graph.player_order[0]
    if role_type != active_player:
        return json.dumps({"actions": []})
        
    return json.dumps({"actions": active_game_valid_actions})

# Global persistent training state to avoid rebuilding graph on every step
training_graph = None
training_valid_actions = []

def training_start(payload_json_str):
    global training_graph, training_valid_actions
    payload_dict = json.loads(payload_json_str)
    graph = GameEngine.build_game(payload_dict["graph"])
    graph = GameEngine.start_game(graph, payload_dict["player_order"])
    metrics = GameEngine.evaluate(graph)
    
    training_graph = graph
    training_valid_actions = GameEngine.get_valid_actions(graph)
    
    updated_data = graph.to_json()
    metadata = updated_data["metadata"]
    metadata["evaulate"] = {
        "government_tax": metrics["government_tax"],
        "developer_profit": metrics["developer_profit"],
        "total_population": metrics["total_population"]
    }
    return json.dumps({
        "units": [{"id": u["id"], "type": u["type"], "height": u.get("height")} for u in updated_data["units"]],
        "metadata": metadata
    })

def training_step(action_type_val, unit_id_val, unit_type_val):
    global training_graph, training_valid_actions
    if training_graph is None:
        raise ValueError("Training graph not initialized.")
        
    action_type = ActionType(action_type_val)
    requested_action = [int(action_type), unit_id_val]
    if requested_action not in training_valid_actions:
        raise ValueError(f"Action {requested_action} is not valid.")
        
    built_type = UnitType(unit_type_val) if unit_type_val is not None else UnitType.EMPTY
    
    new_graph = GameEngine.action(
        training_graph,
        training_valid_actions,
        action_type,
        unit_id_val,
        built_type
    )
    
    metrics = GameEngine.evaluate(new_graph)
    training_graph = new_graph
    training_valid_actions = GameEngine.get_valid_actions(new_graph)
    
    updated_data = training_graph.to_json()
    metadata = updated_data["metadata"]
    metadata["evaulate"] = {
        "government_tax": metrics["government_tax"],
        "developer_profit": metrics["developer_profit"],
        "total_population": metrics["total_population"]
    }
    return json.dumps({
        "units": [{"id": u["id"], "type": u["type"], "height": u.get("height")} for u in updated_data["units"]],
        "metadata": metadata
    })
`;
