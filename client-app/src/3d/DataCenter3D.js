import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { createServerRack } from '../serverRack';
import { createHVACUnit } from './createHVACUnit';
import { createChilledWaterSystem } from './createHVACUnit';
import { createPowerRoom } from './createPowerRoom';
import { createNOCCenter } from './createNOCCenter';

const DataCenter3D = ({
  rackTemperatures = [],
  hvacTemperatures = [],
  currentTemp = 22,
  targetTemp = 20,
  powerStatus = { main: true, ups: true, generator: false },
  networkStatus = { active: true, bandwidth: 75 },
  fireSuppressionStatus = { active: false }
}) => {
  // Refs
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const animationRef = useRef(null);
  const animationRefs = useRef({
    leds: [],
    particles: [],
    statusLights: [],
    networkFlows: [],
    powerLights: [],
    cameras: []
  });

  // Constants
  const FLOOR_SIZE = 80;
  const WALL_HEIGHT = 6;
  const ROOM_LAYOUT = {
    serverRoom: { x: -20, z: 0, width: 40, depth: 40 },
    noc: { x: 25, z: -15, width: 25, depth: 20 },
    powerRoom: { x: 25, z: 15, width: 25, depth: 20 },
    entrance: { x: 0, z: -40, width: 15, depth: 10 },
    centralWall: { length: 80, thickness: 0.5, height: WALL_HEIGHT }
  };

  // Helper functions
  const tempToColor = useCallback((temp, type = 'rack') => {
    if (temp == null) return new THREE.Color(0x666666);
    const ranges = {
      rack: { min: 23, max: 35 },
      hvac: { min: 50, max: 90 },
      ups: { min: 20, max: 50 }
    };
    const { min, max } = ranges[type] || ranges.rack;
    const ratio = Math.min(Math.max((temp - min) / (max - min), 0), 1);
    return new THREE.Color().setHSL(0.7 * (1 - ratio), 0.9, 0.5);
  }, []);

  const createRaisedFloor = () => {
    const group = new THREE.Group();
    group.name = 'floor';
    const tileSize = 2;
    const gridSize = FLOOR_SIZE / tileSize;

    // Create floor tiles with cooling vents
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const isCoolingVent = (
          (i >= 10 && i <= 30 && (j === 10 || j === 30)) || // Cooling vents along the rack areas
          (j >= 10 && j <= 30 && (i === 10 || i === 30)));

        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(tileSize - 0.05, 0.1, tileSize - 0.05),
          new THREE.MeshStandardMaterial({
            color: isCoolingVent ? 0x0066ff : ((i + j) % 2 === 0 ? 0xcccccc : 0xaaaaaa),
            roughness: isCoolingVent ? 0.3 : 0.7,
            metalness: isCoolingVent ? 0.7 : 0.1,
            emissive: isCoolingVent ? 0x0066ff : 0x000000,
            emissiveIntensity: isCoolingVent ? 0.2 : 0
          })
        );
        
        tile.position.set(
          -FLOOR_SIZE / 2 + i * tileSize + tileSize / 2,
          0.05,
          -FLOOR_SIZE / 2 + j * tileSize + tileSize / 2
        );
        tile.receiveShadow = true;
        group.add(tile);
      }
    }

    // Add floor cooling pipes around the racks
    const coolingPipeGeometry = new THREE.CylinderGeometry(0.1, 0.1, FLOOR_SIZE - 20, 16);
    const coolingPipeMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0066ff,
      emissiveIntensity: 0.1
    });

    // Create cooling pipes around the perimeter of the rack area
    const pipePositions = [
      { x: -10, z: 0, rotation: [Math.PI / 2, 0, 0] },
      { x: 10, z: 0, rotation: [Math.PI / 2, 0, 0] },
      { x: 0, z: -10, rotation: [0, 0, Math.PI / 2] },
      { x: 0, z: 10, rotation: [0, 0, Math.PI / 2] }
    ];

    pipePositions.forEach(pos => {
      const pipe = new THREE.Mesh(coolingPipeGeometry, coolingPipeMaterial);
      pipe.position.set(pos.x, -1, pos.z);
      pipe.rotation.set(...pos.rotation);
      pipe.castShadow = true;
      group.add(pipe);
    });

    return group;
  };

  const createCentralWall = useCallback(() => {
    const group = new THREE.Group();

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(
        ROOM_LAYOUT.centralWall.thickness,
        ROOM_LAYOUT.centralWall.height,
        ROOM_LAYOUT.centralWall.length
      ),
      new THREE.MeshStandardMaterial({
        color: 0xaaaaaa,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      })
    );
    wall.position.set(0, ROOM_LAYOUT.centralWall.height / 2, 0);
    group.add(wall);

    return group;
  }, [ROOM_LAYOUT.centralWall.height, ROOM_LAYOUT.centralWall.length, ROOM_LAYOUT.centralWall.thickness]);

  const createEntrance = useCallback(() => {
    const group = new THREE.Group();

    // Doorway
    const entrance = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_LAYOUT.entrance.width, 6, ROOM_LAYOUT.entrance.depth),
      new THREE.MeshStandardMaterial({
        color: 0x5a5a5a,
        transparent: true,
        opacity: 0.7
      })
    );
    entrance.position.set(ROOM_LAYOUT.entrance.x, 3, ROOM_LAYOUT.entrance.z);
    group.add(entrance);

    // Doors
    const doorGeometry = new THREE.BoxGeometry(3, 5, 0.1);
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });

    const leftDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    leftDoor.position.set(ROOM_LAYOUT.entrance.x - 3, 2.5, ROOM_LAYOUT.entrance.z + 0.1);
    group.add(leftDoor);

    const rightDoor = new THREE.Mesh(doorGeometry, doorMaterial);
    rightDoor.position.set(ROOM_LAYOUT.entrance.x + 3, 2.5, ROOM_LAYOUT.entrance.z + 0.1);
    group.add(rightDoor);

    // Access control panel
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.8, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    panel.position.set(ROOM_LAYOUT.entrance.x, 1.2, ROOM_LAYOUT.entrance.z + 0.1);
    group.add(panel);

    const cardReader = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.1, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x0066ff })
    );
    cardReader.position.set(panel.position.x, panel.position.y - 0.2, panel.position.z + 0.03);
    group.add(cardReader);

    return group;
  }, [ROOM_LAYOUT.entrance]);

  const creatorFunctions = {
    createEntrance,
    createCentralWall,
    createNOCCenter: () => createNOCCenter(ROOM_LAYOUT, WALL_HEIGHT, animationRefs),
    createPowerRoom: () => createPowerRoom(ROOM_LAYOUT.powerRoom, powerStatus),
    createServerRack: (width, height, depth, temp, index) => createServerRack(width, height, depth, temp, index, powerStatus, tempToColor),
    createHVACUnit: (width, height, depth, temp) => createHVACUnit(width, height, depth, temp, tempToColor),
    createChilledWaterSystem: (width, height, depth, temp) =>
      createChilledWaterSystem(width, height, depth, temp)
  };


  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(30, 25, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;
    controlsRef.current.saveState();

    // Create a proper scene hierarchy
    const dataCenterRoot = new THREE.Group();
    dataCenterRoot.name = 'dataCenterRoot';
    scene.add(dataCenterRoot);

    // Create specific groups for each logical section
    const sections = {
      environment: new THREE.Group(),
      serverRoom: new THREE.Group(),
      noc: new THREE.Group(),
      powerRoom: new THREE.Group(),
      entrance: new THREE.Group(),
      dynamicElements: new THREE.Group()
    };

    // Name and add each section group
    Object.entries(sections).forEach(([name, group]) => {
      group.name = name;
      dataCenterRoot.add(group);
    });

    // Create further sub-groups for dynamic elements
    const dynamicGroups = {
      racks: new THREE.Group(),
      hvac: new THREE.Group(),
      networkEquipment: new THREE.Group(),
      powerSystems: new THREE.Group(),
      securitySystems: new THREE.Group()
    };

    // Name and add each dynamic group
    Object.entries(dynamicGroups).forEach(([name, group]) => {
      group.name = name;
      sections.dynamicElements.add(group);
    });

    // Lighting (add to environment group)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    sections.environment.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    sections.environment.add(directionalLight);

    const gridHelper = new THREE.GridHelper(FLOOR_SIZE, 20, 0x555555, 0x333333);
    sections.environment.add(gridHelper);

    // Add walls to environment group
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x7777ff,
      transparent: true,
      opacity: 0.25,
      transmission: 1.0,     // Enables real transparency like glass
      roughness: 0.05,       // Low roughness makes it smooth and shiny
      metalness: 0.0,        // Non-metallic for glass
      ior: 1.5,              // Index of refraction for glass
      thickness: 0.3,        // Thickness of the glass
      side: THREE.DoubleSide
    });

    const wallSideMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });

    const wallGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, WALL_HEIGHT);
    const walls = [
      { position: [0, WALL_HEIGHT / 2, -FLOOR_SIZE / 2], rotation: [0, 0, 0], material: wallSideMaterial },
      { position: [0, WALL_HEIGHT / 2, FLOOR_SIZE / 2], rotation: [0, Math.PI, 0], material: wallSideMaterial },
      { position: [0, WALL_HEIGHT / 2, 0], rotation: [0, -Math.PI / 2, 0], material: wallMaterial }
    ];

    walls.forEach(wallConfig => {
      const wall = new THREE.Mesh(wallGeometry, wallConfig.material);
      wall.position.set(...wallConfig.position);
      wall.rotation.set(...wallConfig.rotation, 0);
      sections.environment.add(wall);
    });

    // Add raised floor to environment group
    sections.environment.add(createRaisedFloor());

    // Add central wall
    sections.environment.add(creatorFunctions.createCentralWall());

    // Add static components to their respective groups
    sections.noc.add(creatorFunctions.createNOCCenter());
    const { group: powerRoomGroup, statusLights } = creatorFunctions.createPowerRoom(ROOM_LAYOUT.powerRoom, powerStatus);
    sections.powerRoom.add(powerRoomGroup);
    animationRefs.current.statusLights.push(...statusLights);

    sections.entrance.add(creatorFunctions.createEntrance());

    // Store references to dynamic groups
    sceneRef.current.userData.dynamicGroups = dynamicGroups;

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      animationRefs.current.particles.forEach(particleSystem => {
        const particles = particleSystem.geometry;
        const positions = particles.attributes.position.array;
        const { velocities, originalPositions } = particles.userData;

        for (let i = 0; i < positions.length / 3; i++) {
          // Move particles downward
          positions[i * 3 + 1] -= velocities[i];

          // Reset particles that go too far
          if (positions[i * 3 + 1] < - WALL_HEIGHT / 3) {
            positions[i * 3] = originalPositions[i * 3];
            positions[i * 3 + 1] = originalPositions[i * 3 + 1];
            positions[i * 3 + 2] = originalPositions[i * 3 + 2];
          }
        }

        particles.attributes.position.needsUpdate = true;
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
      mount?.removeChild(renderer.domElement);
      controls.dispose();
      renderer.dispose();
      animationRefs.current = {
        leds: [],
        particles: [],
        statusLights: [],
        networkFlows: [],
        powerLights: [],
        cameras: []
      };

      // Recursive cleanup of the entire scene
      function disposeNode(node) {
        if (node.geometry) {
          node.geometry.dispose();
        }

        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach(material => material && material.dispose());
          } else {
            node.material.dispose();
          }
        }

        // Recursively clean up children
        if (node.children) {
          for (let i = node.children.length - 1; i >= 0; i--) {
            disposeNode(node.children[i]);
          }
        }
      }

      disposeNode(scene);
    };
  }, []); // Empty dependency array ensures this runs once

  // Update dynamic elements - Modified to use the new hierarchy
  useEffect(() => {
    if (!sceneRef.current || !sceneRef.current.userData.dynamicGroups) return;

    const { racks: racksGroup, hvac: hvacGroup } = sceneRef.current.userData.dynamicGroups;

    if (racksGroup) {
      // Clean up previous racks (using the recursive cleanup)
      while (racksGroup.children.length) {
        const rack = racksGroup.children[0];

        // Recursive cleanup
        rack.traverse(child => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m && m.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });

        racksGroup.remove(rack);
      }

      const serverRoom = ROOM_LAYOUT.serverRoom;
      const roomDepth = serverRoom.depth;
      const roomX = serverRoom.x;
      const roomZ = serverRoom.z;

      // Rack configuration
      const rackWidth = 0.8;
      const rackDepth = 1;
      const rackHeight = 2.2;
      const racksPerRow = 6;

      // Spacing configuration
      const rowSpacing = 2.5; // Increased for cooling systems
      const rackSpacing = 0.5;

      // Cooling system configuration
      const coolingSystemWidth = 1.5;
      const coolingSystemHeight = 2;
      const coolingSystemDepth = 1;
      const coolingSystemSpacing = 1;

      // Calculate starting position
      const startX = roomX - (racksPerRow * (rackWidth + rackSpacing) + coolingSystemWidth + coolingSystemSpacing) / 2 + rackWidth / 2;
      const startZ = roomZ - roomDepth / 2 + rackDepth + 2;

      // Create racks with chilled water systems between them
      rackTemperatures.forEach((temp, i) => {
        const row = Math.floor(i / racksPerRow);
        const col = i % racksPerRow;

        const rack = creatorFunctions.createServerRack(rackWidth, rackHeight, rackDepth, temp, i);

        // Position racks with space for cooling systems
        const xPos = startX + col * (rackWidth + rackSpacing);
        const zPos = startZ + row * (rackDepth + rowSpacing);

        if (row % 2 === 0) {
          rack.position.set(xPos, rackHeight / 2, zPos);
          rack.rotation.y = Math.PI;
        } else {
          rack.position.set(xPos, rackHeight / 2, zPos);
          rack.rotation.y = 0;
        }

        racksGroup.add(rack);

        if (col === 0 || col === racksPerRow - 1) {
          const coolingVent = new THREE.Mesh(
            new THREE.BoxGeometry(rackWidth * 0.8, 0.05, rackWidth * 0.8),
            new THREE.MeshStandardMaterial({
              color: 0x0066ff,
              metalness: 0.7,
              roughness: 0.3,
              emissive: 0x0066ff,
              emissiveIntensity: 0.2
            })
          );
          coolingVent.position.set(
            xPos + (col === 0 ? -0.5 : 0.5),
            0.1,
            zPos
          );
          racksGroup.add(coolingVent);
        }

        // Add chilled water system at the end of each row
        if (col === racksPerRow - 1) {
          const coolingTemp = 10 + Math.random() * 5; // Simulate chilled water temp (10-15°C)
          const coolingSystem = creatorFunctions.createChilledWaterSystem(
            coolingSystemWidth,
            coolingSystemHeight,
            coolingSystemDepth,
            coolingTemp
          );

          coolingSystem.group.position.set(
            xPos + rackWidth / 2 + coolingSystemSpacing + coolingSystemWidth / 2,
            coolingSystemHeight / 2,
            zPos + rowSpacing / 2 + rackWidth / 2
          );

          racksGroup.add(coolingSystem.group);
        }
      });

    }

    // Update or create HVAC units
    if (hvacGroup) {
      // Properly clean up existing HVAC units
      while (hvacGroup.children.length) {
        const hvacUnit = hvacGroup.children[0];

        // Recursive cleanup
        hvacUnit.traverse(child => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m && m.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });

        hvacGroup.remove(hvacUnit);
      }

      // Add current HVAC units
      const hvacPerRow = hvacTemperatures.length / 4;
      hvacTemperatures.forEach((temp, i) => {
        const { group, particleSystem } = creatorFunctions.createHVACUnit(2, 1.5, 2, temp, tempToColor);
        const row = Math.floor(i / hvacPerRow);
        const col = i % hvacPerRow;
        group.position.set(
          -15 + (col - hvacPerRow / 2 + 0.5) * 10,
          WALL_HEIGHT,
          (row - Math.ceil(hvacTemperatures.length / hvacPerRow) / 2 + 0.5) * 14
        );
        hvacGroup.add(group);
        animationRefs.current.particles.push(particleSystem);
      });
    }
  }, [rackTemperatures, hvacTemperatures, powerStatus.main, ROOM_LAYOUT.serverRoom]);


  return (
    <div ref={mountRef} style={{ width: '100%', height: '600px', position: 'relative' }}>
      {/* Status overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        zIndex: 100
      }}>

        <h3 style={{ marginTop: 0 }}>Data Center Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div>
            <div style={{ color: powerStatus.main ? '#0f0' : '#f00' }}>● Main Power: {powerStatus.main ? 'ON' : 'OFF'}</div>
            <div style={{ color: powerStatus.ups ? '#0f0' : '#f00' }}>● UPS: {powerStatus.ups ? 'ONLINE' : 'OFFLINE'}</div>
            <div style={{ color: powerStatus.generator ? '#ff0' : '#888' }}>● Generator: {powerStatus.generator ? 'ACTIVE' : 'STANDBY'}</div>
          </div>
          <div>
            <div style={{ color: networkStatus.active ? '#0f0' : '#f00' }}>● Network: {networkStatus.active ? 'ACTIVE' : 'DOWN'}</div>
            <div>▲ Bandwidth: {networkStatus.bandwidth}%</div>
            <div style={{ color: fireSuppressionStatus.active ? '#f00' : '#0f0' }}>
              ● Fire System: {fireSuppressionStatus.active ? 'ACTIVE!' : 'Normal'}
            </div>
          </div>
        </div>
        <div style={{ marginTop: '10px' }}>
          Temperature: <span style={{ color: currentTemp > targetTemp + 5 ? '#f80' : '#0f0' }}>
            {currentTemp}°C
          </span> / Target: {targetTemp}°C
        </div>
      </div>
    </div>
  );
};

export default DataCenter3D;