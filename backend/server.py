from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from backend.game import GameEngine
from backend.graph import UrbanGraph, PlayerType, ActionType, UnitType

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backend-server")

app = FastAPI(
    title="Urban Co-creation Backend API",
    description="Python calculations backend for urban economics modeling",
    version="1.0.0"
)

# Enable CORS for local Next.js development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global active game state
active_game_graph: UrbanGraph | None = None
active_game_valid_actions: list[list] = []


@app.get("/api/py/game/players")
def InitializePlayer():
    """
    Returns the role configuration.
    """
    serialized_config = {}
    for role_enum, config in GameEngine.PLAYER_CONFIG.items():
        serialized_config[str(int(role_enum))] = {
            "name": config[0],
            "allowed_types": [int(b) for b in config[1]],
            "allowed_actions": [int(b) for b in config[2]]
        }
    return serialized_config

class GameStepPayload(BaseModel):
    action_type: int
    unit_type: int | None = None
    unit_id: int | None = None

class GameStartPayload(BaseModel):
    player_order: list[int]

class GameBuildPayload(BaseModel):
    blocks: list
    units: list
    timer: int = 0
    metadata: dict = {}

@app.post("/api/py/game/build")
def BuildGame(payload: GameBuildPayload):
    """
    Initializes the active_game_graph from grid payload, evaluates it,
    stores it in global memory, and returns initial metrics.
    Replaces /api/py/evaluate.
    """
    global active_game_graph, active_game_valid_actions
    try:
        payload_dict = payload.dict()
        logger.info(f"Received build game request with {len(payload.blocks)} blocks and {len(payload.units)} units.")
        
        # 1. Deserialization: JSON -> UrbanGraph via GameEngine.build_game
        graph = GameEngine.build_game(payload_dict)
        
        # 2. Evaluation: Run metrics directly on the UrbanGraph instance via GameEngine
        metrics = GameEngine.evaluate(graph)
        
        # 3. Serialization: UrbanGraph -> JSON dict
        updated_data = graph.to_json()
        
        # Save to global state so subsequent operations can use it
        active_game_graph = graph
        active_game_valid_actions = []  # reset valid actions since game hasn't started
        
        logger.info("Game built and evaluation calculated successfully.")
        metadata = updated_data["metadata"]
        metadata["evaulate"] = {
            "government_tax": metrics["government_tax"],
            "developer_profit": metrics["developer_profit"],
            "total_population": metrics["total_population"]
        }
        return {
            "units": updated_data["units"],
            "metadata": metadata
        }
    except Exception as e:
        logger.error(f"Error during game build: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/py/game/start")
def StartGame(payload: GameStartPayload):
    """
    Initializes and freezes the turn order for the game session.
    """
    global active_game_graph, active_game_valid_actions
    try:
        logger.info("Received start game request.")
        
        if active_game_graph is None:
            raise HTTPException(status_code=400, detail="Game session not found. Please upload map grid first.")
            
        player_order = payload.player_order
        # Strict validation of role types in player_order
        for r in player_order:
            PlayerType(r)  # raises ValueError if invalid role
            
        # Delegate initialization to GameEngine
        graph = GameEngine.start_game(active_game_graph, player_order)
        
        # Evaluate graph to obtain initial metrics
        metrics = GameEngine.evaluate(graph)
        
        # Save to global state
        active_game_graph = graph
        
        # Initialize the global active_game_valid_actions list with the active player's valid actions
        active_game_valid_actions = GameEngine.get_valid_actions(graph)
        
        updated_data = graph.to_json()

        logger.info("Game started successfully and turn order initialized.")
        metadata = updated_data["metadata"]
        metadata["evaulate"] = {
            "government_tax": metrics["government_tax"],
            "developer_profit": metrics["developer_profit"],
            "total_population": metrics["total_population"]
        }
        return {
            "units": updated_data["units"],
            "metadata": metadata
        }
    except (ValueError, TypeError) as ve:
        logger.warning(f"Validation failure in game start: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error starting game: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/py/game/step")
def RunGame(payload: GameStepPayload):
    """
    Receives minimal action type (place/skip), unit ID, and unit type.
    Applies the action directly on the active in-memory UrbanGraph,
    runs evaluation, and returns the updated units and metrics.
    """
    global active_game_graph, active_game_valid_actions
    try:
        logger.info(f"Received game step request: action={payload.action_type}, unit_id={payload.unit_id}, unit_type={payload.unit_type}")
        
        if active_game_graph is None:
            raise HTTPException(status_code=400, detail="Game session not found. Please start the game first.")
            
        if not active_game_graph.game_started or not active_game_graph.player_order:
            raise HTTPException(status_code=400, detail="Game session not started or turn order not defined.")

        action_type = ActionType(payload.action_type)
        requested_action = [int(action_type), payload.unit_id]
        if requested_action not in active_game_valid_actions:
            raise HTTPException(status_code=400, detail=f"Action {requested_action} is not valid in the current state.")

        built_type = UnitType(payload.unit_type)

        # 1. Domain Execution: Apply action directly on the global UrbanGraph instance
        new_graph = GameEngine.action(
            active_game_graph,
            active_game_valid_actions,
            action_type,
            payload.unit_id,
            built_type
        )
        
        # 2. Evaluation: Run metrics directly on the updated graph
        metrics = GameEngine.evaluate(new_graph)
        
        # 3. Save updated state back to global
        active_game_graph = new_graph
        
        # 4. Update the global active_game_valid_actions list with the next player's valid actions
        active_game_valid_actions = GameEngine.get_valid_actions(new_graph)
        
        # 5. Serialization: UrbanGraph -> JSON dict
        updated_data = active_game_graph.to_json()
        
        logger.info("Game step applied successfully.")
        metadata = updated_data["metadata"]
        metadata["evaulate"] = {
            "government_tax": metrics["government_tax"],
            "developer_profit": metrics["developer_profit"],
            "total_population": metrics["total_population"]
        }
        return {
            "units": updated_data["units"],
            "metadata": metadata
        }
    except HTTPException as he:
        raise he
    except (ValueError, TypeError) as ve:
        logger.warning(f"Validation failure in game step: {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error during game step: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/py/game/actions")
def get_valid_actions(role: int):
    """
    Returns the list of valid actions for the given role under the current active game graph.
    """
    global active_game_graph, active_game_valid_actions
    if active_game_graph is None:
        raise HTTPException(status_code=400, detail="Game session not found. Please start the game first.")
    try:
        role_type = PlayerType(role)  # Strict validation
        if not active_game_graph.game_started or not active_game_graph.player_order:
            return {"actions": []}
            
        active_player = active_game_graph.player_order[0]
        if role_type != active_player:
            return {"actions": []}

        return {"actions": active_game_valid_actions}
    except (ValueError, TypeError) as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error getting valid actions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
