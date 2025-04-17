import * as THREE from 'three';
const createRackPDU = (width, height, depth, hasPower) => {
  const group = new THREE.Group();
  const pdu = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.6,
      metalness: 0.3
    })
  );
  group.add(pdu);
  return group;
};

// Main server rack creation function
export const createServerRack = (width, height, depth, temp, index, powerStatus, tempToColor) => {
  const group = new THREE.Group();
  const baseColor = tempToColor(temp, 'rack');

  // Main rack frame
  const frameGeometry = new THREE.BoxGeometry(width, height, depth);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.6,
    metalness: 0.3,
    transparent: true,
    opacity: 0.2,
  });
  const rack = new THREE.Mesh(frameGeometry, frameMaterial);
  rack.name = `rackBody_${index}`;
  group.add(rack);

  // Add vertical rails
  const railGeometry = new THREE.BoxGeometry(0.02, height * 0.98, 0.05);
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
  
  const leftRail = new THREE.Mesh(railGeometry, railMaterial);
  leftRail.position.set(-width * 0.45, 0, depth * 0.4);
  group.add(leftRail);
  
  const rightRail = new THREE.Mesh(railGeometry, railMaterial);
  rightRail.position.set(width * 0.45, 0, depth * 0.4);
  group.add(rightRail);

  const holeGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.02, 8);
  const holeMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
  
  for (let i = 0; i < 42; i++) {
    const hole = new THREE.Mesh(holeGeometry, holeMaterial);
    hole.position.set(width * 0.45, -height / 2 + 0.02 + (i * height / 42), depth * 0.4);
    hole.rotation.x = Math.PI / 2;
    group.add(hole);

    const hole2 = hole.clone();
    hole2.position.x = -width * 0.45;
    group.add(hole2);
  }

  // Server configuration
  const addServers = () => {
    const serverCount = 10;
    const serverUHeight = 3;
    const gapU = 1;
    const uHeight = height / 42;

    for (let i = 0; i < serverCount; i++) {
      const serverHeight = serverUHeight * uHeight;
      const positionY = -height / 2 + (i * (serverUHeight + gapU) * uHeight) + (serverHeight / 2);

      // Server body
      const server = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.88, serverHeight, depth * 0.75),
        new THREE.MeshStandardMaterial({
          color: 0x777777,
          roughness: 0.8,
          metalness: 0.1
        })
      );
      server.position.set(0, positionY, 0);
      group.add(server);

      // Faceplate
      const faceplate = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.85, serverHeight * 0.95, 0.02),
        new THREE.MeshStandardMaterial({
          color: 0x555555,
          roughness: 0.4,
          metalness: 0.3,
          transparent: true,
          opacity: 0.3,
        })
      );
      faceplate.position.set(0, positionY, depth * 0.38);
      group.add(faceplate);

      // Server vents
      const ventCount = 9;
      for (let v = 0; v < ventCount; v++) {
        const vent = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.8, 0.005, 0.02),
          new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        vent.position.set(
          0,
          positionY - serverHeight * 0.4 + v * (serverHeight * 0.8 / ventCount),
          depth * 0.38
        );
        group.add(vent);
      }

      // Server LEDs
      const ledColors = [0x00ff00, 0xffff00, 0xff0000, 0x0000ff];
      for (let l = 0; l < 3; l++) {
        const led = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01, 0.01, 0.01, 8),
          new THREE.MeshBasicMaterial({
            color: ledColors[l % ledColors.length],
            emissive: ledColors[l % ledColors.length],
            emissiveIntensity: 0.8
          })
        );
        led.position.set(
          width * 0.35 - l * 0.03,
          positionY - serverHeight * 0.3,
          depth * 0.381
        );
        led.rotation.x = Math.PI / 2;
        group.add(led);
      }
    }
  };

  addServers();

  // Add cable management
  const cableArm = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.1, height * 0.7, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x555555 })
  );
  cableArm.position.set(0, 0, -depth * 0.4);
  group.add(cableArm);

  // Add PDU
  const pdu = createRackPDU(0.2, height * 0.8, 0.15, powerStatus.main);
  pdu.position.set(width * 0.6, 0, 0);
  group.add(pdu);

  // Add UPS
  const upsHeight = height * 0.1;
  const ups = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.9, upsHeight, depth * 0.8),
    new THREE.MeshStandardMaterial({
      color: 0xC0C0C0,
      roughness: 0.7,
      metalness: 0.1
    })
  );
  ups.position.set(0, -height / 2 + upsHeight / 2, 0);
  group.add(ups);

  return group;
};