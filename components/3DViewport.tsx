import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Block, UrbanUnit, TopologyData, UnitTypeConfig, UnitType, DISPLAY_MODES, DisplayModeKey } from '@/game_engine/configE';

import { useGame } from '../context/GameContext';

export default function Viewport3D() {
  const {
    modelFile,
    modelName,
    gridName,
    displayedTopologyData,
    standardView,
    setStandardView,
    handleUnitHover,
    isBrowsingHistory,
    isAiThinking,
    gameStarted,
    isRlTraining,
    roleAISettings,
    displayedTurnOrder,
    displayedActiveRoleIndex,
    setSelectedUnitForGameAction,
    setIsGameActionModalOpen,
    setSelectedUnitForEdit,
    setIsEditModalOpen,
    setIsLoading,
    setIsModelLoading,
    isCameraLocked,
    displayMode,
    theme
  } = useGame();

  const topologyData = displayedTopologyData;

  const onUnitClick = (unit: UrbanUnit) => {
    if (isBrowsingHistory || isRlTraining) return; // Disable clicking during history browsing or training
    const activePlayer = displayedTurnOrder[displayedActiveRoleIndex];
    if (isAiThinking || (gameStarted && roleAISettings[String(activePlayer)])) return; // Disable clicking during AI thinking
    if (gameStarted) {
      setSelectedUnitForGameAction(unit);
      setIsGameActionModalOpen(true);
    } else {
      setSelectedUnitForEdit(unit);
      setIsEditModalOpen(true);
    }
  };

  const onUnitHover = handleUnitHover;
  const onStandardViewProcessed = () => setStandardView(null);
  const onLoadingChange = (loading: boolean) => {
    setIsLoading(loading);
    setIsModelLoading(loading);
  };

  const containerRef = useRef<HTMLDivElement>(null);

  const onUnitClickRef = useRef(onUnitClick);
  const onUnitHoverRef = useRef(onUnitHover);

  // Keep refs synchronized with props on every render
  useEffect(() => {
    onUnitClickRef.current = onUnitClick;
    onUnitHoverRef.current = onUnitHover;
  });

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const backgroundGroupRef = useRef<THREE.Group | null>(null);
  const topologyGroupRef = useRef<THREE.Group | null>(null);
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const xAxisRef = useRef<THREE.Line | null>(null);
  const yAxisRef = useRef<THREE.Line | null>(null);

  // Interactive / Hover references
  const raycasterRef = useRef(new THREE.Raycaster());

  // Cache last loaded model/grid names to prevent view reset on edits
  const lastModelNameRef = useRef<string>('');
  const lastGridNameRef = useRef<string>('');
  const lastDisplayModeRef = useRef<string | null>(null);

  // Reusable materials
  const blockMaterialRef = useRef(
    new THREE.MeshStandardMaterial({
      color: 0x4b5563,
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  );

  const materials = React.useMemo(() => {
    const map = new Map<number, THREE.MeshStandardMaterial>();
    Object.entries(UnitTypeConfig).forEach(([typeStr, conf]) => {
      const typeNum = Number(typeStr);
      map.set(typeNum, new THREE.MeshStandardMaterial({
        color: new THREE.Color(conf.color),
        roughness: 0.4,
        metalness: 0.2,
        transparent: conf.opacity < 1,
        opacity: conf.opacity,
        depthWrite: conf.opacity === 1,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      }));
    });
    return map;
  }, []);

  const hoverMaterialRef = useRef(
    new THREE.MeshStandardMaterial({
      color: 0xec4899,
      roughness: 0.4,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  );



  const outlineMaterialRef = useRef(
    new THREE.LineBasicMaterial({
      color: 0x27272a, // Zinc-800
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    })
  );

  const sphereMaterialRef = useRef(
    new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      roughness: 0.3,
      metalness: 0.3
    })
  );

  // Mesh cache and hover tracking
  const unitMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const hoveredUnitIdRef = useRef<number | null>(null);

  const getBaseMaterial = (type?: number) => {
    const t = type !== undefined ? type : 0;
    return materials.get(t) || materials.get(0)!;
  };

  // Initialize Three.js Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Initialize Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Initialize Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    camera.position.set(15, -20, 15);
    camera.up.set(0, 0, 1); // Z-up coordinate system
    cameraRef.current = camera;

    // 3. Initialize WebGLRenderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Groups
    const backgroundGroup = new THREE.Group();
    scene.add(backgroundGroup);
    backgroundGroupRef.current = backgroundGroup;

    const topologyGroup = new THREE.Group();
    scene.add(topologyGroup);
    topologyGroupRef.current = topologyGroup;

    // 5. Add 100x100 Grid (divisions=20, flat on X-Y plane)
    const gridHelper = new THREE.GridHelper(100, 20, 0x888888, 0x888888);
    if (gridHelper.material) {
      const mat = gridHelper.material as THREE.Material;
      mat.transparent = true;
      mat.opacity = 0.35;
    }
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(0, 0, 0);
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // 6. Custom X (Red) and Y (Green) axes
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.01),
      new THREE.Vector3(50, 0, 0.01)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const xAxis = new THREE.Line(xGeometry, xMaterial);
    scene.add(xAxis);
    xAxisRef.current = xAxis;

    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.01),
      new THREE.Vector3(0, 50, 0.01)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const yAxis = new THREE.Line(yGeometry, yMaterial);
    scene.add(yAxis);
    yAxisRef.current = yAxis;

    // 7. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.55);
    hemisphereLight.position.set(0, 0, 150);
    scene.add(hemisphereLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(50, -60, 80);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x3b82f6, 0.4);
    dirLight2.position.set(-50, 60, -30);
    scene.add(dirLight2);

    // 8. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.15;
    controls.minDistance = 2;
    controls.maxDistance = 5000;
    controlsRef.current = controls;

    const clearHoverState = () => {
      if (hoveredUnitIdRef.current !== null && hoveredMeshRef.current) {
        const prevUnit = hoveredMeshRef.current.userData.unit;
        if (prevUnit) {
          hoveredMeshRef.current.material = getBaseMaterial(prevUnit.state.type);
        }
      }
      hoveredUnitIdRef.current = null;
      hoveredMeshRef.current = null;
      onUnitHoverRef.current(null, 0, 0);
    };

    // 9. Pointer Move (Hover) Handler
    const handlePointerMove = (event: PointerEvent) => {
      if (!topologyGroupRef.current || topologyGroupRef.current.children.length === 0) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const pointerY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(new THREE.Vector2(pointerX, pointerY), camera);

      const intersects = raycasterRef.current.intersectObjects(topologyGroupRef.current.children, true);
      const hitRegion = intersects.find(item => item.object.userData.isUnit === true);

      if (hitRegion) {
        const hitMesh = hitRegion.object as THREE.Mesh;
        const targetUnitId = hitMesh.userData.unitId as number;
        const unitData = hitMesh.userData.unit;

        if (unitData) {
          if (hoveredUnitIdRef.current !== targetUnitId) {
            // Restore previous hovered mesh
            if (hoveredUnitIdRef.current !== null && hoveredMeshRef.current) {
              const prevUnit = hoveredMeshRef.current.userData.unit;
              if (prevUnit) {
                hoveredMeshRef.current.material = getBaseMaterial(prevUnit.state.type);
              }
            }

            // Highlight new hovered unit
            hitMesh.material = hoverMaterialRef.current;

            hoveredUnitIdRef.current = targetUnitId;
            hoveredMeshRef.current = hitMesh;
          }

          onUnitHoverRef.current(unitData, event.clientX, event.clientY);
          container.style.cursor = 'pointer';
        } else {
          clearHoverState();
          container.style.cursor = 'default';
        }
      } else {
        clearHoverState();
        container.style.cursor = 'default';
      }
    };
    renderer.domElement.addEventListener('pointermove', handlePointerMove);

    let pointerDownX = 0;
    let pointerDownY = 0;

    const handlePointerDownCoords = (event: PointerEvent) => {
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
    };

    const handlePointerUpCoords = (event: PointerEvent) => {
      const diffX = Math.abs(event.clientX - pointerDownX);
      const diffY = Math.abs(event.clientY - pointerDownY);

      // Only process click if the drag distance is small (not a camera rotation)
      if (diffX < 4 && diffY < 4) {
        if (!topologyGroupRef.current || topologyGroupRef.current.children.length === 0 || !cameraRef.current) return;

        const rect = renderer.domElement.getBoundingClientRect();
        const pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const pointerY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(new THREE.Vector2(pointerX, pointerY), cameraRef.current);

        const intersects = raycasterRef.current.intersectObjects(topologyGroupRef.current.children, true);
        const hitRegion = intersects.find(item => item.object.userData.isUnit === true);

        if (hitRegion) {
          const hitMesh = hitRegion.object as THREE.Mesh;
          const unitData = hitMesh.userData.unit;
          if (unitData) {
            onUnitClickRef.current(unitData);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDownCoords);
    renderer.domElement.addEventListener('pointerup', handlePointerUpCoords);

    // 10. Handle Window Resize
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 11. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 12. Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDownCoords);
      renderer.domElement.removeEventListener('pointerup', handlePointerUpCoords);
      cancelAnimationFrame(animationFrameId);

      gridHelper.dispose();
      xGeometry.dispose();
      xMaterial.dispose();
      yGeometry.dispose();
      yMaterial.dispose();
      controls.dispose();
      renderer.dispose();

      blockMaterialRef.current.dispose();
      materials.forEach(mat => mat.dispose());
      hoverMaterialRef.current.dispose();
      outlineMaterialRef.current.dispose();
      sphereMaterialRef.current.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Helpers for Camera view calculations
  const getBackgroundBox = () => {
    const backgroundGroup = backgroundGroupRef.current;
    const box = new THREE.Box3();
    let hasBg = false;
    if (backgroundGroup && backgroundGroup.children.length > 0) {
      box.setFromObject(backgroundGroup);
      hasBg = true;
    }
    return { box, hasBg };
  };

  const getTopologyBox = () => {
    const topologyGroup = topologyGroupRef.current;
    const box = new THREE.Box3();
    let hasTopo = false;
    if (topologyGroup && topologyGroup.children.length > 0) {
      box.setFromObject(topologyGroup);
      hasTopo = true;
    }
    return { box, hasTopo };
  };

  const getCombinedCenterAndSize = () => {
    const combinedBox = new THREE.Box3();
    let hasObject = false;

    const { box: bgBox, hasBg } = getBackgroundBox();
    if (hasBg) {
      combinedBox.union(bgBox);
      hasObject = true;
    }

    const { box: topoBox, hasTopo } = getTopologyBox();
    if (hasTopo) {
      combinedBox.union(topoBox);
      hasObject = true;
    }

    const center = new THREE.Vector3(0, 0, 0);
    const size = new THREE.Vector3(0, 0, 0);
    if (hasObject) {
      combinedBox.getCenter(center);
      combinedBox.getSize(size);
    }
    return { center, size, hasObject };
  };

  const getFitDistance = () => {
    const { size } = getCombinedCenterAndSize();
    const maxDim = Math.max(size.x, size.y, size.z);
    const camera = cameraRef.current;
    if (!camera) return 50;
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.25; // Add padding
    return Math.max(15, Math.min(1000, cameraZ));
  };

  const fitCameraToAllUploaded = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const { center, size, hasObject } = getCombinedCenterAndSize();

    if (!hasObject) {
      camera.position.set(15, -20, 15);
      controls.target.set(0, 0, 0);
      controls.update();
      return;
    }

    const dist = getFitDistance();
    camera.position.set(center.x + dist * 0.4, center.y - dist * 0.65, center.z + dist * 0.5);
    controls.target.copy(center);
    controls.update();
  };

  // Setup / Clear background model
  const clearBackgroundModel = () => {
    const backgroundGroup = backgroundGroupRef.current;
    if (!backgroundGroup) return;

    backgroundGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m?.dispose());
      }
    });

    while (backgroundGroup.children.length > 0) {
      backgroundGroup.remove(backgroundGroup.children[0]);
    }

    const hasTopo = topologyGroupRef.current && topologyGroupRef.current.children.length > 0;
    if (!hasTopo) {
      fitCameraToAllUploaded();
    }
  };

  const setupBackgroundModel = (model: THREE.Group | THREE.Object3D) => {
    const backgroundGroup = backgroundGroupRef.current;
    if (!backgroundGroup) return;

    clearBackgroundModel();

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Cache original material
        mesh.userData.originalMaterial = mesh.material;

        const hasVertexColors = !!(mesh.geometry && mesh.geometry.attributes.color);
        let hasTexture = false;
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            const anyMat = mat as any;
            if (anyMat && (anyMat.map || anyMat.normalMap || anyMat.bumpMap || anyMat.roughnessMap || anyMat.lightMap)) {
              hasTexture = true;
              break;
            }
          }
        }

        if (!hasTexture) {
          mesh.material = new THREE.MeshStandardMaterial({
            color: hasVertexColors ? 0xffffff : 0xcccccc,
            vertexColors: hasVertexColors,
            roughness: 0.8,
            metalness: 0.1,
            transparent: false
          });
          mesh.userData.isOriginallyWhite = !hasVertexColors;
        } else {
          mesh.userData.isOriginallyWhite = false;
        }
      }
    });

    backgroundGroup.add(model);
  };

  // Setup / Clear topology grid
  const clearTopologyGroupObjects = () => {
    const topologyGroup = topologyGroupRef.current;
    if (!topologyGroup) return;

    // Reset hover states
    hoveredUnitIdRef.current = null;
    hoveredMeshRef.current = null;
    onUnitHover(null);

    topologyGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
      } else if ((child as THREE.Line).isLine) {
        const line = child as THREE.Line;
        line.geometry.dispose();
      }
    });

    while (topologyGroup.children.length > 0) {
      topologyGroup.remove(topologyGroup.children[0]);
    }

    unitMeshesRef.current.clear();
  };

  const updateTopologyMaterials = (data: TopologyData) => {
    data.units.forEach((unit) => {
      const unitId = unit.topology.id;
      const mesh = unitMeshesRef.current.get(unitId);
      if (mesh) {
        // Update unit reference inside mesh userData
        mesh.userData.unit = unit;

        // Apply correct material based on unit type, unless it's currently hovered
        if (hoveredUnitIdRef.current === unitId) {
          mesh.material = hoverMaterialRef.current;
        } else {
          mesh.material = getBaseMaterial(unit.state.type);
        }
      }
    });
  };

  const setupTopologyGrid = (data: TopologyData) => {
    const topologyGroup = topologyGroupRef.current;
    if (!topologyGroup) return;

    // Check if we can reuse the existing grid and only update materials
    const canReuseGrid =
      gridName === lastGridNameRef.current &&
      displayMode === lastDisplayModeRef.current &&
      unitMeshesRef.current.size === data.units.length &&
      data.units.every((u) => unitMeshesRef.current.has(u.topology.id));

    if (canReuseGrid) {
      updateTopologyMaterials(data);
      return;
    }

    lastDisplayModeRef.current = displayMode;
    clearTopologyGroupObjects();

    if (!data.blocks || data.blocks.length === 0) return;

    const uniqueVertices = new Map<string, THREE.Vector3>();
    const modeConfig = DISPLAY_MODES[displayMode as DisplayModeKey] || DISPLAY_MODES.N;

    // 1. Construct Block geometries (flat faces) and meshes
    data.blocks.forEach((block) => {
      const geom = block.geometry || (block as any);
      const topo = block.topology || (block as any);
      const boundary = geom.boundary;
      if (boundary && boundary.length > 2) {
        const shape = new THREE.Shape();
        shape.moveTo(boundary[0][0], boundary[0][1]);
        for (let i = 1; i < boundary.length; i++) {
          shape.lineTo(boundary[i][0], boundary[i][1]);
        }
        shape.closePath();

        let geometry: THREE.BufferGeometry = new THREE.ShapeGeometry(shape);
        geometry.translate(0, 0, 0.02);

        if (geometry.index !== null) {
          const nonIndexedGeometry = geometry.toNonIndexed();
          geometry.dispose();
          geometry = nonIndexedGeometry;
        }

        const blockVal = block.state?.value ?? 30.0;
        const style = modeConfig.getBlockStyle(blockVal, theme);
        const blockMaterial = new THREE.MeshStandardMaterial({
          color: new THREE.Color(style.color),
          roughness: 0.4,
          metalness: 0.2,
          transparent: true,
          opacity: style.opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        });

        const blockMesh = new THREE.Mesh(geometry, blockMaterial);
        blockMesh.userData = {
          isBlock: true,
          name: "Topology Block Mesh",
          blockId: topo.id
        };
        topologyGroup.add(blockMesh);

        boundary.forEach((p) => {
          const key = `${p[0].toFixed(2)},${p[1].toFixed(2)},${p[2].toFixed(2)}`;
          if (!uniqueVertices.has(key)) {
            uniqueVertices.set(key, new THREE.Vector3(p[0], p[1], p[2] + 0.04));
          }
        });
      }
    });

    // 2. Construct Unit geometries (extruded buildings)
    if (modeConfig.showUnits) {
      data.units.forEach((unit) => {
        const geom = unit.geometry || (unit as any);
        const topo = unit.topology || (unit as any);
        const boundary = geom.boundary;
        if (boundary && boundary.length > 2 && geom.height > 0) {
          const shape = new THREE.Shape();
          shape.moveTo(boundary[0][0], boundary[0][1]);
          for (let i = 1; i < boundary.length; i++) {
            shape.lineTo(boundary[i][0], boundary[i][1]);
          }
          shape.closePath();

          // 支持自身的天井挖孔
          const hole = geom.hole;
          if (hole && hole.length > 0) {
            hole.forEach((holeBoundary: any) => {
              if (holeBoundary && holeBoundary.length > 2) {
                const holePath = new THREE.Path();
                holePath.moveTo(holeBoundary[0][0], holeBoundary[0][1]);
                for (let i = 1; i < holeBoundary.length; i++) {
                  holePath.lineTo(holeBoundary[i][0], holeBoundary[i][1]);
                }
                holePath.closePath();
                shape.holes.push(holePath);
              }
            });
          }

          const height = geom.height; // 直接采用绝对高度拉伸
          let geometry: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: false
          });

          if (geometry.index !== null) {
            const nonIndexedGeometry = geometry.toNonIndexed();
            geometry.dispose();
            geometry = nonIndexedGeometry;
          }

          const meshMaterial = getBaseMaterial(unit.state.type);
          const unitMesh = new THREE.Mesh(geometry, meshMaterial);

          // Calculate Z position to stack units within the same building, using absolute height
          const startZ = boundary[0][2];
          unitMesh.position.z = startZ;

          unitMesh.userData = {
            isRegion: true,
            isUnit: true,
            unitId: topo.id,
            unit: unit
          };

          topologyGroup.add(unitMesh);
          unitMeshesRef.current.set(topo.id, unitMesh);
        }
      });
    }

    // 3. Draw outlines
    const allOutlinePoints: THREE.Vector3[] = [];

    // Draw outlines for blocks
    data.blocks.forEach((block) => {
      const geom = block.geometry || (block as any);
      const boundary = geom.boundary;
      if (boundary && boundary.length > 2) {
        for (let i = 0; i < boundary.length; i++) {
          const p1 = boundary[i];
          const p2 = boundary[(i + 1) % boundary.length];
          allOutlinePoints.push(new THREE.Vector3(p1[0], p1[1], p1[2] + 0.01));
          allOutlinePoints.push(new THREE.Vector3(p2[0], p2[1], p2[2] + 0.01));
        }
      }
    });

    // Outlines for units are removed as requested.

    if (allOutlinePoints.length > 0) {
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(allOutlinePoints);
      const lines = new THREE.LineSegments(outlineGeometry, outlineMaterialRef.current);
      topologyGroup.add(lines);
    }

    // Vertices as spheres are removed as requested.
  };

  // Watch for model File changes
  useEffect(() => {
    if (!modelFile) {
      clearBackgroundModel();
      lastModelNameRef.current = '';
      return;
    }

    onLoadingChange(true);
    const extension = modelFile.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    if (extension === 'glb' || extension === 'gltf') {
      reader.onload = (e) => {
        const contents = e.target?.result as ArrayBuffer;
        const loader = new GLTFLoader();
        loader.parse(
          contents,
          '',
          (gltf) => {
            setupBackgroundModel(gltf.scene);
            onLoadingChange(false);
            if (modelName && modelName !== lastModelNameRef.current) {
              lastModelNameRef.current = modelName;
              const hasGridAlready = topologyGroupRef.current && topologyGroupRef.current.children.length > 0;
              if (!hasGridAlready) {
                fitCameraToAllUploaded();
              }
            }
          },
          (err) => {
            console.error(err);
            alert("Failed to load GLTF/GLB background model.");
            onLoadingChange(false);
          }
        );
      };
      reader.readAsArrayBuffer(modelFile);
    } else if (extension === 'obj') {
      reader.onload = (e) => {
        const contents = e.target?.result as string;
        try {
          const loader = new OBJLoader();
          const obj = loader.parse(contents);
          setupBackgroundModel(obj);
          if (modelName && modelName !== lastModelNameRef.current) {
            lastModelNameRef.current = modelName;
            const hasGridAlready = topologyGroupRef.current && topologyGroupRef.current.children.length > 0;
            if (!hasGridAlready) {
              fitCameraToAllUploaded();
            }
          }
        } catch (err) {
          console.error(err);
          alert("Failed to load OBJ background model.");
        }
        onLoadingChange(false);
      };
      reader.readAsText(modelFile);
    } else {
      alert("Invalid format! Please upload a .glb, .gltf or .obj file as background.");
      onLoadingChange(false);
    }
  }, [modelFile, modelName]);

  // Watch for topologyData changes
  useEffect(() => {
    if (!topologyData) {
      clearTopologyGroupObjects();
      lastGridNameRef.current = '';
      return;
    }
    setupTopologyGrid(topologyData);
    if (gridName && gridName !== lastGridNameRef.current) {
      lastGridNameRef.current = gridName;
      const hasBgAlready = backgroundGroupRef.current && backgroundGroupRef.current.children.length > 0;
      if (!hasBgAlready) {
        fitCameraToAllUploaded();
      }
    }
  }, [topologyData, gridName, displayMode, theme]);



  // Watch for standardView triggers
  useEffect(() => {
    if (!standardView) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (camera && controls) {
      const { center } = getCombinedCenterAndSize();
      const dist = getFitDistance();

      if (standardView === 'top') {
        camera.up.set(0, 1, 0);
        camera.position.set(center.x, center.y + 0.001, center.z + dist);
      } else if (standardView === 'front') {
        camera.up.set(0, 0, 1);
        camera.position.set(center.x, center.y - dist, center.z);
      } else if (standardView === 'left') {
        camera.up.set(0, 0, 1);
        camera.position.set(center.x - dist, camera.position.y, center.z); // wait, let's keep y position target correct
      }

      controls.target.copy(center);
      controls.update();
    }

    onStandardViewProcessed();
  }, [standardView]);

  // Watch for model or topology loading to show/hide base grid and XY axes helper
  useEffect(() => {
    const hasData = !!modelName || !!topologyData;
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = !hasData;
    }
    if (xAxisRef.current) {
      xAxisRef.current.visible = !hasData;
    }
    if (yAxisRef.current) {
      yAxisRef.current.visible = !hasData;
    }
  }, [modelName, topologyData]);

  // Watch for camera lock updates
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !isCameraLocked;
    }
  }, [isCameraLocked]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
    />
  );
}
