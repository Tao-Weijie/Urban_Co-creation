"use client";

import React, { useState } from 'react';
import {
  Face,
  TopologyData,
  TopologyMetadata,
  evaluateUrbanEconomy
} from '@/rules/evaluate';

import Viewport3D from '@/components/3DViewport';
import LeftBar from '@/components/LeftBar';
import FacePropertiesPanel from '@/components/FacePropertiesPanel';
import BottomBar from '@/components/BottomBar';
import EditFaceModal from '@/components/EditFaceModal';

export default function Home() {
  // Model and Grid metadata states
  const [modelName, setModelName] = useState<string>('');
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [gridName, setGridName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isForceWhite, setIsForceWhite] = useState<boolean>(false);

  // Active loaded topology data and stats
  const [topologyData, setTopologyData] = useState<TopologyData | null>(null);
  const [macroStats, setMacroStats] = useState({
    government_tax: 0,
    developer_profit: 0,
    total_population: 0
  });

  // UI Interactive States
  const [hoveredFaceInfo, setHoveredFaceInfo] = useState<Face | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number, y: number } | null>(null);
  const [selectedFaceForEdit, setSelectedFaceForEdit] = useState<Face | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Hover position helper
  const handleFaceHover = (face: Face | null, x?: number, y?: number) => {
    setHoveredFaceInfo(face);
    if (face && x !== undefined && y !== undefined) {
      setHoverPosition({ x, y });
    } else {
      setHoverPosition(null);
    }
  };

  // View switch trigger
  const [standardView, setStandardView] = useState<'top' | 'front' | 'left' | null>(null);

  // Upload environment background model
  const handleModelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setModelFile(file);
      setModelName(file.name);
    }
  };

  // Clear background model
  const clearBackgroundModel = () => {
    setModelFile(null);
    setModelName('');
  };

  // Run urban economics evaluation and set results in state
  const runEvaluation = (faces: Face[], currentGridName: string, metadata?: TopologyMetadata) => {
    try {
      const data = evaluateUrbanEconomy(faces);
      
      setMacroStats({
        government_tax: data.government_tax,
        developer_profit: data.developer_profit,
        total_population: data.total_population
      });

      const updatedTopology: TopologyData = {
        metadata: metadata || topologyData?.metadata || { map_id: "urban_map", total_faces: faces.length },
        faces: data.faces
      };
      
      setTopologyData(updatedTopology);
    } catch (err: any) {
      console.error("Failed to run urban economics evaluation:", err);
      alert("Evaluation Error: " + err.message);
    }
  };

  // Upload topology JSON file
  const handleJsonUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
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
        
        if (json.faces) {
          setGridName(file.name);
          runEvaluation(json.faces, file.name, json.metadata);
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse grid JSON. Ensure it strictly matches topology specifications.");
      }
      setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Clear topology grid 3D objects and reset states
  const clearTopologyGrid = () => {
    setTopologyData(null);
    setGridName('');
    setHoveredFaceInfo(null);
    setMacroStats({
      government_tax: 0,
      developer_profit: 0,
      total_population: 0
    });
  };

  // Save modifications to the selected face and trigger evaluation update
  const handleSaveFaceEdit = (editBuiltType: string) => {
    if (!selectedFaceForEdit || !topologyData) return;

    const isOccupied = editBuiltType !== 'empty';
    const heightFloors = isOccupied ? 1 : 0;

    const updatedFaces = topologyData.faces.map((f) => {
      if (f.id === selectedFaceForEdit.id) {
        return {
          ...f,
          state: {
            ...f.state,
            built_type: editBuiltType,
            is_occupied: isOccupied,
            height_floors: heightFloors
          }
        };
      }
      return f;
    });

    runEvaluation(updatedFaces, gridName);
    setIsEditModalOpen(false);

    // Update the hover info if the currently hovered face was the edited one
    if (hoveredFaceInfo && hoveredFaceInfo.id === selectedFaceForEdit.id) {
      const updatedFace = updatedFaces.find(f => f.id === selectedFaceForEdit.id);
      if (updatedFace) {
        setHoveredFaceInfo(updatedFace);
      }
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-zinc-950 font-sans text-white select-none">
      
      {/* 3D Viewport Container */}
      <Viewport3D
        modelFile={modelFile}
        modelName={modelName}
        gridName={gridName}
        topologyData={topologyData}
        isForceWhite={isForceWhite}
        standardView={standardView}
        onStandardViewProcessed={() => setStandardView(null)}
        onFaceHover={handleFaceHover}
        onFaceClick={(face) => {
          setSelectedFaceForEdit(face);
          setIsEditModalOpen(true);
        }}
        onLoadingChange={setIsLoading}
      />

      {/* Floating Menu Toolbar (Left Sidebar) */}
      <LeftBar
        modelName={modelName}
        gridName={gridName}
        isLoading={isLoading}
        macroStats={macroStats}
        isForceWhite={isForceWhite}
        onModelUpload={handleModelUpload}
        onModelClear={clearBackgroundModel}
        onJsonUpload={handleJsonUpload}
        onJsonClear={clearTopologyGrid}
        onToggleForceWhite={() => setIsForceWhite(!isForceWhite)}
        hasTopologyData={topologyData !== null}
      />

      {/* Hover Information Panel (Follows cursor) */}
      {!isEditModalOpen && (
        <FacePropertiesPanel hoveredFaceInfo={hoveredFaceInfo} hoverPosition={hoverPosition} />
      )}

      {/* Standard Views Selector (Bottom Center) */}
      <BottomBar onSetView={setStandardView} />

      {/* Edit Face Properties Modal Popup */}
      <EditFaceModal
        isOpen={isEditModalOpen}
        face={selectedFaceForEdit}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveFaceEdit}
      />

    </div>
  );
}
