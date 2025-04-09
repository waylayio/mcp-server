import * as THREE from 'three';

export const createNOCCenter = (ROOM_LAYOUT, WALL_HEIGHT, animationRefs) => {
    const group = new THREE.Group();
    
    // NOC Center Base
    const noc = new THREE.Mesh(
        new THREE.BoxGeometry(ROOM_LAYOUT.noc.width, 5, ROOM_LAYOUT.noc.depth),
        new THREE.MeshStandardMaterial({
            color: 0x2a3f5f,
            transparent: true,
            opacity: 0.5
        })
    );
    noc.position.set(ROOM_LAYOUT.noc.x, 2, ROOM_LAYOUT.noc.z);
    group.add(noc);

    // Enhanced Workstations
    for (let i = 0; i < 8; i++) {
        const workstation = new THREE.Group();
        
        // Modern L-shaped Desk
        const deskMain = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.7, 0.8),
            new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
        );
        deskMain.position.set(0, 0.35, 0);
        workstation.add(deskMain);
        
        // Desk extension (L-shape part)
        const deskExtension = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.7, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
        );
        deskExtension.position.set(-0.8, 0.35, 0.7);
        workstation.add(deskExtension);
        
        // Desk legs
        const legGeometry = new THREE.BoxGeometry(0.05, 0.7, 0.05);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const positions = [
            [-0.775, 0.35, -0.375],
            [0.775, 0.35, -0.375],
            [-0.775, 0.35, 0.375],
            [0.775, 0.35, 0.375]
        ];
        positions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(pos[0], pos[1], pos[2]);
            workstation.add(leg);
        });

        // Modern curved monitor
        const monitorStand = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.1, 0.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        monitorStand.position.set(0, 0.5, -0.1);
        monitorStand.rotation.x = Math.PI/2;
        workstation.add(monitorStand);
        
        const monitorNeck = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.3, 0.03),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        monitorNeck.position.set(0, 0.75, -0.1);
        workstation.add(monitorNeck);
        
        const monitor = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.5, 0.02),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        monitor.position.set(0, 0.9, -0.1);
        // Add slight curve to monitor
        monitor.geometry.computeVertexNormals();
        monitor.geometry.normalsNeedUpdate = true;
        workstation.add(monitor);

        // Screen with bezel
        const screen = new THREE.Mesh(
            new THREE.PlaneGeometry(0.75, 0.45),
            new THREE.MeshBasicMaterial({
                color: 0x0066ff,
                emissive: 0x0066ff,
                emissiveIntensity: 0.7
            })
        );
        screen.position.set(0, 0.9, -0.09);
        workstation.add(screen);
        animationRefs.current.networkFlows.push(screen);

        // Keyboard
        const keyboard = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.02, 0.15),
            new THREE.MeshStandardMaterial({ color: 0x111111 })
        );
        keyboard.position.set(0.3, 0.72, 0.2);
        workstation.add(keyboard);
        
        // Computer tower
        const tower = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.5, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
        );
        tower.position.set(-1.3, 0.5, 0.4);
        workstation.add(tower);
        
        // Office chair
        const chair = new THREE.Group();
        const chairBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16),
            new THREE.MeshStandardMaterial({ color: 0x444444 })
        );
        chairBase.position.set(0, 0.05, 0.8);
        chair.add(chairBase);
        
        const chairPole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        chairPole.position.set(0, 0.25, 0.8);
        chair.add(chairPole);
        
        const chairSeat = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.05, 0.4),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
        );
        chairSeat.position.set(0, 0.45, 0.8);
        chair.add(chairSeat);
        
        const chairBack = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.3, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
        );
        chairBack.position.set(0, 0.6, 1);
        chair.add(chairBack);
        workstation.add(chair);

        workstation.position.set(
            ROOM_LAYOUT.noc.x - 8 + (i % 4) * 5,
            0,
            ROOM_LAYOUT.noc.z - 6 + Math.floor(i / 4) * 4
        );
        group.add(workstation);
    }

    // Wall with door (same as previous improved version)
    const wallThickness = 0.3;
    const doorWidth = 2;
    const doorHeight = 3;
    
    // Left wall segment
    const leftWall = new THREE.Mesh(
        new THREE.BoxGeometry(6, WALL_HEIGHT - 3, wallThickness),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    );
    leftWall.position.set(ROOM_LAYOUT.noc.x - 5, 2.5, ROOM_LAYOUT.noc.z - 9.8);
    group.add(leftWall);
    
    // Right wall segment
    const rightWall = new THREE.Mesh(
        new THREE.BoxGeometry(4, WALL_HEIGHT - 3, wallThickness),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    );
    rightWall.position.set(ROOM_LAYOUT.noc.x + 8, 2.5, ROOM_LAYOUT.noc.z - 9.8);
    group.add(rightWall);
    
    // Top wall segment above door
    const topWall = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, WALL_HEIGHT - 3 - doorHeight, wallThickness/3),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0a })
    );
    topWall.position.set(ROOM_LAYOUT.noc.x + 1, doorHeight + (WALL_HEIGHT - 3 - doorHeight)/2, ROOM_LAYOUT.noc.z - 9.8);
    group.add(topWall);

    // Door frame
    const doorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth + 0.2, doorHeight + 0.2, wallThickness/2),
        new THREE.MeshStandardMaterial({ color: 0x5a3a22 })
    );
    doorFrame.position.set(ROOM_LAYOUT.noc.x + 1, doorHeight/2, ROOM_LAYOUT.noc.z - 9.8);
    group.add(doorFrame);
    
    // Door
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(doorWidth, doorHeight, wallThickness/3),
        new THREE.MeshStandardMaterial({ color: 0x8b4513 })
    );
    door.position.set(ROOM_LAYOUT.noc.x + 1, doorHeight/2, ROOM_LAYOUT.noc.z - 9.8 - wallThickness/4);
    door.userData.isDoor = true;
    group.add(door);
    animationRefs.current.door = door;

    return group;
};