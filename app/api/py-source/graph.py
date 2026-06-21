from enum import IntEnum

class UnitType(IntEnum):
    EMPTY = 0
    RESIDENTIAL = 1
    GREEN = 2

class PlayerType(IntEnum):
    DEVELOPER = 1
    GOVERNMENT = 2

class ActionType(IntEnum):
    SKIP = 0
    PLACE = 1
    REPLACE = 2

class UrbanUnit:
    """
    Represents an individual building unit within a plot.
    """
    def __init__(self, id: int, parentid: int, type: UnitType, height: int, value: float, population: float):
        self.id = id
        self.parentid = parentid
        self.type = type
        self.height = height
        self.value = value
        self.population = population

    @classmethod
    def from_json(cls, data: dict):
        """Creates an UrbanUnit from a JSON/dict object, converting the type value to UnitType."""
        return cls(
            id=data.get("id"),
            parentid=data.get("parentid"),
            type=UnitType(data.get("type")),
            value=data.get("value", 0.0),
            population=data.get("population", 0.0),
            height=data.get("height", 1)
        )

    def to_json(self) -> dict:
        """Converts the UrbanUnit to a JSON-serializable dict, storing the type as an int."""
        return {
            "id": self.id,
            "parentid": self.parentid,
            "type": int(self.type),
            "height": self.height,
            "value": self.value,
            "population": self.population
        }

class UrbanGraph:
    """
    Flat/Columnar topology representation of the grid (graph).
    Contains graphic/topology info and the building units inside each block.
    """
    def __init__(self, blocks: list[int], neighbor: list[list[int]], units: list[UrbanUnit], player_order: list[PlayerType], game_started: bool, timer: int = 0):
        self.blocks = blocks
        self.neighbor = neighbor
        self.units = units
        self.timer = timer
        self.player_order = player_order
        self.game_started = game_started

    def get_neighbors(self, block_id) -> list[int]:
        """Returns the list of neighbor block IDs for a given block ID."""
        try:
            idx = self.blocks.index(int(block_id))
            return self.neighbor[idx]
        except ValueError:
            return []



    @classmethod
    def from_json(cls, data: dict):
        """Factory method to instantiate UrbanGraph from the frontend JSON data."""
        blocks_data = data.get("blocks", [])
        blocks = [b.get("id") for b in blocks_data]
        neighbor = [b.get("neighbor", []) for b in blocks_data]

        units_json = data.get("units", [])
        units = [UrbanUnit.from_json(u_json) for u_json in units_json]
        
        metadata = data.get("metadata", {})
        timer = metadata.get("timer", 0)
        game_started = metadata.get("game_started", False)
        raw_order = metadata.get("player_order", [])
        player_order = [PlayerType(r) for r in raw_order]
        
        return cls(blocks, neighbor, units, player_order, game_started, timer)

    def to_json(self) -> dict:
        """
        Serializes the graph, ensuring geometry-free representations are transmitted.
        """
        # Reconstruct the metadata dictionary block for front-end consumption
        metadata = {
            "game_started": self.game_started,
            "player_order": [int(p) for p in self.player_order],
            "timer": self.timer
        }
        if self.player_order:
            next_player = self.player_order[0]
            metadata["next_player"] = int(next_player)
            
            # Import GameEngine locally to avoid circular dependency
            from backend.game import GameEngine
            config = GameEngine.PLAYER_CONFIG.get(next_player)
            if config:
                metadata["valid_type"] = [int(b) for b in config[1]]
                metadata["valid_action"] = [int(b) for b in config[2]]

        return {
            "units": [u.to_json() for u in self.units],
            "metadata": metadata
        }
