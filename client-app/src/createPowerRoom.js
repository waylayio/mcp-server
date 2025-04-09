import * as THREE from 'three';

export const createPowerRoom = (roomLayout, powerStatus) => {
    const group = new THREE.Group();
    group.name = 'powerRoom';

     // Enhanced materials
    const roomMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a2a2a,
        transparent: true,
        opacity: 0.5,
        metalness: 0.2,
        roughness: 0.7
    });

    // Room structure with walls and door
    const room = new THREE.Mesh(
        new THREE.BoxGeometry(roomLayout.width, 5, roomLayout.depth),
        roomMaterial
    );
    room.position.set(roomLayout.x, 2.5, roomLayout.z);
    group.add(room);

    // Add walls with door opening
    const wallThickness = 0.3;
    const doorWidth = 2;
    const doorHeight = 3;
    
    // Door
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, doorHeight, wallThickness/2),
        new THREE.MeshStandardMaterial({ 
            color: 0x8b4513,
            metalness: 0.3,
            roughness: 0.7
        })
    );
    door.position.set(
        roomLayout.x,
        doorHeight/2,
        roomLayout.z - roomLayout.depth/2 + wallThickness/4
    );

    door.userData.isDoor = true;
    group.add(door);

    // UPS units with cooling systems
    const upsStatusLights = [];
    for (let i = 0; i < 4; i++) {
        const upsGroup = createUPSUnit(i, roomLayout, powerStatus);
        const xOffset = (i % 2) * 8;
        const zOffset = Math.floor(i / 2) * 6;
        
        upsGroup.position.set(
            roomLayout.x - 6 + xOffset,
            0,
            roomLayout.z - 5 + zOffset
        );
        
        group.add(upsGroup);
        upsStatusLights.push(...upsGroup.userData.statusLights);
    }

    // Enhanced backup generator with cooling
    const generatorGroup = createGenerator(powerStatus.generator);
    generatorGroup.position.set(roomLayout.x + 8, 0, roomLayout.z + 5);
    group.add(generatorGroup);

    // Power distribution unit with cooling
    const pduGroup = createPDU(roomLayout, powerStatus);
    pduGroup.position.set(roomLayout.x - 2, 0, roomLayout.z + 6);
    group.add(pduGroup);

    // Add cooling system for the entire power room
    const coolingSystem = createPowerRoomCooling(roomLayout);
    group.add(coolingSystem);

    // Add cable connections between components
    addPowerConnections(group, roomLayout);

    return { 
        group, 
        statusLights: upsStatusLights.concat(
            generatorGroup.userData?.statusLights || [],
            pduGroup.userData?.statusLights || []
        )
    };
};

// Enhanced UPS unit with cooling
const createUPSUnit = (index, roomLayout, powerStatus) => {
    const upsGroup = new THREE.Group();
    upsGroup.name = `ups_${index}`;
    
    // Main UPS body
    const upsBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.8, 0.9),
        new THREE.MeshStandardMaterial({ 
            color: 0xffff00,
            metalness: 0.3,
            roughness: 0.5
        })
    );
    upsBody.position.y = 0.9;
    upsGroup.add(upsBody);

    // Cooling vents
    const ventGeometry = new THREE.BoxGeometry(1.4, 0.1, 0.3);
    const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    
    for (let i = 0; i < 3; i++) {
        const vent = new THREE.Mesh(ventGeometry, ventMaterial);
        vent.position.set(0, 0.3 + i * 0.4, 0.46);
        upsGroup.add(vent);
    }

    // Status panel
    const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.3, 0.01),
        new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2
        })
    );
    panel.position.set(0, 1.5, 0.46);
    upsGroup.add(panel);

    // Status lights
    const statusLights = [];
    const lightGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    
    // Power light
    const powerLight = new THREE.Mesh(
        lightGeometry,
        new THREE.MeshStandardMaterial({
            color: powerStatus.ups ? 0x00ff00 : 0xff0000,
            emissive: powerStatus.ups ? 0x00aa00 : 0xaa0000,
            emissiveIntensity: 0.7
        })
    );
    powerLight.position.set(-0.3, 1.5, 0.47);
    powerLight.userData = { type: 'ups', index };
    upsGroup.add(powerLight);
    statusLights.push(powerLight);

    // Cooling status light
    const coolingLight = new THREE.Mesh(
        lightGeometry,
        new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            emissive: 0x0088cc,
            emissiveIntensity: 0.5
        })
    );
    coolingLight.position.set(0, 1.5, 0.47);
    upsGroup.add(coolingLight);
    statusLights.push(coolingLight);

    // Add small cooling fans
    const fanGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16);
    const fanMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    
    for (let i = 0; i < 2; i++) {
        const fan = new THREE.Mesh(fanGeometry, fanMaterial);
        fan.position.set(i === 0 ? -0.5 : 0.5, 1.2, 0.46);
        fan.rotation.x = Math.PI / 2;
        upsGroup.add(fan);
    }

    upsGroup.userData = { statusLights };
    return upsGroup;
};

// Enhanced PDU with cooling
const createPDU = (roomLayout, powerStatus) => {
    const pduGroup = new THREE.Group();
    pduGroup.name = 'pdu';

    // Main PDU body
    const pduBody = new THREE.Mesh(
        new THREE.BoxGeometry(3, 0.8, 0.5),
        new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            metalness: 0.7,
            roughness: 0.3
        })
    );
    pduBody.position.y = 0.4;
    pduGroup.add(pduBody);

    // Cooling vents
    const ventGeometry = new THREE.BoxGeometry(2.8, 0.05, 0.4);
    const ventMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
    
    for (let i = 0; i < 2; i++) {
        const vent = new THREE.Mesh(ventGeometry, ventMaterial);
        vent.position.set(0, 0.2 + i * 0.3, 0);
        pduGroup.add(vent);
    }

    // Status lights
    const statusLights = [];
    const lightGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    
    for (let i = 0; i < 4; i++) {
        const light = new THREE.Mesh(
            lightGeometry,
            new THREE.MeshStandardMaterial({
                color: powerStatus.main ? 0x00ff00 : 0xff0000,
                emissive: powerStatus.main ? 0x00aa00 : 0xaa0000,
                emissiveIntensity: 0.7
            })
        );
        light.position.set(-1.2 + i * 0.8, 0.7, 0.26);
        light.userData = { type: 'pdu', index: i };
        pduGroup.add(light);
        statusLights.push(light);
    }

    pduGroup.userData = { statusLights };
    return pduGroup;
};

// Power room cooling system
const createPowerRoomCooling = (roomLayout) => {
    const coolingGroup = new THREE.Group();
    coolingGroup.name = 'powerRoomCooling';

    // Main cooling unit
    const coolingUnit = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2, 1.5),
        new THREE.MeshStandardMaterial({
            color: 0x4682B4,
            metalness: 0.8,
            roughness: 0.2
        })
    );
    coolingUnit.position.set(roomLayout.x + 5, 1, roomLayout.z - 8);
    coolingGroup.add(coolingUnit);

    // Control panel
    const panel = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.8, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    panel.position.set(roomLayout.x + 5, 1.4, roomLayout.z - 8.73);
    coolingGroup.add(panel);

    // Status display
    const display = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 0.5),
        new THREE.MeshStandardMaterial({
            color: 0x00aa00,
            emissive: 0x008800,
            emissiveIntensity: 0.5
        })
    );
    display.position.set(roomLayout.x + 5, 1.4, roomLayout.z - 8.7);
    display.rotation.y = Math.PI;
    coolingGroup.add(display);

    // Cooling pipe going to the wall
    const pipeGeometry = new THREE.CylinderGeometry(0.1, 0.1, 3, 16);
    const pipeMaterial = new THREE.MeshStandardMaterial({
        color: 0x87CEEB,
        metalness: 0.9,
        roughness: 0.1
    });

    const pipe = new THREE.Mesh(pipeGeometry, pipeMaterial);
    pipe.position.set(roomLayout.x + 7, 1, roomLayout.z - 8);
    pipe.rotation.z = Math.PI / 2; // Lay pipe horizontally
    coolingGroup.add(pipe);

    return coolingGroup;
};


// Generator creation
const createGenerator = (isActive) => {
    const generatorGroup = new THREE.Group();

    // Generator base
    const generatorBase = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.2, 2.5),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    generatorBase.position.y = 0.1;
    generatorGroup.add(generatorBase);

    // Main generator body
    const generatorBody = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, 1.2, 2.3),
        new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.4,
            roughness: 0.6
        })
    );
    generatorBody.position.y = 0.8;
    generatorGroup.add(generatorBody);

    // Top housing
    const generatorTop = new THREE.Mesh(
        new THREE.BoxGeometry(3.5, 0.6, 2.0),
        new THREE.MeshStandardMaterial({
            color: 0x3a3a3a,
            metalness: 0.3,
            roughness: 0.5
        })
    );
    generatorTop.position.y = 1.7;
    generatorGroup.add(generatorTop);

    // Exhaust system
    const exhaustPipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.15, 1.5, 16),
        new THREE.MeshStandardMaterial({ color: 0x777777 })
    );
    exhaustPipe.position.set(-1.0, 1.6, -0.8);
    exhaustPipe.rotation.x = Math.PI / 2;
    generatorGroup.add(exhaustPipe);

    // Add exhaust elbow for realistic connection to the generator
    const exhaustElbow = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.1, 16, 16, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x666666 })
    );
    exhaustElbow.position.set(-1.0, 1.6, -0.1);
    exhaustElbow.rotation.y = Math.PI / 2;
    generatorGroup.add(exhaustElbow);

    // Add exhaust cap at the end near the wall
    const exhaustCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.2, 0.2, 16),
        new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    exhaustCap.position.set(-1.0, 1.6, -1.6);
    exhaustCap.rotation.x = Math.PI / 2;
    generatorGroup.add(exhaustCap);

    // Add a wall connection flange
    const wallFlange = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    wallFlange.position.set(-1.0, 1.6, -1.7);
    wallFlange.rotation.x = Math.PI / 2;
    generatorGroup.add(wallFlange);

    // Control panel
    const controlPanel = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.6, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    controlPanel.position.set(1.5, 1.3, 1.1);
    generatorGroup.add(controlPanel);

    // Panel details
    const panelScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.3),
        new THREE.MeshBasicMaterial({
            color: isActive ? 0x00aa00 : 0x333333,
            emissive: isActive ? 0x00aa00 : 0x111111
        })
    );
    panelScreen.position.set(controlPanel.position.x, controlPanel.position.y, controlPanel.position.z + 0.03);
    generatorGroup.add(panelScreen);

    // Add indicator lights with proper positioning
    const indicatorPositions = [
        { x: 1.2, y: 1.1, color: isActive ? 0x00ff00 : 0x555555 }, // Power indicator
        { x: 1.0, y: 1.1, color: 0xffaa00 }, // Warning light
        { x: 1.4, y: 1.1, color: 0xff0000 }  // Fault light
    ];

    indicatorPositions.forEach(({ x, y, color }) => {
        const light = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshBasicMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: isActive ? 0.8 : 0.2
            })
        );
        light.position.set(x, y, controlPanel.position.z + 0.03);
        generatorGroup.add(light);
    });
    generatorGroup.rotation.y = Math.PI;

    return generatorGroup;
};



// Add power cables connecting the components
const addPowerConnections = (group, roomLayout) => {
    const createCable = (startPos, endPos, color = 0x333333, thickness = 0.05) => {
        const cableDepth = -0.3; // Depth below ground level (y=0) for underground routing

        const points = [];

        // Start at source position
        points.push(new THREE.Vector3(startPos.x, startPos.y, startPos.z));

        // Drop below the floor
        points.push(new THREE.Vector3(startPos.x, cableDepth, startPos.z));

        // Underground segment toward destination
        points.push(new THREE.Vector3(endPos.x, cableDepth, endPos.z));

        // Rise up to the destination position
        points.push(new THREE.Vector3(endPos.x, endPos.y, endPos.z));

        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.TubeGeometry(curve, 20, thickness, 8, false);

        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.7,
            metalness: 0.2
        });

        const cable = new THREE.Mesh(geometry, material);
        group.add(cable);
        return cable;
    };

    // Define positions
    const pduPos = {
        x: roomLayout.x - 2,
        y: 0.4, // Height of PDU center (adjust to cable attach point)
        z: roomLayout.z + 6
    };

    const genPos = {
        x: roomLayout.x + 8,
        y: 0.8,
        z: roomLayout.z + 5
    };

    // Generator to PDU connection
    createCable(genPos, pduPos, 0x222222, 0.08);

    // UPS units to PDU connections
    for (let i = 0; i < 4; i++) {
        const xOffset = (i % 2) * 8;
        const zOffset = Math.floor(i / 2) * 6;

        const upsPos = {
            x: roomLayout.x - 6 + xOffset,
            y: 0.9,
            z: roomLayout.z - 5 + zOffset
        };

        createCable(upsPos, pduPos);
    }
};
