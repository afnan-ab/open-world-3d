import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// ========== CONFIG ==========
const TERRAIN_SIZE = 2000;
const TERRAIN_SEGMENTS = 256; // higher = smoother, less "low poly"
const WORLD_HEIGHT_SCALE = 80;

// ========== SCENE SETUP ==========
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0x87CEEB, 0.00085);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(0, 40, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// ========== LIGHTING (more realistic) ==========
const ambient = new THREE.AmbientLight(0x404060, 0.45);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3d5c3a, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4e0, 1.8);
sun.position.set(180, 320, 120);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 900;
sun.shadow.camera.left = -400;
sun.shadow.camera.right = 400;
sun.shadow.camera.top = 400;
sun.shadow.camera.bottom = -400;
sun.shadow.bias = -0.0003;
scene.add(sun);
scene.add(sun.target);

// Soft fill light
const fill = new THREE.DirectionalLight(0xb0c4de, 0.35);
fill.position.set(-120, 80, -80);
scene.add(fill);

// ========== TERRAIN (smooth, high segment count) ==========
function noise2D(x, z) {
  // Simple layered value noise approximation for natural terrain
  const n1 = Math.sin(x * 0.008) * Math.cos(z * 0.007) * 0.6;
  const n2 = Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.019) * 0.25;
  const n3 = Math.sin(x * 0.055) * Math.cos(z * 0.048 + 2.1) * 0.1;
  return (n1 + n2 + n3);
}

const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
terrainGeo.rotateX(-Math.PI / 2);

const pos = terrainGeo.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const h = noise2D(x, z) * WORLD_HEIGHT_SCALE;
  // Extra detail ridges
  const ridge = Math.abs(Math.sin(x * 0.012) * Math.cos(z * 0.011)) * 12;
  pos.setY(i, h + ridge * 0.4);
}
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  color: 0x4a7c3f,
  roughness: 0.88,
  metalness: 0.02,
  flatShading: false // smooth shading = not low-poly look
});

const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
terrain.castShadow = true;
scene.add(terrain);

// ========== GROUND DETAILS (rocks, patches) ==========
function addScatter(count, radius, yOffset = 0) {
  const geo = new THREE.IcosahedronGeometry(1.2, 1); // higher detail
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.75, metalness: 0.1 });
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    mesh.position.set(Math.cos(angle) * r, yOffset, Math.sin(angle) * r);
    mesh.scale.setScalar(0.6 + Math.random() * 1.8);
    mesh.rotation.set(Math.random(), Math.random(), Math.random());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
}
addScatter(120, 700);

// ========== SIMPLE TREES (higher poly-ish) ==========
function createTree() {
  const group = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 6, 10);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 3;
  trunk.castShadow = true;
  group.add(trunk);

  // Foliage - multiple spheres for volume
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.85 });
  for (let i = 0; i < 4; i++) {
    const size = 2.2 - i * 0.3;
    const foliage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size, 1),
      foliageMat
    );
    foliage.position.y = 5.5 + i * 1.4;
    foliage.position.x = (Math.random() - 0.5) * 0.8;
    foliage.position.z = (Math.random() - 0.5) * 0.8;
    foliage.castShadow = true;
    group.add(foliage);
  }
  return group;
}

for (let i = 0; i < 80; i++) {
  const tree = createTree();
  const angle = Math.random() * Math.PI * 2;
  const r = 80 + Math.random() * 750;
  tree.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
  // Approximate height on terrain
  const h = noise2D(tree.position.x, tree.position.z) * WORLD_HEIGHT_SCALE;
  tree.position.y = h;
  tree.scale.setScalar(0.9 + Math.random() * 0.7);
  scene.add(tree);
}

// ========== PLAYER CONTROLS ==========
const controls = new PointerLockControls(camera, document.body);
const blocker = document.getElementById('blocker');
const crosshair = document.getElementById('crosshair');

blocker.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => {
  blocker.style.display = 'none';
  crosshair.style.display = 'block';
});
controls.addEventListener('unlock', () => {
  blocker.style.display = 'flex';
  crosshair.style.display = 'none';
});

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let canJump = false;
let isSprinting = false;

const onKeyDown = (e) => {
  switch (e.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
    case 'Space': if (canJump) { velocity.y += 18; canJump = false; } break;
    case 'ShiftLeft': case 'ShiftRight': isSprinting = true; break;
  }
};
const onKeyUp = (e) => {
  switch (e.code) {
    case 'KeyW': moveForward = false; break;
    case 'KeyS': moveBackward = false; break;
    case 'KeyA': moveLeft = false; break;
    case 'KeyD': moveRight = false; break;
    case 'ShiftLeft': case 'ShiftRight': isSprinting = false; break;
  }
};
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Simple ground height sampling
function getTerrainHeight(x, z) {
  return noise2D(x, z) * WORLD_HEIGHT_SCALE + 2.2; // eye height offset approx
}

// ========== ANIMATION LOOP ==========
const clock = new THREE.Clock();
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = Math.min((time - prevTime) / 1000, 0.05);
  prevTime = time;

  if (controls.isLocked) {
    velocity.x -= velocity.x * 8.0 * delta;
    velocity.z -= velocity.z * 8.0 * delta;
    velocity.y -= 32.0 * delta; // gravity

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    const speed = isSprinting ? 55 : 28;
    if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    camera.position.y += velocity.y * delta;

    // Ground collision
    const groundY = getTerrainHeight(camera.position.x, camera.position.z);
    if (camera.position.y < groundY) {
      velocity.y = 0;
      camera.position.y = groundY;
      canJump = true;
    }
  }

  // Keep sun target near player for better shadows
  sun.target.position.copy(camera.position);
  sun.target.updateMatrixWorld();

  renderer.render(scene, camera);
}

animate();

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
