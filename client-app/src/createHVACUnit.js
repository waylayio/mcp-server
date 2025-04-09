import * as THREE from 'three';

export const createHVACUnit = (width, height, depth, temp, tempToColor) => {
    const group = new THREE.Group();
    const baseColor = tempToColor(temp, 'hvac');

    // Main unit with more realistic materials and structure
    const hvacGeometry = new THREE.BoxGeometry(width, height, depth);
    const hvac = new THREE.Mesh(
        hvacGeometry,
        new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.5,
            metalness: 0.8,
            transparent: true,
            opacity: 0.65,
            normalMap: createPanelNormalMap(width, height),
            envMapIntensity: 0.5
        })
    );
    hvac.castShadow = true;
    hvac.receiveShadow = true;
    hvac.name = 'hvacBody';
    hvac.position.y = height / 2;
    group.add(hvac);

    // Add more detailed panel features
    addPanelDetails(group, width, height, depth);

    // Brand logo or control panel
    addControlPanel(group, width, height, depth);

    // Enhanced vent system with more realistic slats
    const ventGroup = createVentSystem(width, height, depth);
    group.add(ventGroup);

    // Add condenser coils visible from the side
    addCondenserCoils(group, width, height, depth);

    // Airflow particles
    const particles = new THREE.BufferGeometry();
    const count = 100;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * width * 0.8;
        positions[i * 3 + 1] = -height * 0.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * depth * 0.8;
        velocities[i] = 0.02 + Math.random() * 0.03;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.userData = { velocities, originalPositions: positions.slice() };

    const particleSystem = new THREE.Points(
        particles,
        new THREE.PointsMaterial({
            color: new THREE.Color(0x7090FF),
            size: 0.02,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        })
    );
    group.userData.particles = particles;
    group.add(particleSystem);

    return { group, particleSystem };
};

// Helper functions for HVAC unit
function addPanelDetails(group, width, height, depth) {
    // Panel seams with more realistic geometry
    const seamMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.7,
        metalness: 0.2
    });

    // Add multiple seams for more realism
    const seamPositions = [
        { y: height - 0.01, thickness: 0.01 },
        { y: height * 0.75, thickness: 0.005 },
        { y: height * 0.25, thickness: 0.005 },
        { y: 0.01, thickness: 0.01 }
    ];

    seamPositions.forEach(seam => {
        const seamMesh = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.98, seam.thickness, depth * 0.98),
            seamMaterial
        );
        seamMesh.position.set(0, seam.y, 0);
        group.add(seamMesh);
    });

    // Side seams
    const verticalSeam = new THREE.Mesh(
        new THREE.BoxGeometry(0.005, height * 0.98, depth * 0.98),
        seamMaterial
    );
    verticalSeam.position.set(width * 0.49, height / 2, 0);
    group.add(verticalSeam);

    const verticalSeam2 = verticalSeam.clone();
    verticalSeam2.position.set(-width * 0.49, height / 2, 0);
    group.add(verticalSeam2);

    // Add screw details
    const screwGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.02, 6);
    const screwHeadGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.01, 6);
    const screwMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.5,
        metalness: 0.9
    });
    const screwSlotMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });

    const screwPositions = [
        [width / 2 - 0.08, height - 0.01, depth / 2 - 0.08],
        [-width / 2 + 0.08, height - 0.01, depth / 2 - 0.08],
        [width / 2 - 0.08, height - 0.01, -depth / 2 + 0.08],
        [-width / 2 + 0.08, height - 0.01, -depth / 2 + 0.08],
        [width / 2 - 0.05, height * 0.75, depth / 2 - 0.1],
        [width / 2 - 0.05, height * 0.25, depth / 2 - 0.1],
        [-width / 2 + 0.05, height * 0.75, depth / 2 - 0.1],
        [-width / 2 + 0.05, height * 0.25, depth / 2 - 0.1]
    ];

    screwPositions.forEach(pos => {
        const screw = new THREE.Mesh(screwGeometry, screwMaterial);
        screw.position.set(pos[0], pos[1], pos[2]);
        screw.rotation.x = Math.PI / 2;
        group.add(screw);

        const screwHead = new THREE.Mesh(screwHeadGeometry, screwMaterial);
        screwHead.position.set(pos[0], pos[1] + 0.005, pos[2]);
        screwHead.rotation.x = Math.PI / 2;
        group.add(screwHead);

        const screwSlot = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, 0.002, 0.005),
            screwSlotMaterial
        );
        screwSlot.position.set(pos[0], pos[1] + 0.011, pos[2]);
        screwSlot.rotation.y = Math.random() * Math.PI;
        group.add(screwSlot);
    });
}

function createVentSystem(width, height, depth) {
    const ventGroup = new THREE.Group();
    const ventCount = 8;
    const ventSpacing = height * 0.06;
    const slatMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.6,
        metalness: 0.7,
        transparent: false
    });

    for (let i = 0; i < ventCount; i++) {
        const ventSlat = new THREE.Mesh(
            new THREE.BoxGeometry(width * 0.85, 0.01, depth * 0.8),
            slatMaterial
        );
        ventSlat.position.set(0, height * 0.6 + i * ventSpacing, 0);
        ventSlat.rotation.x = Math.PI * 0.15;
        ventGroup.add(ventSlat);

        ventSlat.geometry.vertices?.forEach(vertex => {
            if (vertex.z > 0) vertex.z -= 0.02;
        });
        ventSlat.geometry.verticesNeedUpdate = true;
    }

    const ventFrameMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.5,
        metalness: 0.6,
        transparent: false
    });

    const ventFrame = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.92, ventCount * ventSpacing + 0.1, depth * 0.85),
        ventFrameMaterial
    );
    ventFrame.position.set(0, height * 0.6 + (ventCount - 1) * ventSpacing * 0.5, 0);

    const frameEdge1 = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.92, 0.03, 0.03),
        ventFrameMaterial
    );
    frameEdge1.position.set(0, height * 0.6 - 0.05, depth * 0.4);
    ventGroup.add(frameEdge1);

    const frameEdge2 = frameEdge1.clone();
    frameEdge2.position.set(0, height * 0.6 - 0.05, -depth * 0.4);
    ventGroup.add(frameEdge2);

    const frameEdge3 = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.03, depth * 0.85),
        ventFrameMaterial
    );
    frameEdge3.position.set(width * 0.45, height * 0.6 - 0.05, 0);
    ventGroup.add(frameEdge3);

    const frameEdge4 = frameEdge3.clone();
    frameEdge4.position.set(-width * 0.45, height * 0.6 - 0.05, 0);
    ventGroup.add(frameEdge4);

    return ventGroup;
}

function addCondenserCoils(group, width, height, depth) {
    const coilMaterial = new THREE.MeshStandardMaterial({
        color: 0x886633,
        roughness: 0.7,
        metalness: 0.8
    });

    const tubeRadius = 0.01;
    const gridSize = {
        x: Math.floor(width * 0.8 / (tubeRadius * 4)),
        y: Math.floor(height * 0.7 / (tubeRadius * 4))
    };

    const coilGroup = new THREE.Group();

    for (let y = 0; y < gridSize.y; y++) {
        const tube = new THREE.Mesh(
            new THREE.CylinderGeometry(tubeRadius, tubeRadius, width * 0.8, 8),
            coilMaterial
        );
        tube.rotation.z = Math.PI / 2;
        tube.position.set(0, y * tubeRadius * 4 + height * 0.15, -depth / 2 + 0.02);
        coilGroup.add(tube);
    }

    for (let x = 0; x < gridSize.x; x++) {
        const tube = new THREE.Mesh(
            new THREE.CylinderGeometry(tubeRadius, tubeRadius, height * 0.7, 8),
            coilMaterial
        );
        tube.position.set(
            x * tubeRadius * 4 - width * 0.4 + tubeRadius * 2,
            height * 0.15 + (height * 0.7 / 2),
            -depth / 2 + 0.02
        );
        coilGroup.add(tube);
    }

    const finMaterial = new THREE.MeshStandardMaterial({
        color: 0x999999,
        roughness: 0.5,
        metalness: 0.7,
        transparent: true,
        opacity: 0.8
    });

    const finGeometry = new THREE.PlaneGeometry(width * 0.85, height * 0.75);
    const fins = new THREE.Mesh(finGeometry, finMaterial);
    fins.position.set(0, height * 0.15 + (height * 0.7 / 2), -depth / 2 + 0.01);
    coilGroup.add(fins);

    group.add(coilGroup);
}

function createPanelNormalMap(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#6060ff';
    ctx.lineWidth = 3;

    const panelRows = 4;
    for (let i = 1; i < panelRows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, canvas.height * i / panelRows);
        ctx.lineTo(canvas.width, canvas.height * i / panelRows);
        ctx.stroke();
    }

    const panelCols = 3;
    for (let i = 1; i < panelCols; i++) {
        ctx.beginPath();
        ctx.moveTo(canvas.width * i / panelCols, 0);
        ctx.lineTo(canvas.width * i / panelCols, canvas.height);
        ctx.stroke();
    }

    for (let i = 0; i < 500; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const size = 1 + Math.random() * 2;

        ctx.fillStyle = Math.random() > 0.5 ? '#7575ff' : '#8585ff';
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function addControlPanel(group, width, height, depth) {
    const panelGroup = new THREE.Group();
    const panelWidth = width * 0.3;
    const panelHeight = height * 0.15;

    const panel = new THREE.Mesh(
        new THREE.BoxGeometry(panelWidth, panelHeight, 0.05),
        new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.6,
            metalness: 0.4
        })
    );
    panel.position.set(0, height * 0.85, depth / 2 + 0.026);
    panelGroup.add(panel);

    const buttonGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16);
    const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });

    for (let i = 0; i < 3; i++) {
        const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
        button.position.set(-panelWidth / 3 + i * panelWidth / 3, height * 0.85, depth / 2 + 0.05);
        button.rotation.x = Math.PI / 2;
        panelGroup.add(button);
    }

    const display = new THREE.Mesh(
        new THREE.BoxGeometry(panelWidth * 0.8, panelHeight * 0.5, 0.01),
        new THREE.MeshStandardMaterial({
            color: 0x335533,
            emissive: 0x00aa00,
            emissiveIntensity: 0.3
        })
    );
    display.position.set(0, height * 0.85 - panelHeight * 0.2, depth / 2 + 0.05);
    panelGroup.add(display);

    group.add(panelGroup);
}

export const createChilledWaterSystem = (width, height, depth, temp) => {
    const group = new THREE.Group();
    group.name = 'chilledWaterSystem';
  
    // Main cooling unit
    const unitGeometry = new THREE.BoxGeometry(width, height, depth);
    const unitMaterial = new THREE.MeshStandardMaterial({
      color: 0x4682B4, // Steel blue color
      metalness: 0.8,
      roughness: 0.3
    });
    const mainUnit = new THREE.Mesh(unitGeometry, unitMaterial);
    mainUnit.castShadow = true;
    mainUnit.receiveShadow = true;
    group.add(mainUnit);
  
    // Control panel
    const panelGeometry = new THREE.BoxGeometry(width * 0.8, height * 0.2, depth * 0.1);
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const controlPanel = new THREE.Mesh(panelGeometry, panelMaterial);
    controlPanel.position.set(0, 0, depth * 0.55);
    group.add(controlPanel);
  
    // Status display
    const displayGeometry = new THREE.BoxGeometry(width * 0.6, height * 0.1, depth * 0.05);
    const displayMaterial = new THREE.MeshStandardMaterial({
      color: temp < 15 ? 0x00FF00 : temp < 20 ? 0xFFFF00 : 0xFF0000,
      emissive: temp < 15 ? 0x00AA00 : temp < 20 ? 0xAAAA00 : 0xAA0000,
      emissiveIntensity: 0.7
    });
    const statusDisplay = new THREE.Mesh(displayGeometry, displayMaterial);
    statusDisplay.position.set(0, height * 0.25, depth * 0.55);
    group.add(statusDisplay);
  
    // Water pipes
    const pipeRadius = 0.1;
    const pipeGeometry = new THREE.CylinderGeometry(pipeRadius, pipeRadius, height * 0.8);
    const pipeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x87CEEB, // Light sky blue
      metalness: 0.9,
      roughness: 0.1
    });
  
    // Pipe connections to floor
    const verticalPipeHeight = 0.5;
    const verticalPipeGeometry = new THREE.CylinderGeometry(pipeRadius * 0.8, pipeRadius * 0.8, verticalPipeHeight);
  
    // Left connection
    const leftConnection = new THREE.Mesh(verticalPipeGeometry, pipeMaterial);
    leftConnection.position.set(-width * 0.4, -height * 0.5 - verticalPipeHeight/2, 0);
    group.add(leftConnection);
  
    // Right connection
    const rightConnection = new THREE.Mesh(verticalPipeGeometry, pipeMaterial);
    rightConnection.position.set(width * 0.4, -height * 0.5 - verticalPipeHeight/2, 0);
    group.add(rightConnection);
  
    return { group };
  };