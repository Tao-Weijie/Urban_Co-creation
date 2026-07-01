import { UnitType, PlayerType, ActionType, PlayerConfig } from './configE';
import { getUnitVolume } from './function';

// Strict validation helper functions for enums as per project rules
function validateUnitType(val: any): UnitType {
    if (val === UnitType.EMPTY || val === UnitType.RESIDENTIAL || val === UnitType.GREEN) {
        return val as UnitType;
    }
    throw new TypeError(`Invalid UnitType value: ${val}`);
}

function validatePlayerType(val: any): PlayerType {
    if (val === PlayerType.DEVELOPER || val === PlayerType.GOVERNMENT) {
        return val as PlayerType;
    }
    throw new TypeError(`Invalid PlayerType value: ${val}`);
}

function validateActionType(val: any): ActionType {
    if (val === ActionType.SKIP || val === ActionType.PLACE || val === ActionType.REPLACE) {
        return val as ActionType;
    }
    throw new TypeError(`Invalid ActionType value: ${val}`);
}





export class UrbanUnit {
    topology: {
        id: number;
        blockid: number;
        buildingid: number;
        idinbuilding: number;
    };
    geometry: {
        boundary: number[][];
        hole?: number[][][];
        height: number;
    };
    state: {
        type: UnitType;
        value?: number;
        population: number;
    };

    constructor(
        id: number,
        blockid: number,
        buildingid: number,
        idinbuilding: number,
        type: UnitType,
        height: number,
        value: number | undefined,
        population: number,
        boundary: number[][],
        hole?: number[][][]
    ) {
        this.topology = { id, blockid, buildingid, idinbuilding };
        this.geometry = { boundary, hole, height };
        this.state = { type, value, population };
    }

    // Getters and Setters for backward compatibility
    get id() { return this.topology.id; }
    get blockid() { return this.topology.blockid; }
    get buildingid() { return this.topology.buildingid; }
    get idinbuilding() { return this.topology.idinbuilding; }
    get type() { return this.state.type; }
    set type(val: UnitType) { this.state.type = val; }
    get height() { return this.geometry.height; }
    set height(val: number) { this.geometry.height = val; }
    get value() { return this.state.value; }
    set value(val: number | undefined) { this.state.value = val; }
    get population() { return this.state.population; }
    set population(val: number) { this.state.population = val; }
    get boundary() { return this.geometry.boundary; }
    get holes() { return this.geometry.hole; }
    get volume() { return getUnitVolume(this); }

    static fromJson(data: any): UrbanUnit {
        const topology = data.topology;
        const geometry = data.geometry;
        const state = data.state;

        return new UrbanUnit(
            topology.id,
            topology.blockid,
            topology.buildingid,
            topology.idinbuilding,
            validateUnitType(state.type),
            geometry.height,
            state.value,
            state.population ?? 0.0,
            geometry.boundary,
            geometry.hole
        );
    }

    toJson(): any {
        return {
            topology: {
                id: this.topology.id,
                blockid: this.topology.blockid,
                buildingid: this.topology.buildingid,
                idinbuilding: this.topology.idinbuilding
            },
            geometry: {
                boundary: this.geometry.boundary,
                hole: this.geometry.hole,
                height: this.geometry.height
            },
            state: {
                type: Number(this.state.type),
                value: this.state.value,
                population: this.state.population
            }
        };
    }
}

export class UrbanGraph {
    blocks: number[];
    neighbor: number[][];
    units: UrbanUnit[];
    timer: number;
    player_order: PlayerType[];
    game_started: boolean;
    blockValues: Map<number, number>;
    initialBlockValues: Map<number, number>;

    constructor(blocks: number[], neighbor: number[][], units: UrbanUnit[], player_order: PlayerType[], game_started: boolean, timer: number = 0) {
        this.blocks = blocks;
        this.neighbor = neighbor;
        this.units = units;
        this.timer = timer;
        this.player_order = player_order;
        this.game_started = game_started;
        this.blockValues = new Map<number, number>();
        this.initialBlockValues = new Map<number, number>();
    }

    getNeighbors(blockId: number): number[] {
        const idx = this.blocks.indexOf(Number(blockId));
        return idx !== -1 ? this.neighbor[idx] : [];
    }

    static fromJson(data: any): UrbanGraph {
        const blocksData = data.blocks || [];
        const blocks = blocksData.map((b: any) => b.topology?.id);
        const neighbor = blocksData.map((b: any) => b.topology?.neighbor || []);

        const unitsJson = data.units || [];
        const units = unitsJson.map((u: any) => UrbanUnit.fromJson(u));

        const metadata = data.metadata || {};
        const timer = metadata.timer ?? 0;
        const game_started = metadata.game_started ?? false;
        const rawOrder = metadata.player_order || [];
        const player_order = rawOrder.map((r: any) => validatePlayerType(r));

        const graph = new UrbanGraph(blocks, neighbor, units, player_order, game_started, timer);
        blocksData.forEach((b: any) => {
            const initVal = b.state.value ?? 30.0;
            graph.blockValues.set(Number(b.topology.id), initVal);
            graph.initialBlockValues.set(Number(b.topology.id), initVal);
        });
        return graph;
    }

    toJson(): any {
        const metadata: any = {
            game_started: this.game_started,
            player_order: this.player_order.map(p => Number(p)),
            timer: this.timer,
            max_turns: this.units.length * 2
        };
        if (this.player_order && this.player_order.length > 0) {
            const next_player = this.player_order[0];
            metadata.next_player = Number(next_player);

            const config = GameEngine.PLAYER_CONFIG[next_player];
            if (config) {
                metadata.valid_type = config.allowed_types.map(t => Number(t));
                metadata.valid_action = config.allowed_actions.map(a => Number(a));
            }
        }

        return {
            blocks: this.blocks.map(id => ({
                topology: {
                    id,
                    neighbor: this.getNeighbors(id)
                },
                state: {
                    value: this.blockValues.get(id) ?? 30.0
                }
            })),
            units: this.units.map(u => u.toJson()),
            metadata
        };
    }
}

export class GameEngine {
    static PLAYER_CONFIG = PlayerConfig;

    static build_game(data: any): UrbanGraph {
        const graph = UrbanGraph.fromJson(data);
        graph.game_started = false;
        graph.timer = 0;
        graph.player_order = [];
        return graph;
    }

    static start_game(graph: UrbanGraph, player_order: number[]): UrbanGraph {
        if (graph.game_started) {
            throw new Error("Game has already started. Turn order cannot be modified.");
        }
        if (!player_order || player_order.length === 0) {
            throw new Error("player_order cannot be empty.");
        }
        graph.player_order = player_order.map(r => validatePlayerType(r));
        graph.game_started = true;
        graph.timer = 0;
        return graph;
    }

    static skip(graph: UrbanGraph): UrbanGraph {
        graph.timer += 1;
        return graph;
    }

    static place(graph: UrbanGraph, unit_id: number, type: UnitType): UrbanGraph {
        const target_unit = graph.units.find(u => u.id === unit_id);
        if (!target_unit) {
            throw new Error(`Unit with ID ${unit_id} not found in topology.`);
        }
        target_unit.type = type;
        graph.timer += 1;
        return graph;
    }

    static replace(graph: UrbanGraph, unit_id: number, type: UnitType): UrbanGraph {
        const target_unit = graph.units.find(u => u.id === unit_id);
        if (!target_unit) {
            throw new Error(`Unit with ID ${unit_id} not found in topology.`);
        }
        target_unit.type = type;
        graph.timer += 1;
        return graph;
    }

    static action(
        graph: UrbanGraph,
        valid_actions: any[],
        action_type: ActionType,
        unit_id: number | null,
        built_type: UnitType | null
    ): UrbanGraph {
        const requested_action = [Number(action_type), unit_id];

        const isValid = valid_actions.some(va => va[0] === requested_action[0] && va[1] === requested_action[1]);
        if (!isValid) {
            throw new Error(`Action ${JSON.stringify(requested_action)} is not valid in the current state.`);
        }

        if (action_type === ActionType.SKIP) {
            GameEngine.skip(graph);
        } else if (action_type === ActionType.PLACE) {
            if (unit_id === null || built_type === null) throw new Error("unit_id and built_type are required for PLACE");
            GameEngine.place(graph, unit_id, built_type);
        } else if (action_type === ActionType.REPLACE) {
            if (unit_id === null || built_type === null) throw new Error("unit_id and built_type are required for REPLACE");
            GameEngine.replace(graph, unit_id, built_type);
        }

        graph.player_order = [...graph.player_order.slice(1), graph.player_order[0]];

        return graph;
    }

    static get_valid_actions(graph: UrbanGraph): any[] {
        const valid_actions: any[] = [];
        if (!graph.game_started || !graph.player_order || graph.player_order.length === 0) {
            return valid_actions;
        }

        const player = graph.player_order[0];
        const allowed_actions = GameEngine.PLAYER_CONFIG[player].allowed_actions;

        if (allowed_actions.includes(ActionType.SKIP)) {
            valid_actions.push([Number(ActionType.SKIP), null]);
        }

        const has_place = allowed_actions.includes(ActionType.PLACE);
        const has_replace = allowed_actions.includes(ActionType.REPLACE);

        if (has_place || has_replace) {
            // Group units by building so we can check if they are valid for placement
            const buildingUnits = new Map<number, UrbanUnit[]>();
            for (const u of graph.units) {
                if (!buildingUnits.has(u.buildingid)) {
                    buildingUnits.set(u.buildingid, []);
                }
                buildingUnits.get(u.buildingid)!.push(u);
            }

            for (const unit of graph.units) {
                const bUnits = buildingUnits.get(unit.buildingid) || [];
                const lowerUnits = bUnits.filter(ou => ou.idinbuilding < unit.idinbuilding);
                const isBottomMostEmpty = lowerUnits.every(ou => ou.type !== UnitType.EMPTY);

                if (has_place && unit.type === UnitType.EMPTY && isBottomMostEmpty) {
                    valid_actions.push([Number(ActionType.PLACE), unit.id]);
                } else if (has_replace && unit.type !== UnitType.EMPTY) {
                    valid_actions.push([Number(ActionType.REPLACE), unit.id]);
                }
            }
        }

        return valid_actions;
    }

    private static calculate_unit_population(height: number, blockValue: number): number {
        const mu = 60.0;
        const sigma = 20.0;
        const P_max = 150.0;
        const pop_per_floor = P_max * Math.exp(-Math.pow(blockValue - mu, 2) / (2 * Math.pow(sigma, 2)));
        return Math.round(pop_per_floor) * height;
    }

    private static update_block_values(graph: UrbanGraph): void {
        const block_to_units: { [key: string]: UrbanUnit[] } = {};
        for (const u of graph.units) {
            const bid = String(u.blockid);
            if (!block_to_units[bid]) {
                block_to_units[bid] = [];
            }
            block_to_units[bid].push(u);
        }

        for (const blockId of graph.blocks) {
            const bid = String(blockId);
            const same_block_units = block_to_units[bid] || [];

            const total_green_units = same_block_units.filter(ou => ou.type === UnitType.GREEN).length;
            const total_residential_units = same_block_units.filter(ou => ou.type === UnitType.RESIDENTIAL).length;

            let neighbor_green_units = 0;
            let neighbor_res_units = 0;
            const neighbors = graph.getNeighbors(blockId);
            for (const neighbor_id of neighbors) {
                const neighbor_units = block_to_units[String(neighbor_id)] || [];
                neighbor_green_units += neighbor_units.filter(nu => nu.type === UnitType.GREEN).length;
                neighbor_res_units += neighbor_units.filter(nu => nu.type === UnitType.RESIDENTIAL).length;
            }

            const value_green = 40.0 * Math.sqrt(total_green_units) + 20.0 * Math.sqrt(neighbor_green_units);
            const value_penalty = 6.0 * total_residential_units + 3.0 * neighbor_res_units;

            const baseVal = graph.initialBlockValues.get(blockId) ?? 30.0;
            const blockVal = Math.min(100.0, baseVal + value_green - value_penalty);
            graph.blockValues.set(blockId, blockVal);
        }
    }

    static calculate_total_population(graph: UrbanGraph): number {
        let total_city_population = 0;
        for (const u of graph.units) {
            if (u.type === UnitType.RESIDENTIAL) {
                const v = graph.blockValues.get(u.blockid) ?? 30.0;
                u.population = GameEngine.calculate_unit_population(u.height, v);
                total_city_population += u.population;
            } else {
                u.population = 0.0;
            }
        }
        return total_city_population;
    }

    static update_local_value(graph: UrbanGraph, targetBlockId: number): void {
        const blocksToUpdate = [targetBlockId, ...graph.getNeighbors(targetBlockId)];
        
        const block_to_units: { [key: string]: UrbanUnit[] } = {};
        for (const u of graph.units) {
            const bid = String(u.blockid);
            const bidNum = Number(u.blockid);
            if (blocksToUpdate.includes(bidNum) || graph.getNeighbors(bidNum).some(nb => blocksToUpdate.includes(nb))) {
                if (!block_to_units[bid]) {
                    block_to_units[bid] = [];
                }
                block_to_units[bid].push(u);
            }
        }

        for (const blockId of blocksToUpdate) {
            const bid = String(blockId);
            const same_block_units = block_to_units[bid] || [];

            const total_green_units = same_block_units.filter(ou => ou.type === UnitType.GREEN).length;
            const total_residential_units = same_block_units.filter(ou => ou.type === UnitType.RESIDENTIAL).length;

            let neighbor_green_units = 0;
            let neighbor_res_units = 0;
            const neighbors = graph.getNeighbors(blockId);
            for (const neighbor_id of neighbors) {
                const neighbor_units = block_to_units[String(neighbor_id)] || [];
                neighbor_green_units += neighbor_units.filter(nu => nu.type === UnitType.GREEN).length;
                neighbor_res_units += neighbor_units.filter(nu => nu.type === UnitType.RESIDENTIAL).length;
            }

            const value_green = 40.0 * Math.sqrt(total_green_units) + 20.0 * Math.sqrt(neighbor_green_units);
            const value_penalty = 6.0 * total_residential_units + 3.0 * neighbor_res_units;

            const baseVal = graph.initialBlockValues.get(blockId) ?? 30.0;
            const blockVal = Math.min(100.0, baseVal + value_green - value_penalty);
            graph.blockValues.set(blockId, blockVal);
        }
    }

    static evaluate_developer_profit(graph: UrbanGraph, skipUpdateValues = false): number {
        if (!skipUpdateValues) {
            GameEngine.update_block_values(graph);
        }

        let total_developer_revenue = 0;
        let total_developer_cost = 0;
        let total_land_price = 0;

        for (const u of graph.units) {
            if (u.type === UnitType.RESIDENTIAL) {
                const v = graph.blockValues.get(u.blockid) ?? 30.0;
                const pop = GameEngine.calculate_unit_population(u.height, v);
                u.population = pop;

                total_developer_revenue += pop * v * 0.5;
                total_developer_cost += 0.0;
                total_land_price += u.volume * v;
            } else {
                u.population = 0.0;
            }
        }

        const developer_net_profit = total_developer_revenue - total_developer_cost - total_land_price;
        return Math.round(developer_net_profit * 10) / 10;
    }

    static evaluate_government_profit(graph: UrbanGraph, skipUpdateValues = false): number {
        if (!skipUpdateValues) {
            GameEngine.update_block_values(graph);
        }

        let total_land_price = 0;
        let total_tax_revenue = 0;

        for (const u of graph.units) {
            if (u.type === UnitType.RESIDENTIAL) {
                const v = graph.blockValues.get(u.blockid) ?? 30.0;
                const pop = GameEngine.calculate_unit_population(u.height, v);
                u.population = pop;

                total_land_price += u.volume * v;
                total_tax_revenue += pop * 10.0;
            } else {
                u.population = 0.0;
            }
        }

        const government_net_reserve = total_land_price + total_tax_revenue;
        return Math.round(government_net_reserve);
    }
}

function getEvaluation(graph: UrbanGraph) {
    return {
        government_profit: GameEngine.evaluate_government_profit(graph),
        developer_profit: GameEngine.evaluate_developer_profit(graph),
        total_population: GameEngine.calculate_total_population(graph)
    };
}

class TSEngine {
    private activeGameGraph: UrbanGraph | null = null;
    private activeGameValidActions: any[] = [];

    private trainingGraph: UrbanGraph | null = null;
    private trainingValidActions: any[] = [];

    async init(): Promise<void> {
        // No-op for direct JS execution compatibility
        return Promise.resolve();
    }

    async initializePlayer(): Promise<any> {
        const serializedConfig: any = {};
        for (const [role, config] of Object.entries(GameEngine.PLAYER_CONFIG)) {
            serializedConfig[role] = {
                name: config.name,
                color: config.color,
                allowed_types: config.allowed_types.map(t => Number(t)),
                allowed_actions: config.allowed_actions.map(a => Number(a))
            };
        }
        return Promise.resolve(serializedConfig);
    }

    async buildGame(payload: any): Promise<any> {
        const graph = GameEngine.build_game(payload);
        const metrics = getEvaluation(graph);

        this.activeGameGraph = graph;
        this.activeGameValidActions = [];

        const updatedData = graph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_profit: metrics.government_profit,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };

        return Promise.resolve({
            blocks: updatedData.blocks,
            units: updatedData.units,
            metadata
        });
    }

    async startGame(payload: any): Promise<any> {
        if (!this.activeGameGraph) {
            return Promise.reject(new Error("Game session not found. Please upload map grid first."));
        }
        const playerOrder: number[] = payload.player_order;

        for (const r of playerOrder) {
            validatePlayerType(r);
        }

        const graph = GameEngine.start_game(this.activeGameGraph, playerOrder);
        const metrics = getEvaluation(graph);

        this.activeGameGraph = graph;
        this.activeGameValidActions = GameEngine.get_valid_actions(graph);

        const updatedData = graph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_profit: metrics.government_profit,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };
        metadata.valid_actions = this.activeGameValidActions;

        return Promise.resolve({
            blocks: updatedData.blocks,
            units: updatedData.units,
            metadata
        });
    }

    async runGameStep(payload: any): Promise<any> {
        if (!this.activeGameGraph) {
            return Promise.reject(new Error("Game session not found. Please start the game first."));
        }
        if (!this.activeGameGraph.game_started || !this.activeGameGraph.player_order || this.activeGameGraph.player_order.length === 0) {
            return Promise.reject(new Error("Game session not started or turn order not defined."));
        }

        const actionType = validateActionType(payload.action_type);
        const requestedAction = [Number(actionType), payload.unit_id];

        const isValid = this.activeGameValidActions.some(
            va => va[0] === requestedAction[0] && va[1] === requestedAction[1]
        );
        if (!isValid) {
            return Promise.reject(new Error(`Action ${JSON.stringify(requestedAction)} is not valid in the current state.`));
        }

        const unitTypeVal = payload.unit_type;
        const builtType = unitTypeVal !== undefined && unitTypeVal !== null ? validateUnitType(unitTypeVal) : UnitType.EMPTY;

        const newGraph = GameEngine.action(
            this.activeGameGraph,
            this.activeGameValidActions,
            actionType,
            payload.unit_id,
            builtType
        );

        const metrics = getEvaluation(newGraph);
        this.activeGameGraph = newGraph;
        this.activeGameValidActions = GameEngine.get_valid_actions(newGraph);

        const updatedData = this.activeGameGraph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_profit: metrics.government_profit,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };
        metadata.valid_actions = this.activeGameValidActions;

        return Promise.resolve({
            blocks: updatedData.blocks,
            units: updatedData.units,
            metadata
        });
    }

    async getValidActions(role: number): Promise<any> {
        if (!this.activeGameGraph) {
            return Promise.reject(new Error("Game session not found. Please start the game first."));
        }
        const roleType = validatePlayerType(role);
        if (!this.activeGameGraph.game_started || !this.activeGameGraph.player_order || this.activeGameGraph.player_order.length === 0) {
            return Promise.resolve({ actions: [] });
        }

        const activePlayer = this.activeGameGraph.player_order[0];
        if (roleType !== activePlayer) {
            return Promise.resolve({ actions: [] });
        }

        return Promise.resolve({ actions: this.activeGameValidActions });
    }

    trainingStart(payload: any): any {
        const graph = GameEngine.build_game(payload.graph);
        const updatedGraph = GameEngine.start_game(graph, payload.player_order);
        const metrics = getEvaluation(updatedGraph);

        this.trainingGraph = updatedGraph;
        this.trainingValidActions = GameEngine.get_valid_actions(updatedGraph);

        const updatedData = updatedGraph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_profit: metrics.government_profit,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };

        return {
            blocks: updatedData.blocks,
            units: updatedData.units,
            metadata
        };
    }

    trainingStep(actionTypeVal: number, unitIdVal: number | null, unitTypeVal: number): any {
        if (!this.trainingGraph) {
            throw new Error("Training graph not initialized.");
        }

        const actionType = validateActionType(actionTypeVal);
        const requestedAction = [Number(actionType), unitIdVal];

        const isValid = this.trainingValidActions.some(
            va => va[0] === requestedAction[0] && va[1] === requestedAction[1]
        );
        if (!isValid) {
            throw new Error(`Action ${JSON.stringify(requestedAction)} is not valid.`);
        }

        const builtType = unitTypeVal !== undefined && unitTypeVal !== null ? validateUnitType(unitTypeVal) : UnitType.EMPTY;

        const newGraph = GameEngine.action(
            this.trainingGraph,
            this.trainingValidActions,
            actionType,
            unitIdVal,
            builtType
        );

        const metrics = getEvaluation(newGraph);
        this.trainingGraph = newGraph;
        this.trainingValidActions = GameEngine.get_valid_actions(newGraph);

        const updatedData = this.trainingGraph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_profit: metrics.government_profit,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };

        return {
            blocks: updatedData.blocks,
            units: updatedData.units,
            metadata
        };
    }
}

export const tsEngine = new TSEngine();
