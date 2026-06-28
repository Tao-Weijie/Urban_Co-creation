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
  [key: string]: any;
}

export interface TopologyData {
  metadata: TopologyMetadata;
  blocks: Block[];
  units: UrbanUnit[];
}

export enum ActionType {
  SKIP = 0,
  PLACE = 1,
  REPLACE = 2
}

