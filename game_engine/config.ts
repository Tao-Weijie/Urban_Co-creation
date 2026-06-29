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

export const PlayerConfig: Record<PlayerType, { name: string; color: string; allowed_types: UnitType[]; allowed_actions: ActionType[] }> = {
  [PlayerType.DEVELOPER]: {
    name: "Developer",
    color: "#f59e0b",
    allowed_types: [UnitType.RESIDENTIAL],
    allowed_actions: [ActionType.SKIP, ActionType.PLACE]
  },
  [PlayerType.GOVERNMENT]: {
    name: "Government",
    color: "#10b981",
    allowed_types: [UnitType.GREEN],
    allowed_actions: [ActionType.SKIP, ActionType.PLACE]
  }
};

export const UnitTypeConfig: Record<UnitType, { name: string; color: string; opacity: number }> = {
  [UnitType.EMPTY]: {
    name: "Empty",
    color: "#ffffff",
    opacity: 0.2
  },
  [UnitType.RESIDENTIAL]: {
    name: "Residential",
    color: "#f59e0b",
    opacity: 1
  },
  [UnitType.GREEN]: {
    name: "Green",
    color: "#10b981",
    opacity: 1
  }
};

export interface Block {
  topology: {
    id: number;
    neighbor: number[];
  };
  geometry: {
    boundary: number[][]; // Representing points as [x, y, z]
    hole: number[][][];
  };
  state: {
    value?: number; // Land value as a block attribute
  };
}

export interface UrbanUnit {
  topology: {
    id: number;
    blockid: number;
    buildingid: number;
    idinbuilding: number;
  };
  geometry: {
    boundary: number[][]; // Representing points as [x, y, z]
    hole?: number[][][];  // Representing holes as array of point arrays
    height: number;       // Absolute height
  };
  state: {
    type: number;         // 0: empty, 1: residential, 2: green
    value?: number;       // Optional land value
    population: number;
  };
}

export interface TopologyMetadata {
  map_id?: string;
  total_faces?: number;
  timer?: number;
  max_turns?: number;
  valid_actions?: any[];
  [key: string]: any;
}

export interface TopologyData {
  metadata: TopologyMetadata;
  blocks: Block[];
  units: UrbanUnit[];
}

export interface GlobalStateIndicator {
  key: string;
  color?: string;
  getValue: (data: TopologyData | null, global: any) => string | number;
}

const playerIndicators: GlobalStateIndicator[] = (Object.keys(PlayerConfig)).map((key) => {
  const playerType = Number(key) as PlayerType;
  const player = PlayerConfig[playerType];
  return {
    key: `${player.name} Reward`,
    color: player.color,
    getValue: (data, global) => {
      if (playerType === PlayerType.DEVELOPER) {
        return global?.developer_profit ?? 0;
      }
      if (playerType === PlayerType.GOVERNMENT) {
        return global?.government_profit ?? 0;
      }
      return 0;
    }
  };
});

export const GlobalStateIndicatorsConfig: GlobalStateIndicator[] = [
  {
    key: 'Occupied Unit',
    getValue: (data) => {
      const occupiedCount = data?.units?.filter(u => u.state.type !== 0).length ?? 0;
      const totalCount = data?.units?.length ?? 0;
      return `${occupiedCount} / ${totalCount}`;
    }
  },
  ...playerIndicators,
  {
    key: 'Population',
    getValue: (data, global) => global?.total_population ?? 0
  }
];
