import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { blocks } from './blocks';
import { Tool } from './tool';

const CENTER_SCREEN = new THREE.Vector2();
export class Player {
    radius = 0.5;
    height = 1.75;
    maxSpeed = 7;
    input = new THREE.Vector3();
    velocity = new THREE.Vector3();
    #worldVelocity = new THREE.Vector3();
    jumpspeed = 10;
    onGround = false;

    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 200);
    cameraHelper = new THREE.CameraHelper(this.camera);
    controls =  new PointerLockControls(this.camera, document.body);

    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 3);
    selectedCoords = null;
    activeBlockId = blocks.empty.id;

    tool = new Tool();
    
    constructor(scene) {
        this.camera.position.set(32, 16, 32);
        this.camera.layers.enable(1);
        this.camera.add(this.tool);
        scene.add(this.camera);
        scene.add(this.cameraHelper);

        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        this.boundsHelper = new THREE.Mesh(
            new THREE.CylinderGeometry(this.radius, this.radius, this.height, 16),
            new THREE.MeshBasicMaterial({ wireframe: true })
        );
        this.boundsHelper.visible = false;
        scene.add(this.boundsHelper);

        const selectionMaterial = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: .3,
            color: 0xffffaa
        });
        const selectionGeomtry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        this.selectionHelper = new THREE.Mesh(selectionGeomtry, selectionMaterial);
        scene.add(this.selectionHelper);

        this.raycaster.layers.set(0);
    }

    get worldVelocity() {
        this.#worldVelocity.copy(this.velocity);
        this.#worldVelocity.applyEuler(new THREE.Euler(0, this.camera.rotation.y, 0));
        return this.#worldVelocity;
    }

    /**
     * To update the player state
     * @param {World} world 
     */
    update(world) {
        this.updateRaycaster(world);
        this.tool.update();
    }

    /**
     * To add raycaster to player 
     * @param {World} world 
     */
    updateRaycaster(world) {
        this.raycaster.setFromCamera(CENTER_SCREEN, this.camera);
        const intersections = this.raycaster.intersectObject(world, true);
        if(intersections.length) {
            // To add only one block, we get the very first intersection 
            const intersection = intersections[0];

            // To get the transformation matrix of the intersected block
            const blockMatrix = new THREE.Matrix4();
            intersection.object.getMatrixAt(intersection.instanceId, blockMatrix);

            // To extract the matrix and store it into the selection coordinate variable
            const chunk = intersection.object.parent;
            this.selectedCoords = chunk.position.clone();
            this.selectedCoords.applyMatrix4(blockMatrix);

            if(this.activeBlockId !== blocks.empty.id) {
                this.selectedCoords.add(intersection.normal);
            }
            this.selectionHelper.position.copy(this.selectedCoords);
            this.selectionHelper.visible = true;
        } else {
            this.selectedCoords = null;
            this.selectionHelper.visible = false;
        }
    }

    applyWorldDeltaVelocity(dv) {
        dv.applyEuler(new THREE.Euler(0, -this.camera.rotation.y, 0));
        this.velocity.add(dv);
    } 

    applyInputs(dt) {
        if (this.controls.isLocked) {
            this.velocity.x = this.input.x;
            this.velocity.z = this.input.z;
            this.controls.moveRight(this.velocity.x * dt);
            this.controls.moveForward(this.velocity.z * dt);
            this.position.y += this.velocity.y * dt;
            document.getElementById('player-position').innerHTML = this.toString();
        }
    }

    updateBoundsHelper() {
        this.boundsHelper.position.copy(this.position);
        this.boundsHelper.position.y -= this.height / 2;
    }

    /**
     * @type {THREE.Vector3}
     */
    get position() {
        return this.camera.position;
    }

    /**
     * @param {KeyboardEvent} event
     */
    onKeyDown(e) {
        document.getElementById('overlay').style.display = 'none';
        if(!this.controls.isLocked) {
            this.controls.lock();
        }

        switch(e.code) {
            case 'Digit0': 
            case 'Digit1': 
            case 'Digit2': 
            case 'Digit3': 
            case 'Digit4': 
            case 'Digit5': 
            case 'Digit6': 
            case 'Digit7': 
            case 'Digit8': 
                document.getElementById(`toolbar-${this.activeBlockId}`).classList.remove('selected')
                this.activeBlockId = Number(e.key);
                document.getElementById(`toolbar-${this.activeBlockId}`).classList.add('selected')

                this.tool.visible = (this.activeBlockId === 0);
                break;
             case 'KeyW':
                this.input.z = this.maxSpeed;
                break;
            case 'KeyA':
                this.input.x = -this.maxSpeed;
                break;
            case 'KeyS':
                this.input.z = -this.maxSpeed;
                break;
            case 'KeyD':
                this.input.x = this.maxSpeed;
                break;
            case 'KeyR': 
                this.position.set(32, 16, 32);
                this.velocity.set(0, 0, 0);
                break;
            case 'Space':
                if(this.onGround) {
                    this.velocity.y += this.jumpspeed;
                }
                break;
        }
    }

    /**
     * 
     * @param {KeyboardEvent} event
     */
    onKeyUp(e) {
        switch(e.code) {
            case 'KeyW':
                this.input.z = 0;
                break;
            case 'KeyA':
                this.input.x = 0;
                break;
            case 'KeyS':
                this.input.z = 0;
                break;
            case 'KeyD':
                this.input.x = 0;
                break;
        }
    }

    toString() {
        let str = '';
        str += `X: ${this.position.x.toFixed(3)}`;
        str += `Y: ${this.position.y.toFixed(3)}`;
        str += `Z: ${this.position.z.toFixed(3)}`;
        return str;
    }
}