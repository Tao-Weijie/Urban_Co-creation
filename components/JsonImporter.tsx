import React from 'react';
import { TopologyData } from '../game_engine/configE';

interface JsonImporterProps {
  gridName: string;
  gameStarted: boolean;
  isMapLoading: boolean;
  onJsonClear: () => void;
  onJsonImported: (data: TopologyData, filename: string) => void;
  onLoadingStart: () => void;
  onLoadingEnd: () => void;
}

export const JsonImporter: React.FC<JsonImporterProps> = ({
  gridName,
  gameStarted,
  isMapLoading,
  onJsonClear,
  onJsonImported,
  onLoadingStart,
  onLoadingEnd,
}) => {
  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    onLoadingStart();
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);

        // Detect UTF-16 BOM
        let encoding = 'utf-8';
        if (uint8Array.length >= 2) {
          if (uint8Array[0] === 0xff && uint8Array[1] === 0xfe) {
            encoding = 'utf-16le';
          } else if (uint8Array[0] === 0xfe && uint8Array[1] === 0xff) {
            encoding = 'utf-16be';
          }
        }

        const decoder = new TextDecoder(encoding);
        const text = decoder.decode(uint8Array);
        const json = JSON.parse(text);

        if (!json.blocks || !json.units || !json.metadata) {
          throw new Error("Invalid JSON: Missing blocks, units, or metadata.");
        }

        // Strict schema check
        for (const b of json.blocks) {
          if (!b.topology || b.topology.id === undefined || !b.topology.neighbor || !b.geometry || !b.geometry.boundary) {
            throw new Error("Invalid JSON: Blocks must contain topology.id, topology.neighbor, and geometry.boundary.");
          }
        }
        for (const u of json.units) {
          if (!u.topology || u.topology.id === undefined || u.topology.blockid === undefined ||
            !u.geometry || !u.geometry.boundary || u.geometry.height === undefined ||
            !u.state || u.state.type === undefined) {
            throw new Error("Invalid JSON: Units must contain topology, geometry (with boundary and height), and state (with type).");
          }
        }

        const completeJson: TopologyData = {
          metadata: json.metadata,
          blocks: json.blocks,
          units: json.units
        };

        onJsonImported(completeJson, file.name);
      } catch (err: any) {
        console.error(err);
        alert("JSON Import Error: " + err.message);
        onLoadingEnd();
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="upload-container">
      {!gridName ? (
        <label className={`absolute inset-0 upload-btn-empty ${gameStarted ? 'disabled' : ''}`}>
          <div className="text-center px-2">
            <p className="text-[9px] font-semibold font-sans">Upload map(.json)</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".json"
            onChange={handleJsonUpload}
            disabled={gameStarted}
          />
        </label>
      ) : (
        <div
          onClick={() => {
            if (!gameStarted) {
              onJsonClear();
            }
          }}
          className={`absolute inset-0 upload-btn-filled ${gameStarted ? 'disabled' : ''}`}
        >
          <span className="font-sans text-[8px] text-zinc-400 dark:text-zinc-500 uppercase font-bold">
            {gameStarted ? 'Locked' : 'Clear Map'}
          </span>
          <span className="truncate w-full font-bold px-1" title={gridName}>
            {gridName}
          </span>
        </div>
      )}

      {/* Bottom-to-top wave fill */}
      {isMapLoading && <div className="upload-wave" />}
    </div>
  );
};
