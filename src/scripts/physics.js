import { blocks } from "./blocks";
import * as THREE from 'three';

const collisionGeometry = new THREE.BoxGeometry(1.001, 1.001, 1.001);
const collisionMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.2
});

const contactGeometry = new THREE.SphereGeometry(0.05, 6, 6);
const contactMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x00ff00
});

export class Physics {
    gravity = 32;

    // Physic simulation rate
    simulationRate = 250;
    stepSize = 1 / this.simulationRate;
    // Accumulator to keep track of leftover dt
    accumulator = 0;

    constructor (scene) {
     
        this.helpers = new THREE.Group();
        // this.helpers.visible = false;
        scene.add(this.helpers);
    }

    /**
     * Moves the physics simulation forward in time by 'dt' (delta time) (current frame time - previous frame time)
     * @param {number} dt 
     * @param {Player} player 
     * @param {World} world 
     */
    update(dt, player, world) {
        this.helpers.clear();
        player.velocity.y -= this.gravity * dt;
        player.applyInputs(dt);
        player.updateBoundsHelper();
        this.detectCollisions(player, world);
        // this.accumulator += dt;
        // while (this.accumulator >= this.stepSize) {
        //     player.velocity.y -= this.gravity * this.stepSize;
        //     player.applyInputs(this.stepSize);
        //     this.detectCollisions(player, world);
        //     this.accumulator -= this.stepSize;
        // }
    }

    broadPhase (player, world) {
        let candidates = [];

        const extents = {
            x: {
                min: Math.floor(player.position.x - player.radius),
                max: Math.ceil(player.position.x + player.radius)
            },
            y: {
                min: Math.floor(player.position.y - player.height),
                max: Math.ceil(player.position.y)
            },
            z: {
                min: Math.floor(player.position.z - player.radius),
                max: Math.ceil(player.position.z + player.radius)
            }
        }

        for(let x=extents.x.min;x<=extents.x.max;x++) {
            for(let y=extents.y.min;y<=extents.y.max;y++) {
                for(let z=extents.z.min;z<=extents.z.max;z++) {
                    const block = world.getBlock(x, y, z);
                    if(block && block.id !== blocks.empty.id) {
                        const blockPos = { x, y, z };
                        candidates.push(blockPos);
                        this.addCollisionHelper(blockPos);
                    }
                }
            }
        }

        // console.log(`Broadphase candidates: ${candidates.length}`);
        return candidates;
    }

    narrowPhase(candidates, player) {
        const collisions = [];

        for(const block of candidates) {
            const p = player.position;
            const closestPoint = {
                x: Math.max(block.x - 0.5, Math.min(p.x, block.x + 0.5)),
                y: Math.max(block.y - 0.5, Math.min(p.y - (player.height / 2), block.y + 0.5)),
                z: Math.max(block.z - 0.5, Math.min(p.z, block.z + 0.5))
            };

            const dx = closestPoint.x - player.position.x;
            const dy = closestPoint.y - (player.position.y - (player.height / 2));
            const dz = closestPoint.z - player.position.z;

            if(this.pointInPlayerBoundingCylinder(closestPoint, player)) {
                const overlapY = (player.height / 2) - Math.abs(dy);
                const overlapXZ = player.radius - Math.sqrt(dx * dx + dz * dz);

                let normal, overlap;
                if(overlapY < overlapXZ) {
                    normal = new THREE.Vector3(0, -Math.sign(dy), 0);
                    overlap = overlapY;
                } else {
                    normal = new THREE.Vector3(-dx, 0, -dz).normalize();
                    overlap = overlapXZ
                }

                collisions.push({
                    block,
                    contactPoint: closestPoint,
                    normal,
                    overlap
                })
                this.addContactPointHelper(closestPoint)
            }
        }
        // console.log(`Narrowphase collisions: ${collisions.length}`)
        return collisions;
    }

    /**
     * Main function for collision detection
     * @param {Player} player 
     * @param {World} world 
     */
    detectCollisions(player, world) {
        const candidates = this.broadPhase(player, world);
        const collisions = this.narrowPhase(candidates, player);

        if(collisions.length > 0) {
            this.resolveCollisions(collisions, player);
        }
    }

    resolveCollisions(collisions, player) {
        // Resolve the collisions in order of the smallest overlap to the largest
        collisions.sort((a, b) => {
            return a.overlap < b.overlap;
        });

        for (const collision of collisions) {
            // We need to re-check if the contact point is inside the player bounding
            // cylinder for each collision since the player position is updated after
            // each collision is resolved
            // if (!this.pointInPlayerBoundingCylinder(collision.contactPoint, player)) continue;

            // Adjust position of player so the block and player are no longer overlapping
            let deltaPosition = collision.normal.clone();
            deltaPosition.multiplyScalar(collision.overlap);
            player.position.add(deltaPosition);
            console.log(collision.normal)
            // Get the magnitude of the player's velocity along the collision normal
            let magnitude = player.worldVelocity.dot(collision.normal);
            // // Remove that part of the velocity from the player's velocity
            let velocityAdjustment = collision.normal.clone().multiplyScalar(magnitude);
            // // Apply the velocity to the player
            
            player.applyWorldDeltaVelocity(velocityAdjustment.negate());
        }
    }

    // Helper function to create collision block
    addCollisionHelper(block) {
        const blockMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
        blockMesh.position.copy(block);
        this.helpers.add(blockMesh);
    }

    // Helper function to create contact point mesh
    addContactPointHelper(p) {
        const contactMesh = new THREE.Mesh(contactGeometry, contactMaterial);
        contactMesh.position.copy(p);
        this.helpers.add(contactMesh);
    }

    /**
     * 
     * @param {{  x: number, y: number, z: number }} p 
     * @param {Player} player 
     * @returns {boolean}
     */
    pointInPlayerBoundingCylinder(p, player) {
        const dx = p.x - player.position.x;
        const dy = p.y - (player.position.y - (player.height / 2));
        const dz = p.z - player.position.z;
        // Calculate the hypotenuse
        // Not using sqrt due to resource expensive
        const r_sq = dx * dx + dz * dz;

        // Check if contact point is inside the player's bounding cylinder
        return (Math.abs(dy) < (player.height / 2)) && (r_sq < (player.radius * player.radius));
    }
}