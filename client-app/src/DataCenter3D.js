import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

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
    networkFlows: []
  });

  // Constants
  const FLOOR_SIZE = 80;
  const WALL_HEIGHT = 15;
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
      rack: { min: 20, max: 35 },
      hvac: { min: 40, max: 80 },
      ups: { min: 20, max: 50 }
    };

    const { min, max } = ranges[type] || ranges.rack;
    const ratio = Math.min(Math.max((temp - min) / (max - min), 0), 1);
    return new THREE.Color().setHSL(0.7 * (1 - ratio), 0.9, 0.5);
  }, []);

  const createAlarmIcon = (alarmStatus = false, size = 0.15) => {
    const group = new THREE.Group();
    group.visible = alarmStatus;
  
    // Bell shape (main body)
    const bellGeometry = new THREE.CylinderGeometry(
      size * 0.7, // top radius
      size * 0.4,  // bottom radius
      size * 0.8,  // height
      8,           // radial segments
      1,           // height segments
      true         // open ended
    );
    
    // Flatten the bottom to make it more bell-like
    bellGeometry.attributes.position.array.forEach((v, i) => {
      if (i % 3 === 1 && v < -size * 0.3) { // Y coordinate check
        bellGeometry.attributes.position.array[i] = -size * 0.4;
      }
    });
    bellGeometry.attributes.position.needsUpdate = true;
  
    const bellMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      metalness: 0.7
    });
    const bell = new THREE.Mesh(bellGeometry, bellMaterial);
    bell.rotation.x = Math.PI; // Flip upside down
    group.add(bell);
  
    // Clapper (the ball inside)
    const clapperGeometry = new THREE.SphereGeometry(size * 0.15, 8, 8);
    const clapperMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      roughness: 0.8,
      metalness: 0.5
    });
    const clapper = new THREE.Mesh(clapperGeometry, clapperMaterial);
    clapper.position.set(0, size * 0.2, 0);
    group.add(clapper);
  
    // Mounting bracket
    const bracketGeometry = new THREE.CylinderGeometry(
      size * 0.15,
      size * 0.15,
      size * 0.2,
      6
    );
    const bracket = new THREE.Mesh(
      bracketGeometry,
      new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    bracket.position.set(0, size * 0.6, 0);
    bracket.rotation.x = Math.PI / 2;
    group.add(bracket);
  
    // Animation - flashing and subtle swinging
    group.userData = {
      animate: () => {
        const time = Date.now() * 0.002;
        
        // Pulsing emissive effect
        bellMaterial.emissiveIntensity = 0.3 + Math.sin(time * 5) * 0.3;
        
        // Subtle swinging motion
        group.rotation.z = Math.sin(time * 2) * 0.1;
        
        // Clapper movement
        clapper.position.y = size * 0.2 + Math.abs(Math.sin(time * 10)) * 0.03;
      },
      setAlarm: (status) => {
        group.visible = status;
        if (status) {
          // Reset position when turning on
          group.rotation.set(0, 0, 0);
          clapper.position.set(0, size * 0.2, 0);
        }
      }
    };
  
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
        opacity: 0.3,
        side: THREE.DoubleSide
      })
    );
    wall.position.set(0, ROOM_LAYOUT.centralWall.height / 2, 0);
    group.add(wall);

    return group;
  }, [ROOM_LAYOUT.centralWall.height, ROOM_LAYOUT.centralWall.length, ROOM_LAYOUT.centralWall.thickness]);

  // Component creation functions
  const createServerRack = useCallback((width, height, depth, temp, index) => {
    const group = new THREE.Group();
    const baseColor = tempToColor(temp, 'rack');

    // Main frame
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.7,
      metalness: 0.2
    });
    const rack = new THREE.Mesh(geometry, material);
    rack.name = 'rackBody';
    group.add(rack);

    // const alarmIcon = createAlarmIcon(false, 0.15);
    // alarmIcon.position.set(0, height/2 + 0.2, 0); // Top center of rack
    // group.add(alarmIcon); 
    // group.userData.alarmIcon = alarmIcon; // Store reference for later control

    // Servers (stacked)
    for (let i = 0; i < 8; i++) {
      const server = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.9, height * 0.1, depth * 0.8),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      server.position.set(0, -height / 2 + 0.2 + i * (height / 8), 0);
      group.add(server);

      // LEDs
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          emissive: 0x00ff00,
          emissiveIntensity: 0.5
        })
      );
      led.position.set(0, server.position.y, - depth/2);
      group.add(led);
      animationRefs.current.leds.push(led);
    }

    return group;
  }, [tempToColor]);

  const createHVACUnit = useCallback((width, height, depth, temp) => {
    const group = new THREE.Group();
    const baseColor = tempToColor(temp, 'hvac');

    // Main unit
    const hvac = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.4,
        metalness: 0.6
      })
    );
    hvac.name = 'hvacBody';
    hvac.position.y = height / 2;
    group.add(hvac);

    // Vents
    const vent = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.8, 0.05, depth * 0.8),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    vent.position.set(0, height * 0.7, 0);
    group.add(vent);

    // Airflow particles
    const particles = new THREE.BufferGeometry();
    const count = 100;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * width * 0.8;
      positions[i * 3 + 1] = -height * 0.2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * depth * 0.8;
    }
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleSystem = new THREE.Points(
      particles,
      new THREE.PointsMaterial({
        color: new THREE.Color(0x000055),
        size: 0.03,
        transparent: true,
        opacity: 0.8
      })
    );
    group.userData.particles = particles;
    group.add(particleSystem);

    return group;
  }, [tempToColor]);

  const createNOCCenter = useCallback(() => {
    const group = new THREE.Group();

    // NOC structure
    const noc = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_LAYOUT.noc.width, 4, ROOM_LAYOUT.noc.depth),
      new THREE.MeshStandardMaterial({
        color: 0x2a3f5f,
        transparent: true,
        opacity: 0.9
      })
    );
    noc.position.set(ROOM_LAYOUT.noc.x, 2, ROOM_LAYOUT.noc.z);
    group.add(noc);

    // Workstations
    for (let i = 0; i < 8; i++) {
      const workstation = new THREE.Group();
      const desk = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.7, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      desk.position.set(0, 0.35, 0);
      workstation.add(desk);

      const monitor = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.6, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      monitor.position.set(0, 0.9, 0.4);
      workstation.add(monitor);

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 0.55),
        new THREE.MeshBasicMaterial({
          color: 0x0066ff,
          emissive: 0x0066ff,
          emissiveIntensity: 0.7
        })
      );
      screen.position.set(0, 0.9, 0.425);
      workstation.add(screen);
      animationRefs.current.networkFlows.push(screen);

      workstation.position.set(
        ROOM_LAYOUT.noc.x - 8 + (i % 4) * 5,
        0,
        ROOM_LAYOUT.noc.z - 6 + Math.floor(i / 4) * 4
      );
      group.add(workstation);
    }

    // Network wall
    const networkWall = new THREE.Mesh(
      new THREE.BoxGeometry(10, 5, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    networkWall.position.set(ROOM_LAYOUT.noc.x + 8, 2.5, ROOM_LAYOUT.noc.z - 8);
    group.add(networkWall);

    // Network equipment
    for (let i = 0; i < 12; i++) {
      const device = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.15, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      device.position.set(
        networkWall.position.x - 4 + (i % 3) * 4,
        networkWall.position.y - 1.5 + Math.floor(i / 3) * 0.5,
        networkWall.position.z + 0.16
      );
      group.add(device);

      const statusLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({
          color: networkStatus.active ? 0x00ff00 : 0xff0000,
          emissive: networkStatus.active ? 0x00ff00 : 0xff0000,
          emissiveIntensity: 0.8
        })
      );
      statusLight.userData = { type: 'network' };
      statusLight.position.set(device.position.x + 0.3, device.position.y, device.position.z + 0.13);
      group.add(statusLight);
      animationRefs.current.statusLights.push(statusLight);
    }

    return group;
  }, [ROOM_LAYOUT.noc, networkStatus.active]);

  const createPowerRoom = useCallback(() => {
    const group = new THREE.Group();

    // Room structure
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM_LAYOUT.powerRoom.width, 5, ROOM_LAYOUT.powerRoom.depth),
      new THREE.MeshStandardMaterial({
        color: 0x3a2a2a,
        transparent: true,
        opacity: 0.9
      })
    );
    room.position.set(ROOM_LAYOUT.powerRoom.x, 2.5, ROOM_LAYOUT.powerRoom.z);
    group.add(room);

    // UPS units
    for (let i = 0; i < 4; i++) {
      const ups = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.8, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x252525 })
      );
      ups.position.set(
        ROOM_LAYOUT.powerRoom.x - 6 + (i % 2) * 8,
        0.9,
        ROOM_LAYOUT.powerRoom.z - 5 + Math.floor(i / 2) * 6
      );
      group.add(ups);

      // Status panel
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.3, 0.01),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      panel.position.set(ups.position.x, ups.position.y + 0.6, ups.position.z + 0.46);
      group.add(panel);

      const statusLight = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshBasicMaterial({
          color: powerStatus.ups ? 0x00ff00 : 0xff0000,
          emissive: powerStatus.ups ? 0x00ff00 : 0xff0000,
          emissiveIntensity: 0.7
        })
      );
      statusLight.userData = { type: 'ups' };
      statusLight.position.set(panel.position.x - 0.3, panel.position.y, panel.position.z + 0.01);
      group.add(statusLight);
      animationRefs.current.statusLights.push(statusLight);
    }

    // Backup generator
    const generator = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.5, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    generator.position.set(ROOM_LAYOUT.powerRoom.x + 8, 0.75, ROOM_LAYOUT.powerRoom.z + 5);
    group.add(generator);

    const exhaustPipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 1, 16),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    exhaustPipe.position.set(generator.position.x - 1, generator.position.y + 1.1, generator.position.z);
    exhaustPipe.rotation.z = Math.PI / 2;
    group.add(exhaustPipe);

    const generatorStatus = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({
        color: powerStatus.generator ? 0x00ff00 : 0xaaaaaa,
        emissive: powerStatus.generator ? 0x00ff00 : 0xaaaaaa,
        emissiveIntensity: 0.5
      })
    );
    generatorStatus.userData = { type: 'generator' };
    generatorStatus.position.set(generator.position.x + 1.5, generator.position.y + 0.7, generator.position.z);
    group.add(generatorStatus);
    animationRefs.current.statusLights.push(generatorStatus);

    // Power distribution
    const pdu = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.8, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    pdu.position.set(ROOM_LAYOUT.powerRoom.x - 2, 1.5, ROOM_LAYOUT.powerRoom.z + 6);
    group.add(pdu);

    return group;
  }, [ROOM_LAYOUT.powerRoom, powerStatus.generator, powerStatus.ups]);

  // const createFireSuppressionSystem = useCallback(() => {
  //   const group = new THREE.Group();

  //   // Ceiling pipes
  //   const pipeGeometry = new THREE.CylinderGeometry(0.1, 0.1, FLOOR_SIZE * 0.8, 16);
  //   const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0xcc0000 });

  //   const mainPipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
  //   mainPipe.rotation.z = Math.PI / 2;
  //   mainPipe.position.set(0, WALL_HEIGHT - 1, 0);
  //   group.add(mainPipe);

  //   // Branch pipes
  //   for (let i = 0; i < 4; i++) {
  //     const branchPipe = new THREE.Mesh(
  //       new THREE.CylinderGeometry(0.08, 0.08, 20, 16),
  //       pipeMaterial
  //     );
  //     branchPipe.position.set(-15 + i * 10, WALL_HEIGHT - 1.5, 0);
  //     branchPipe.rotation.x = Math.PI / 2;
  //     group.add(branchPipe);
  //   }

  //   // Nozzles
  //   const nozzleGeometry = new THREE.ConeGeometry(0.15, 0.3, 8);
  //   for (let i = 0; i < 8; i++) {
  //     const nozzle = new THREE.Mesh(nozzleGeometry, pipeMaterial);
  //     nozzle.position.set(
  //       -20 + i * 5,
  //       WALL_HEIGHT - 1.8,
  //       (i % 2 === 0) ? 10 : -10
  //     );
  //     nozzle.rotation.x = Math.PI;
  //     group.add(nozzle);
  //   }

  //   // Status indicator
  //   const statusLight = new THREE.Mesh(
  //     new THREE.SphereGeometry(0.3, 16, 16),
  //     new THREE.MeshBasicMaterial({
  //       color: fireSuppressionStatus.active ? 0xff0000 : 0x333333,
  //       emissive: fireSuppressionStatus.active ? 0xff0000 : 0x333333,
  //       emissiveIntensity: fireSuppressionStatus.active ? 1 : 0.1
  //     })
  //   );
  //   statusLight.userData = { type: 'fire' };
  //   statusLight.position.set(0, WALL_HEIGHT - 0.5, -ROOM_LAYOUT.serverRoom.depth / 2 + 1);
  //   group.add(statusLight);
  //   animationRefs.current.statusLights.push(statusLight);

  //   return group;
  // }, [FLOOR_SIZE, WALL_HEIGHT, ROOM_LAYOUT.serverRoom.depth, fireSuppressionStatus.active]);

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

 // Move all creator functions outside the component or memoize them
// These should not change between renders
const creatorFunctions = {
  createNOCCenter,
  createPowerRoom,
  // createFireSuppressionSystem,
  createEntrance,
  createCentralWall,
  createServerRack,
  createHVACUnit
};

// Main scene initialization (runs once)
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

  // Lighting (static)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // Static environment (floor, walls, grid)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x55ee99, roughness: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(FLOOR_SIZE, 20, 0x555555, 0x333333);
  scene.add(gridHelper);

  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide
  });

  const wallGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, WALL_HEIGHT);
  const walls = [
    { position: [0, WALL_HEIGHT / 2, -FLOOR_SIZE / 2], rotation: [0, 0, 0] },
    { position: [0, WALL_HEIGHT / 2, FLOOR_SIZE / 2], rotation: [0, Math.PI, 0] },
    { position: [0, WALL_HEIGHT / 2, 0], rotation: [0, -Math.PI / 2, 0] }
  ];

  walls.forEach(wallConfig => {
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(...wallConfig.position);
    wall.rotation.set(...wallConfig.rotation, 0);
    scene.add(wall);
  });

  // Add static components
  scene.add(creatorFunctions.createNOCCenter());
  scene.add(creatorFunctions.createPowerRoom());
  // scene.add(creatorFunctions.createFireSuppressionSystem());
  scene.add(creatorFunctions.createEntrance());
  scene.add(creatorFunctions.createCentralWall());

  // Create groups for dynamic elements
  const racksGroup = new THREE.Group();
  racksGroup.name = 'racksGroup';
  scene.add(racksGroup);

  const hvacGroup = new THREE.Group();
  hvacGroup.name = 'hvacGroup';
  scene.add(hvacGroup);

  // Animation loop
  const animate = () => {
    animationRef.current = requestAnimationFrame(animate);
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
    
    scene.traverse(child => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  };
}, []); // Empty dependency array ensures this runs once

// Update dynamic elements
useEffect(() => {
  if (!sceneRef.current) return;

  const scene = sceneRef.current;
  const racksGroup = scene.getObjectByName('racksGroup');
  const hvacGroup = scene.getObjectByName('hvacGroup');

  // Update or create server racks
  if (racksGroup) {
    // Clear existing racks
    while (racksGroup.children.length) {
      racksGroup.remove(racksGroup.children[0]);
    }
    
    // Add current racks
    rackTemperatures.forEach((temp, i) => {
      const rack = creatorFunctions.createServerRack(0.8, 2.2, 1, temp, i);
      const row = Math.floor(i / 5);
      const col = i % 5;
      rack.position.set(-25 + col * 3.5, 1.1, -15 + row * 5);
      racksGroup.add(rack);
    });
  }

  // Update or create HVAC units
  if (hvacGroup) {
    // Clear existing HVAC units
    while (hvacGroup.children.length) {
      hvacGroup.remove(hvacGroup.children[0]);
    }
    
    // Add current HVAC units
    //const hvacPerRow = Math.ceil(Math.sqrt(hvacTemperatures.length));
    const hvacPerRow = hvacTemperatures.length/4;
    hvacTemperatures.forEach((temp, i) => {
      const hvac = creatorFunctions.createHVACUnit(2, 1.5, 2, temp);
      const row = Math.floor(i / hvacPerRow);
      const col = i % hvacPerRow;
      // hvac.position.set(
      //   (col - hvacPerRow / 2 + 0.5) * 8,
      //   15,
      //   (row - Math.ceil(hvacTemperatures.length / hvacPerRow) / 2 + 0.5) * 4
      // );
      //rack.position.set(-25 + col * 3.5, 1.1, -15 + row * 5);

      hvac.position.set(
        - 15 +(col - hvacPerRow / 2 + 0.5) * 10,
        15,
        (row - Math.ceil(hvacTemperatures.length / hvacPerRow) / 2 + 0.5) * 14
      );
      hvacGroup.add(hvac);
    });
  }
}, [rackTemperatures, hvacTemperatures]);

// Animation effects management
useEffect(() => {
  if (!sceneRef.current) return;

  let effectAnimationId; // Changed from const to let

  const animateEffects = () => {
    const time = Date.now() * 0.001;
    
    // Animate LEDs
    animationRefs.current.leds.forEach((led, i) => {
      led.material.color.setHSL(0.3, 1, 0.5 + Math.sin(time * 2 + i) * 0.3);
    });

    // Animate status lights
    animationRefs.current.statusLights.forEach(light => {
      if (light.userData.isFlashing) {
        light.material.emissiveIntensity = 0.5 + Math.sin(time * 5) * 0.5;
      }
    });

    // Animate network flows
    animationRefs.current.networkFlows.forEach((screen, i) => {
      screen.material.color.setHSL(0.6, 1, 0.5 + Math.sin(time * 3 + i) * 0.2);
    });

    // Animate HVAC particles
    const hvacGroup = sceneRef.current.getObjectByName('hvacGroup');
    if (hvacGroup) {
      hvacGroup.children.forEach(hvac => {
        if (hvac.userData.particles) {
          const positions = hvac.userData.particles.attributes.position.array;
          for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= 0.02 + Math.random() * 0.01;
            if (positions[i + 1] < -0.5) {
              positions[i + 1] = 0;
              positions[i] = (Math.random() - 0.5) * 1.6;
              positions[i + 2] = (Math.random() - 0.5) * 1.6;
            }
          }
          hvac.userData.particles.attributes.position.needsUpdate = true;
        }
      });
    }
  };

  // Run effects on every frame
  effectAnimationId = requestAnimationFrame(function loop() {
    animateEffects();
    effectAnimationId = requestAnimationFrame(loop);
  });

  return () => {
    cancelAnimationFrame(effectAnimationId);
  };
}, []);
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