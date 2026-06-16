# Topology Grid JSON Specification

This document standardizes the schema and data structure of the Topology Grid JSON files used by the Urban Co-creation web application.

---

## 1. Schema Overview

The JSON root is an object containing two primary keys:
1. `metadata`: General information about the map/grid.
2. `faces`: An array of face objects representing interactive land parcels or buildings.

```json
{
  "metadata": { ... },
  "faces": [ ... ]
}
```

---

## 2. Component Definitions

### 2.1. Metadata Object
Contains high-level characteristics of the imported topology grid.

| Field Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `map_id` | `string` | Unique identifier for the map or grid configuration. | `"urban_fixed_map_01"` |
| `total_faces` | `integer` | Total number of faces defined in the file. | `197` |

---

### 2.2. Face Object
Represents a single land parcel. Each face defines its boundary, relationships with neighbors, land-use state, and current performance evaluation.

| Field Name | Type | Description |
| :--- | :--- | :--- |
| `id` | `integer` | A unique identifier for the face. |
| `neighbors` | `array of integers` | List of face IDs that share an edge with this face. |
| `boundary_polyline` | `array of [number, number, number]` | Ordered list of 3D vertices `[x, y, z]` representing the parcel's perimeter. Typically flat on the X-Y plane (`z = 0`). The loop is closed automatically from the last point to the first. |
| `state` | `object` | Specifies occupancy status, building category, and floor counts. |
| `evaluation` | `object` | Evaluation metrics (such as design/suitability score). |

#### `state` Fields
- `is_occupied` (`boolean`): Whether the parcel has building construction. If `false`, `built_type` must be `"empty"` and `height_floors` must be `0`.
- `built_type` (`string`): The land-use type (see [Section 3](#3-recognized-build-types-and-styling)).
- `height_floors` (`integer`): Number of floors. Used to compute 3D extrusion height ($height = floors \times 3m$). Flat parcels have `0`.

#### `evaluation` Fields
- `score` (`integer`): A performance indicator score between `0` and `100`. Flat/unoccupied parcels default to `0`.

---

## 3. Recognized Build Types and Styling

The frontend interprets `built_type` strings to assign mesh colors and default opacities. If a parcel is unoccupied, it defaults to the `empty` style.

| Build Type | Key Value (JSON) | RGB Color Hex | Visual Description | Frontend Opacity (Extruded vs. Flat) |
| :--- | :--- | :--- | :--- | :--- |
| **Empty** | `"empty"` | `#4B5563` | Dark Gray (Unoccupied) | `0.15` |
| **Residential** | `"residential"` | `#F59E0B` | Amber/Orange | `0.65` (Extruded) |
| **Park / Greenway** | `"park"` / `"greenway"` / `"green"` | `#10B981` | Emerald Greenway | `0.15` (Flat) |

---

## 4. Coordinate System Conventions

- **Units**: Metric system (1 unit = 1 meter).
- **Axis Layout**: **Z-Up** coordinate system.
  - $X$ axis: Horizontal alignment (West-East).
  - $Y$ axis: Vertical alignment (South-North).
  - $Z$ axis: Height alignment (Altitude/Extrusion direction).
- **Grid Winding**: Boundary vertices should be ordered sequentially along the polygon perimeter (clockwise or counter-clockwise).

---

## 5. Complete JSON Example

Below is a valid example file featuring two adjacent parcels: face `101` (occupied residential building) and face `102` (unoccupied park zone).

```json
{
  "metadata": {
    "map_id": "urban_demo_map_01",
    "total_faces": 2
  },
  "faces": [
    {
      "id": 101,
      "neighbors": [102],
      "boundary_polyline": [
        [-15.0, 0.0, 0.0],
        [0.0, 0.0, 0.0],
        [0.0, 15.0, 0.0],
        [-15.0, 15.0, 0.0]
      ],
      "state": {
        "is_occupied": true,
        "built_type": "residential",
        "height_floors": 3
      },
      "evaluation": {
        "score": 85
      }
    },
    {
      "id": 102,
      "neighbors": [101],
      "boundary_polyline": [
        [0.0, 0.0, 0.0],
        [15.0, 0.0, 0.0],
        [15.0, 15.0, 0.0],
        [0.0, 15.0, 0.0]
      ],
      "state": {
        "is_occupied": true,
        "built_type": "park",
        "height_floors": 0
      },
      "evaluation": {
        "score": 95
      }
    }
  ]
}
```
