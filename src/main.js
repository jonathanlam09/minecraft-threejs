import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { World } from './scripts/world';
import { createUI } from './scripts/ui';
import { Player } from './scripts/player';
import { Physics } from './scripts/physics';
import { blocks } from './scripts/blocks';
import { ModelLoader } from './scripts/modelLoader';

const stats = new Stats();
document.body.append(stats.dom);

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x80a0e0);
document.body.appendChild(renderer.domElement);

// Camera
const orbitCamera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight);
orbitCamera.position.set(-32, 16, -32);
orbitCamera.lookAt(0, 0, 0);
orbitCamera.layers.enable(1);

// Controls
const controls = new OrbitControls(orbitCamera, renderer.domElement);
controls.target.set(16, 0, 16);
controls.update();

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x80a0e0, 50, 100);

const world = new World();
scene.add(world);

const player = new Player(scene);

const modelLoader = new ModelLoader();
modelLoader.loadModels((model) => {
    player.tool.setMesh(model.pickaxe);
})

const physics = new Physics(scene);

const sun = new THREE.DirectionalLight();
function setupLights() { 
    sun.intensity = 3;
    sun.castShadow = true;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.far = 0.1;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.0001;
    // sun.shadow.normalBias = -0.0001;
    sun.position.set(50, 50, 50);
    sun.shadow.mapSize = new THREE.Vector2(2048, 2048);
    scene.add(sun);
    scene.add(sun.target);

  // const shadowHelper = new THREE.CameraHelper(sun.shadow.camera);
  // scene.add(shadowHelper)

    const ambient = new THREE.AmbientLight();
    ambient.intensity = 0.1;
    scene.add(ambient);
}

let previousTime = performance.now();
function animate() {
    let currentTime = performance.now();
    let dt = (currentTime - previousTime) / 1000;

    requestAnimationFrame(animate);
   
    if(player.controls.isLocked) {
        player.update(world);
        physics.update(dt, player, world);
        world.update(player);
        sun.position.copy(player.position);
        sun.position.sub(new THREE.Vector3(-50, -50, -50));
        sun.target.position.copy(player.position);
    }
    renderer.render(scene, player.controls.isLocked ? player.camera : orbitCamera);
    stats.update();
    previousTime = currentTime;
}

/**
 * 
 * @param {MouseEvent} e
 */
function onMouseDown(e) {
    console.log('down')
    // player must go into first person mode and selectedCoords must be defined 
    // Selected coords defined meaning to say there is a selected block
    if(player.controls.isLocked && player.selectedCoords) {
        console.log(player.activeBlockId)
        if(player.activeBlockId === blocks.empty.id) {
            world.removeBlock(
                player.selectedCoords.x,
                player.selectedCoords.y,
                player.selectedCoords.z
            );
            player.tool.startAnimation();
        } else {
            world.addBlock(
                player.selectedCoords.x,
                player.selectedCoords.y,
                player.selectedCoords.z,
                player.activeBlockId
            );
        }
    }
}

window.addEventListener('mousedown', onMouseDown)

window.addEventListener('resize', () => {
    orbitCamera.aspect = window.innerWidth/window.innerHeight;
    orbitCamera.updateProjectionMatrix();
    player.camera.aspect = window.innerWidth/window.innerHeight;
    player.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
})

// createUI(world, player);
world.generate();
setupLights();
animate();