import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Face, TopologyData } from '@/rules/evaluate';

interface Viewport3DProps {
  modelFile: File | null;
  modelName: string;
  gridName: string;
  topologyData: TopologyData | null;
  isForceWhite: boolean;
  standardView: 'top' | 'front' | 'left' | null;
  onStandardViewProcessed: () => void;
  onFaceHover: (face: Face | null, x?: number, y?: number) => void;
  onFaceClick: (face: Face) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

// Helper to set range colors in a BufferGeometry's 4-component color attribute
const setRangeColor = (
  geometry: THREE.BufferGeometry,
  start: number,
  count: number,
  color: THREE.Color,
  opacity: number
) => {
  const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
  if (!colorAttr) return;
  const array = colorAttr.array as Float32Array;
  for (let i = start; i < start + count; i++) {
    array[i * 4] = color.r;
    array[i * 4 + 1] = color.g;
    array[i * 4 + 2] = color.b;
    array[i * 4 + 3] = opacity;
  }
  colorAttr.needsUpdate = true;
};

// Helper to color face by build type and occupancy status
const getColorByBuiltType = (type?: string, isOccupied?: boolean) => {
  if (!isOccupied) return 0x4b5563; // Unoccupied: dark gray
  switch (type?.toLowerCase()) {
    case 'residential':
      return 0xf59e0b; // Amber/Orange
    case 'park':
    case 'greenway':
    case 'green':
      return 0x10b981; // Green
    default:
      return 0x3b82f6; // Default Blue
  }
};

export default function Viewport3D({
  modelFile,
  modelName,
  gridName,
  topologyData,
  isForceWhite,
  standardView,
  onStandardViewProcessed,
  onFaceHover,
  onFaceClick,
  onLoadingChange
}: Viewport3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const backgroundGroupRef = useRef<THREE.Group | null>(null);
  const topologyGroupRef = useRef<THREE.Group | null>(null);
  
  // Interactive / Hover references
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);
  const hoveredFaceIdRef = useRef<number | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());

  // Cache last loaded model/grid names to prevent view reset on edits
  const lastModelNameRef = useRef<string>('');
  const lastGridNameRef = useRef<string>('');

  // Cache materials
  const whiteMaterialRef = useRef(
    new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      roughness: 0.7,
      metalness: 0.15,
      transparent: false
    })
  );

  // Initialize Three.js Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Initialize Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x09090b);

    // 2. Initialize Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    camera.position.set(15, -20, 15);
    camera.up.set(0, 0, 1); // Z-up coordinate system
    cameraRef.current = camera;

    // 3. Initialize WebGLRenderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    const gridHelper = new THREE.GridHelper(100, 20, 0xffffff, 0xffffff);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.set(0, 0, 0);
    scene.add(gridHelper);

    // 6. Custom X (Red) and Y (Green) axes
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.01),
      new THREE.Vector3(50, 0, 0.01)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    const xAxis = new THREE.Line(xGeometry, xMaterial);
    scene.add(xAxis);

    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0.01),
      new THREE.Vector3(0, 50, 0.01)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const yAxis = new THREE.Line(yGeometry, yMaterial);
    scene.add(yAxis);

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
    controls.maxDistance = 1500;
    controlsRef.current = controls;

    const clearHoverState = () => {
      if (hoveredFaceIdRef.current !== null && hoveredMeshRef.current) {
        const hitMesh = hoveredMeshRef.current;
        const faceRanges = hitMesh.userData.faceRanges as {
          id: number;
          start: number;
          count: number;
          originalColor: THREE.Color;
          originalOpacity: number;
        }[];
        const prevRange = faceRanges.find(r => r.id === hoveredFaceIdRef.current);
        if (prevRange) {
          setRangeColor(
            hitMesh.geometry,
            prevRange.start,
            prevRange.count,
            prevRange.originalColor,
            prevRange.originalOpacity
          );
        }
      }
      hoveredFaceIdRef.current = null;
      hoveredMeshRef.current = null;
      onFaceHover(null, 0, 0);
    };

    // 9. Pointer Move (Hover) Handler
    const handlePointerMove = (event: PointerEvent) => {
      if (!topologyGroupRef.current || topologyGroupRef.current.children.length === 0) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      const pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const pointerY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycasterRef.current.setFromCamera(new THREE.Vector2(pointerX, pointerY), camera);
      
      const intersects = raycasterRef.current.intersectObjects(topologyGroupRef.current.children, true);
      const hitRegion = intersects.find(item => item.object.userData.isRegion === true && item.faceIndex !== undefined);

      if (hitRegion && hitRegion.face) {
        const hitMesh = hitRegion.object as THREE.Mesh;
        const faceRanges = hitMesh.userData.faceRanges as {
          id: number;
          start: number;
          count: number;
          originalColor: THREE.Color;
          originalOpacity: number;
        }[];
        const facesData = hitMesh.userData.facesData as Face[];

        const vertexIndex = hitRegion.face.a;
        const hitRange = faceRanges.find(r => vertexIndex >= r.start && vertexIndex < r.start + r.count);

        if (hitRange) {
          if (hoveredFaceIdRef.current !== hitRange.id) {
            // Restore previous hovered face's colors
            if (hoveredFaceIdRef.current !== null) {
              const prevRange = faceRanges.find(r => r.id === hoveredFaceIdRef.current);
              if (prevRange) {
                setRangeColor(
                  hitMesh.geometry,
                  prevRange.start,
                  prevRange.count,
                  prevRange.originalColor,
                  prevRange.originalOpacity
                );
              }
            }

            // Highlight new hovered face (magenta color 0xec4899, alpha 0.85)
            const highlightColor = new THREE.Color(0xec4899);
            setRangeColor(
              hitMesh.geometry,
              hitRange.start,
              hitRange.count,
              highlightColor,
              0.85
            );

            hoveredFaceIdRef.current = hitRange.id;
            hoveredMeshRef.current = hitMesh;
          }

          // Trigger hover callback with updated mouse coordinates on every move
          const faceData = facesData.find(f => f.id === hitRange.id);
          if (faceData) {
            onFaceHover(faceData, event.clientX, event.clientY);
          }
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
        const hitRegion = intersects.find(item => item.object.userData.isRegion === true && item.faceIndex !== undefined);
        
        if (hitRegion && hitRegion.face) {
          const hitMesh = hitRegion.object as THREE.Mesh;
          const faceRanges = hitMesh.userData.faceRanges as {
            id: number;
            start: number;
            count: number;
          }[];
          const facesData = hitMesh.userData.facesData as Face[];

          const vertexIndex = hitRegion.face.a;
          const hitRange = faceRanges.find(r => vertexIndex >= r.start && vertexIndex < r.start + r.count);

          if (hitRange) {
            const faceData = facesData.find(f => f.id === hitRange.id);
            if (faceData) {
              onFaceClick(faceData);
            }
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
            color: 0xcccccc,
            roughness: 0.8,
            metalness: 0.1,
            transparent: false
          });
          mesh.userData.isOriginallyWhite = true;
        } else {
          mesh.userData.isOriginallyWhite = false;
        }
      }
    });

    backgroundGroup.add(model);
    applyForceWhite(isForceWhite);
  };

  const applyForceWhite = (force: boolean) => {
    const backgroundGroup = backgroundGroupRef.current;
    if (!backgroundGroup || backgroundGroup.children.length === 0) return;
    const model = backgroundGroup.children[0];
    const whiteMaterial = whiteMaterialRef.current;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (force) {
          mesh.material = whiteMaterial;
        } else {
          mesh.material = mesh.userData.isOriginallyWhite ? whiteMaterial : mesh.userData.originalMaterial;
        }
      }
    });
  };

  // Setup / Clear topology grid
  const clearTopologyGroupObjects = () => {
    const topologyGroup = topologyGroupRef.current;
    if (!topologyGroup) return;

    // Reset hover states
    hoveredMeshRef.current = null;
    hoveredFaceIdRef.current = null;
    onFaceHover(null);

    topologyGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m?.dispose());
      } else if ((child as THREE.Line).isLine) {
        const line = child as THREE.Line;
        line.geometry.dispose();
        const mats = Array.isArray(line.material) ? line.material : [line.material];
        mats.forEach((m) => m?.dispose());
      }
    });

    while (topologyGroup.children.length > 0) {
      topologyGroup.remove(topologyGroup.children[0]);
    }
  };

  const setupTopologyGrid = (data: TopologyData) => {
    const topologyGroup = topologyGroupRef.current;
    if (!topologyGroup) return;

    clearTopologyGroupObjects();

    if (!data.faces || data.faces.length === 0) return;

    const uniqueVertices = new Map<string, THREE.Vector3>();
    const faceGeometries: THREE.BufferGeometry[] = [];
    const faceRanges: {
      id: number;
      start: number;
      count: number;
      originalColor: THREE.Color;
      originalOpacity: number;
    }[] = [];

    let currentVertexOffset = 0;

    data.faces.forEach((face) => {
      const boundary = face.boundary_polyline;
      if (boundary && boundary.length > 2) {
        const shape = new THREE.Shape();
        shape.moveTo(boundary[0][0], boundary[0][1]);
        for (let i = 1; i < boundary.length; i++) {
          shape.lineTo(boundary[i][0], boundary[i][1]);
        }
        shape.closePath();

        const height = (face.state?.height_floors ?? 0) * 3;
        let geometry: THREE.BufferGeometry;
        if (height > 0) {
          geometry = new THREE.ExtrudeGeometry(shape, {
            depth: height,
            bevelEnabled: false
          });
        } else {
          geometry = new THREE.ShapeGeometry(shape);
          geometry.translate(0, 0, 0.02);
        }

        if (geometry.index !== null) {
          const nonIndexedGeometry = geometry.toNonIndexed();
          geometry.dispose();
          geometry = nonIndexedGeometry;
        }

        const colorHex = getColorByBuiltType(face.state?.built_type, face.state?.is_occupied);
        const color = new THREE.Color(colorHex);
        const opacity = height > 0 ? 0.65 : 0.15;
        
        const count = geometry.attributes.position.count;
        const colors = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
          colors[i * 4] = color.r;
          colors[i * 4 + 1] = color.g;
          colors[i * 4 + 2] = color.b;
          colors[i * 4 + 3] = opacity;
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

        faceGeometries.push(geometry);
        faceRanges.push({
          id: face.id,
          start: currentVertexOffset,
          count: count,
          originalColor: color,
          originalOpacity: opacity
        });

        currentVertexOffset += count;

        boundary.forEach((p) => {
          const key = `${p[0].toFixed(2)},${p[1].toFixed(2)},${p[2].toFixed(2)}`;
          if (!uniqueVertices.has(key)) {
            uniqueVertices.set(key, new THREE.Vector3(p[0], p[1], p[2] + 0.04));
          }
        });
      }
    });

    if (faceGeometries.length > 0) {
      const mergedGeometry = BufferGeometryUtils.mergeGeometries(faceGeometries, false);
      if (mergedGeometry) {
        // Transparent standard material for faces with polygon offset and depthWrite disabled
        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.4,
          metalness: 0.2,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        });

        const mesh = new THREE.Mesh(mergedGeometry, material);
        mesh.userData = {
          isRegion: true,
          faceRanges: faceRanges,
          name: "Topology Grid Mesh",
          facesData: data.faces
        };
        topologyGroup.add(mesh);
      }
    }

    const allOutlinePoints: THREE.Vector3[] = [];
    data.faces.forEach((face) => {
      const boundary = face.boundary_polyline;
      if (boundary && boundary.length > 2) {
        const height = (face.state?.height_floors ?? 0) * 3;

        for (let i = 0; i < boundary.length; i++) {
          const p1 = boundary[i];
          const p2 = boundary[(i + 1) % boundary.length];
          allOutlinePoints.push(new THREE.Vector3(p1[0], p1[1], p1[2] + 0.01));
          allOutlinePoints.push(new THREE.Vector3(p2[0], p2[1], p2[2] + 0.01));
        }

        if (height > 0) {
          for (let i = 0; i < boundary.length; i++) {
            const p1 = boundary[i];
            const p2 = boundary[(i + 1) % boundary.length];
            allOutlinePoints.push(new THREE.Vector3(p1[0], p1[1], p1[2] + height + 0.01));
            allOutlinePoints.push(new THREE.Vector3(p2[0], p2[1], p2[2] + height + 0.01));
          }

          boundary.forEach((p) => {
            allOutlinePoints.push(new THREE.Vector3(p[0], p[1], p[2] + 0.01));
            allOutlinePoints.push(new THREE.Vector3(p[0], p[1], p[2] + height + 0.01));
          });
        }
      }
    });

    if (allOutlinePoints.length > 0) {
      const outlineGeometry = new THREE.BufferGeometry().setFromPoints(allOutlinePoints);
      const outlineMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.28
      });
      const lines = new THREE.LineSegments(outlineGeometry, outlineMaterial);
      topologyGroup.add(lines);
    }

    const sphereGeoms: THREE.BufferGeometry[] = [];
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f46e5,
      roughness: 0.3,
      metalness: 0.3
    });

    uniqueVertices.forEach((pos) => {
      const geom = new THREE.SphereGeometry(0.12, 8, 8);
      geom.translate(pos.x, pos.y, pos.z);
      sphereGeoms.push(geom);
    });

    if (sphereGeoms.length > 0) {
      const mergedSpheres = BufferGeometryUtils.mergeGeometries(sphereGeoms, false);
      if (mergedSpheres) {
        const verticesMesh = new THREE.Mesh(mergedSpheres, sphereMaterial);
        topologyGroup.add(verticesMesh);
      }
    }
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
              fitCameraToAllUploaded();
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
            fitCameraToAllUploaded();
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
      fitCameraToAllUploaded();
    }
  }, [topologyData, gridName]);

  // Watch for isForceWhite toggles
  useEffect(() => {
    applyForceWhite(isForceWhite);
  }, [isForceWhite]);

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

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" 
    />
  );
}
