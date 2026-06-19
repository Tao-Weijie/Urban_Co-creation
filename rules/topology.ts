export interface Block {
  id: number;
  neighbor: number[];
  boundary: number[][]; // Representing points as [x, y, z]
}

export interface UrbanUnit {
  id: number;
  parentid: number;
  type: number; // 0: empty, 1: residential, 2: green
  value: number;
  population: number;
  boundary: number[][]; // Representing points as [x, y, z]
  height: number; // Number of floors
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

