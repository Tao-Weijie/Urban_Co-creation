export enum UnitType {
    EMPTY = 0,
    RESIDENTIAL = 1,
    GREEN = 2
}

export enum PlayerType {
    DEVELOPER = 1,
    GOVERNMENT = 2
}

export enum ActionType {
    SKIP = 0,
    PLACE = 1,
    REPLACE = 2
}

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
    id: number;
    parentid: number;
    type: UnitType;
    height: number;
    value: number;
    population: number;

    constructor(id: number, parentid: number, type: UnitType, height: number, value: number, population: number) {
        this.id = id;
        this.parentid = parentid;
        this.type = type;
        this.height = height;
        this.value = value;
        this.population = population;
    }

    static fromJson(data: any): UrbanUnit {
        return new UrbanUnit(
            data.id,
            data.parentid,
            validateUnitType(data.type),
            data.height ?? 1,
            data.value ?? 0.0,
            data.population ?? 0.0
        );
    }

    toJson(): any {
        return {
            id: this.id,
            parentid: this.parentid,
            type: Number(this.type),
            height: this.height,
            value: this.value,
            population: this.population
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

    constructor(blocks: number[], neighbor: number[][], units: UrbanUnit[], player_order: PlayerType[], game_started: boolean, timer: number = 0) {
        this.blocks = blocks;
        this.neighbor = neighbor;
        this.units = units;
        this.timer = timer;
        this.player_order = player_order;
        this.game_started = game_started;
    }

    getNeighbors(blockId: number): number[] {
        const idx = this.blocks.indexOf(Number(blockId));
        return idx !== -1 ? this.neighbor[idx] : [];
    }

    static fromJson(data: any): UrbanGraph {
        const blocksData = data.blocks || [];
        const blocks = blocksData.map((b: any) => b.id);
        const neighbor = blocksData.map((b: any) => b.neighbor || []);

        const unitsJson = data.units || [];
        const units = unitsJson.map((u: any) => UrbanUnit.fromJson(u));

        const metadata = data.metadata || {};
        const timer = metadata.timer ?? 0;
        const game_started = metadata.game_started ?? false;
        const rawOrder = metadata.player_order || [];
        const player_order = rawOrder.map((r: any) => validatePlayerType(r));

        return new UrbanGraph(blocks, neighbor, units, player_order, game_started, timer);
    }

    toJson(): any {
        const metadata: any = {
            game_started: this.game_started,
            player_order: this.player_order.map(p => Number(p)),
            timer: this.timer
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
            units: this.units.map(u => u.toJson()),
            metadata
        };
    }
}

export class GameEngine {
    static PLAYER_CONFIG = {
        [PlayerType.DEVELOPER]: {
            name: "Developer",
            allowed_types: [UnitType.RESIDENTIAL],
            allowed_actions: [ActionType.SKIP, ActionType.PLACE]
        },
        [PlayerType.GOVERNMENT]: {
            name: "Government",
            allowed_types: [UnitType.GREEN],
            allowed_actions: [ActionType.SKIP, ActionType.PLACE]
        }
    };

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
            for (const unit of graph.units) {
                if (has_place && unit.type === UnitType.EMPTY) {
                    valid_actions.push([Number(ActionType.PLACE), unit.id]);
                } else if (has_replace && unit.type !== UnitType.EMPTY) {
                    valid_actions.push([Number(ActionType.REPLACE), unit.id]);
                }
            }
        }

        return valid_actions;
    }

    static evaluate(graph: UrbanGraph): { government_tax: number, developer_profit: number, total_population: number } {
        const block_to_units: { [key: string]: UrbanUnit[] } = {};
        for (const u of graph.units) {
            const pid = String(u.parentid);
            if (!block_to_units[pid]) {
                block_to_units[pid] = [];
            }
            block_to_units[pid].push(u);
        }

        for (const u of graph.units) {
            const pid = String(u.parentid);
            const same_block_units = block_to_units[pid] || [];

            const total_green_units = same_block_units.filter(ou => ou.type === UnitType.GREEN).length;
            const total_residential_units = same_block_units.filter(ou => ou.type === UnitType.RESIDENTIAL).length;

            let neighbor_green_units = 0;
            let neighbor_res_units = 0;
            const neighbors = graph.getNeighbors(u.parentid);
            for (const neighbor_id of neighbors) {
                const neighbor_units = block_to_units[String(neighbor_id)] || [];
                neighbor_green_units += neighbor_units.filter(nu => nu.type === UnitType.GREEN).length;
                neighbor_res_units += neighbor_units.filter(nu => nu.type === UnitType.RESIDENTIAL).length;
            }

            const u_count_to_subtract = u.type === UnitType.RESIDENTIAL ? 1 : 0;

            const value_green = 40.0 * Math.sqrt(total_green_units) + 20.0 * Math.sqrt(neighbor_green_units);

            const r_same = total_residential_units - u_count_to_subtract;
            const value_penalty = 6.0 * r_same + 3.0 * neighbor_res_units;

            u.value = Math.max(15.0, Math.min(100.0, 30.0 + value_green - value_penalty));
        }

        const mu = 60.0;
        const sigma = 20.0;
        const P_max = 150.0;

        let total_city_population = 0;
        let total_developer_revenue = 0;
        let total_developer_cost = 0;
        let total_land_price = 0;
        let total_tax_revenue = 0;

        for (const u of graph.units) {
            if (u.type === UnitType.RESIDENTIAL) {
                const v = u.value;
                const pop_per_floor = P_max * Math.exp(-Math.pow(v - mu, 2) / (2 * Math.pow(sigma, 2)));
                const rounded_pop = Math.round(pop_per_floor) * u.height;
                u.population = rounded_pop;

                total_city_population += rounded_pop;
                total_developer_revenue += rounded_pop * v * 0.5;
                total_developer_cost += 0.0;
                total_land_price += v * u.height * 10.0;
                total_tax_revenue += rounded_pop * 10.0;
            } else {
                u.population = 0.0;
            }
        }

        const developer_net_profit = Math.round((total_developer_revenue - total_developer_cost - total_land_price) * 10) / 10;
        const government_net_reserve = Math.round((total_land_price + total_tax_revenue) * 10) / 10;

        return {
            government_tax: Math.round(government_net_reserve),
            developer_profit: developer_net_profit,
            total_population: total_city_population
        };
    }
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
                allowed_types: config.allowed_types.map(t => Number(t)),
                allowed_actions: config.allowed_actions.map(a => Number(a))
            };
        }
        return Promise.resolve(serializedConfig);
    }

    async buildGame(payload: any): Promise<any> {
        const graph = GameEngine.build_game(payload);
        const metrics = GameEngine.evaluate(graph);
        
        this.activeGameGraph = graph;
        this.activeGameValidActions = [];

        const updatedData = graph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_tax: metrics.government_tax,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };

        return Promise.resolve({
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
        const metrics = GameEngine.evaluate(graph);

        this.activeGameGraph = graph;
        this.activeGameValidActions = GameEngine.get_valid_actions(graph);

        const updatedData = graph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_tax: metrics.government_tax,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };

        return Promise.resolve({
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

        const metrics = GameEngine.evaluate(newGraph);
        this.activeGameGraph = newGraph;
        this.activeGameValidActions = GameEngine.get_valid_actions(newGraph);

        const updatedData = this.activeGameGraph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_tax: metrics.government_tax,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };

        return Promise.resolve({
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
        const metrics = GameEngine.evaluate(updatedGraph);

        this.trainingGraph = updatedGraph;
        this.trainingValidActions = GameEngine.get_valid_actions(updatedGraph);

        const updatedData = updatedGraph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_tax: metrics.government_tax,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };

        return {
            units: updatedData.units.map((u: any) => ({ id: u.id, type: u.type, height: u.height })),
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

        const metrics = GameEngine.evaluate(newGraph);
        this.trainingGraph = newGraph;
        this.trainingValidActions = GameEngine.get_valid_actions(newGraph);

        const updatedData = this.trainingGraph.toJson();
        const metadata = updatedData.metadata;
        metadata.evaulate = {
            government_tax: metrics.government_tax,
            developer_profit: metrics.developer_profit,
            total_population: metrics.total_population
        };

        return {
            units: updatedData.units.map((u: any) => ({ id: u.id, type: u.type, height: u.height })),
            metadata
        };
    }
}

export const tsEngine = new TSEngine();
