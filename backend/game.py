from backend.graph import UrbanGraph, UrbanUnit, UnitType, PlayerType, ActionType
import math

class GameEngine:
    # Explicit definition of game roles and their executable actions (allowed behaviors and buildings)
    # This documents and acts as the single source of truth for role behavior.
    PLAYER_CONFIG = {
        PlayerType.DEVELOPER: ("Developer", [UnitType.RESIDENTIAL], [ActionType.SKIP, ActionType.PLACE]),
        PlayerType.GOVERNMENT: ("Government", [UnitType.GREEN], [ActionType.SKIP, ActionType.PLACE])
    }



    @staticmethod
    def build_game(data: dict) -> UrbanGraph:
        """
        Creates the basic graph from JSON data at the very beginning.
        Enforces game_started = False and timer = 0.
        """
        graph = UrbanGraph.from_json(data)
        graph.game_started = False
        graph.timer = 0
        graph.player_order = []
        return graph

    @staticmethod
    def start_game(graph: UrbanGraph, player_order: list[int]) -> UrbanGraph:
        """
        Modifies the graph, setting player_order based on the input sequence.
        Sets game_started = True and timer = 0.
        """
        if graph.game_started:
            raise ValueError("Game has already started. Turn order cannot be modified.")
            
        if not player_order:
            raise ValueError("player_order cannot be empty.")
            
        graph.player_order = [PlayerType(r) for r in player_order]
        graph.game_started = True
        graph.timer = 0
        
        return graph

    @staticmethod
    def skip(graph: UrbanGraph) -> UrbanGraph:
        """Applies a 'skip' turn action and increments the timer."""
        graph.timer += 1
        return graph

    @staticmethod
    def place(graph: UrbanGraph, unit_id: int, type: UnitType) -> UrbanGraph:
        """
        Applies a 'place' building action on an EMPTY unit and increments the timer.
        """
        try:
            target_unit = graph.units[unit_id]
        except IndexError:
            raise ValueError(f"Unit with ID {unit_id} not found in topology.")

        target_unit.type = type

        graph.timer += 1
        return graph

    @staticmethod
    def replace(graph: UrbanGraph, unit_id: int, type: UnitType) -> UrbanGraph:
        """
        Applies a 'replace' building action on an occupied (non-empty) unit and increments the timer.
        """
        try:
            target_unit = graph.units[unit_id]
        except IndexError:
            raise ValueError(f"Unit with ID {unit_id} not found in topology.")

        target_unit.type = type
        
        graph.timer += 1
        return graph

    @staticmethod
    def action(graph: UrbanGraph, valid_actions, action_type: ActionType, unit_id: int | None, built_type: UnitType | None) -> UrbanGraph:
        """
        Validates and applies an action (place, replace, or skip) for a given role on the UrbanGraph.
        Compares the requested action against valid actions returned by get_valid_actions.
        Advances the turn order by shifting and returns the updated UrbanGraph.
        """
        action_type = ActionType(action_type)

        # Verify requested action is allowed
        requested_action = [int(action_type), unit_id]
        if requested_action not in valid_actions:
            raise ValueError(f"Action {requested_action} is not valid in the current state.")

        # Apply the validated action directly
        if action_type == ActionType.SKIP:
            updated_graph = GameEngine.skip(graph)
        elif action_type == ActionType.PLACE:
            updated_graph = GameEngine.place(graph, unit_id, built_type)
        elif action_type == ActionType.REPLACE:
            updated_graph = GameEngine.replace(graph, unit_id, built_type)

        updated_graph.player_order = graph.player_order[1:] + graph.player_order[:1]

        return updated_graph

    @staticmethod
    def get_valid_actions(graph: UrbanGraph) -> list[list]:
        """
        Retrieves all valid actions for a given role under the current graph state.
        Each action is represented as a list: [action_type: int, unit_id: int | None]
        """
        valid_actions = []

        if not graph.game_started or not graph.player_order:
            return valid_actions

        player = graph.player_order[0]
        allowed_actions = GameEngine.PLAYER_CONFIG[player][2]

        # 2. Check SKIP behavior
        if ActionType.SKIP in allowed_actions:
            valid_actions.append([int(ActionType.SKIP), None])

        # 3. Check PLACE / REPLACE behaviors for units
        has_place = ActionType.PLACE in allowed_actions
        has_replace = ActionType.REPLACE in allowed_actions

        if has_place or has_replace:
            for unit in graph.units:
                if has_place and unit.type == UnitType.EMPTY:
                    valid_actions.append([int(ActionType.PLACE), unit.id])
                elif has_replace and unit.type != UnitType.EMPTY:
                    valid_actions.append([int(ActionType.REPLACE), unit.id])

        return valid_actions

    @staticmethod
    def evaluate(graph: UrbanGraph) -> dict:
        """
        Performs the urban economy metrics calculations on the graph.
        Updates value and population in-place for all units.
        Returns a dict of metrics (government_tax, developer_profit, total_population).
        """
        # Build block-to-units lookup for fast queries
        block_to_units = {}
        for u in graph.units:
            pid = str(u.parentid)
            if pid not in block_to_units:
                block_to_units[pid] = []
            block_to_units[pid].append(u)

        # Calculate value score for all residential units
        for u in graph.units:
            if u.type != UnitType.RESIDENTIAL:
                u.value = 0.0
                continue
                
            value = 40.0  # Base value baseline score
            
            pid = str(u.parentid)
            same_block_units = block_to_units.get(pid, [])
            
            # Check impact from other units in the SAME block (influence factor: 1.0)
            total_green_floors = sum(ou.height for ou in same_block_units if ou.type == UnitType.GREEN)
            total_residential_floors = sum(ou.height for ou in same_block_units if ou.type == UnitType.RESIDENTIAL)
            
            value += 25.0 * 1.0 * total_green_floors
            value -= 5.0 * 1.0 * (total_residential_floors - 1)
            
            # Check impact from units in NEIGHBOR blocks (influence factor: 0.5)
            neighbors = graph.get_neighbors(u.parentid)
            for neighbor_id in neighbors:
                neighbor_units = block_to_units.get(str(neighbor_id), [])
                n_green = sum(nu.height for nu in neighbor_units if nu.type == UnitType.GREEN)
                n_res = sum(nu.height for nu in neighbor_units if nu.type == UnitType.RESIDENTIAL)
                
                value += 25.0 * 0.5 * n_green
                value -= 5.0 * 0.5 * n_res
                
            u.value = max(10.0, min(100.0, value))

        # Calculate population based on normal distribution
        mu = 60.0       # Golden price point for population
        sigma = 20.0    # Sensitivity coefficient
        P_max = 150.0   # Maximum population capacity per floor
        
        total_city_population = 0
        total_developer_profit = 0
        
        for u in graph.units:
            if u.type == UnitType.RESIDENTIAL:
                v = u.value
                pop_per_floor = P_max * math.exp(-((v - mu) ** 2) / (2 * (sigma ** 2)))
                rounded_pop = round(pop_per_floor) * u.height
                u.population = float(rounded_pop)
                
                total_city_population += rounded_pop
                total_developer_profit += rounded_pop * v
            else:
                u.population = 0.0

        # Calculate total government tax
        tax_rate = 0.5
        total_government_tax = round(total_city_population * tax_rate)
        
        return {
            "government_tax": int(total_government_tax),
            "developer_profit": float(total_developer_profit),
            "total_population": int(total_city_population)
        }
