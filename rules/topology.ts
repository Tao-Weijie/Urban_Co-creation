export interface FaceState {
  built_type?: string;
  is_occupied?: boolean;
  height_floors?: number;
  value?: number;
  population?: number;
}

export interface FaceEvaluation {
  score?: number;
}

export interface Face {
  id: number;
  boundary_polyline: number[][]; // Representing points as [x, y, z]
  neighbors?: number[];
  state?: FaceState;
  evaluation?: FaceEvaluation;
}

export interface TopologyMetadata {
  map_id?: string;
  total_faces?: number;
  [key: string]: any;
}

export interface TopologyData {
  metadata: TopologyMetadata;
  faces: Face[];
}
