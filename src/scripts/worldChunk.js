import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { RNG } from './rng';
import { blocks, resources } from './blocks';

const geometry = new THREE.BoxGeometry(1, 1, 1);

export class WorldChunk extends THREE.Group {
  /**
   * @type {{ 
   * id:number,
   * instanceId: number 
   * }}
   */
    data = [];

    constructor(size, params) {
        super();
        this.size = size;
        this.params = params;
        this.loaded = false;
    }

    generate() {
        const rng = new RNG(this.params.seed);
        this.initializeTerrain();
        this.generateResources(rng);
        this.generateTerrain(rng);
        this.generateMeshes();
        this.loaded = true;
    }

    // Initialize terrain
    initializeTerrain () {
        this.data = [];
        for(let x=0;x<this.size.width;x++) {
            const slice = [];
            for(let y=0;y<this.size.height;y++) {
                const row = [];
                for (let z=0;z<this.size.width;z++) {
                    row.push({
                        id: blocks.empty.id,
                        instanceId: null
                    })
                }
                slice.push(row);
            }
            this.data.push(slice);
        }
    }

    generateResources(rng) {
        const simplex = new SimplexNoise(rng);
        resources.forEach((resource) => {
            for(let x=0;x<this.size.width;x++) {
                for(let y=0;y<this.size.height;y++) {
                    for(let z=0;z<this.size.width;z++) {
                        const value = simplex.noise3d(
                            (this.position.x + x)/resource.scale.x, 
                            (this.position.y + y)/resource.scale.y, 
                            (this.position.z + z)/resource.scale.z
                        );

                        if(value > resource.scarcity) {
                            this.setBlockId(x, y, z, resource.id);
                        }
                    }
                }
            }
        })
    }

    generateTerrain(rng) {
        // use Simplex noise for structured and smooth noise rather than random.
        const simplex = new SimplexNoise(rng);
        for(let x=0;x<this.size.width;x++) {
            for(let z=0;z<this.size.width;z++) {
                // Compute the noise value at x-z location
                const value = simplex.noise(
                    (this.position.x + x) / this.params.terrain.scale,
                    (this.position.z + z) / this.params.terrain.scale
                );

                // Scale the noise based on the magnitude/offset to generate mountains
                const scaledNoise = this.params.terrain.offset + this.params.terrain.magnitude * value;

                // Compute the height of the terrain at x-z location.
                // Floor to get integer value
                let height = Math.floor(this.size.height * scaledNoise);

                // Clamp the height between 0, and the max
                height = Math.max(0, Math.min(height, this.size.height - 1));

                // Fill the blocks and initialize ID
                for(let y=0;y<=this.size.height;y++) {
                    if(y < height && this.getBlock(x, y, z).id == blocks.empty.id) {
                        this.setBlockId(x, y, z, blocks.dirt.id);
                    } else if (y === height) {
                        this.setBlockId(x, y, z, blocks.grass.id);
                    } else if(y > height) {
                        this.setBlockId(x, y, z, blocks.empty.id);
                    }
                }
            }
        }
    }

    generateMeshes() {
        this.clear();
        const maxCount = this.size.width * this.size.width * this.size.height;
        const meshes = {};

        Object.values(blocks)
        .filter(blockType => blockType.id !== blocks.empty.id)
        .forEach(blockType => {
            const mesh = new THREE.InstancedMesh(geometry, blockType.material, maxCount);
            mesh.name = blockType.id;
            mesh.count = 0;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            meshes[blockType.id] = mesh;
        }) 
        
        const matrix = new THREE.Matrix4();
        for(let x=0;x<this.size.width;x++) {
            for(let y=0;y<this.size.height;y++) {
                for(var z=0;z<this.size.width;z++) {
                    const blockId = this.getBlock(x, y, z).id;
                    if(blockId == blocks.empty.id) continue;
                    const mesh = meshes[blockId];
                    const instanceId = mesh.count

                    if(!this.isBlockObscured(x, y, z)) {
                        matrix.setPosition(x, y, z)
                        mesh.setMatrixAt(instanceId, matrix);
                        this.setBlockInstanceId(x, y, z, instanceId);
                        mesh.count++;
                    }
                }
            }
        }
        this.add(...Object.values(meshes));
    } 

  /**
   * 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {{ id: number, instanceId: number }}
   */
    getBlock(x, y, z) {
        if(this.inBounds(x, y, z)) {
            return this.data[x][y][z];
        } else {
            return null;
        }
    }

  /**
   * 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} id 
   */
    setBlockId(x, y, z, id) {
        if(this.inBounds(x, y, z)) {
            this.data[x][y][z].id = id;
        }
    }

  /**
   * 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} instanceId 
   */
    setBlockInstanceId (x, y, z, instanceId) {
        if(this.inBounds(x, y, z)) {
            this.data[x][y][z].instanceId = instanceId;
        }
    }

  /**
   * 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
    inBounds(x, y, z) {
        if(x >= 0 && x < this.size.width && 
            y >= 0 && y < this.size.height &&
            z >= 0 && z < this.size.width) {
            return true;
        } else {
            return false;
        }
    }

    isBlockObscured(x, y, z) {
        const up = this.getBlock(x, y+1, z)?.id ?? blocks.empty.id;
        const down = this.getBlock(x, y-1, z)?.id ?? blocks.empty.id;
        const left = this.getBlock(x+1, y, z)?.id ?? blocks.empty.id;
        const right = this.getBlock(x-1, y, z)?.id ?? blocks.empty.id;
        const forward = this.getBlock(x, y, z+1)?.id ?? blocks.empty.id;
        const back = this.getBlock(x, y, z-1)?.id ?? blocks.empty.id;

        if(up === blocks.empty.id || 
        down === blocks.empty.id || 
        left === blocks.empty.id || 
        right === blocks.empty.id || 
        forward === blocks.empty.id || 
        back === blocks.empty.id
        ) {
            return false;
        } else {
            return true;
        }
    }

    disposeInstances () {
        this.traverse(obj => {
            if(obj.dispose) obj.dispose();
        });
        this.clear();
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    removeBlock(x, y, z) {
        const block = this.getBlock(x, y, z);
        if (block && block.id !== blocks.empty.id) {
            this.deleteBlockInstance(x, y, z);
            this.setBlockId(x, y, z, blocks.empty.id);
        //   this.dataStore.set(this.position.x, this.position.z, x, y, z, blocks.empty.id);
        }
    }

    /**
     * To remove a block we can't just change the instanceMatrix set as it was preallocated to the maximum amount during generation
     * To use a method called swapping to swap the last count of the mesh with the selected mesh 
     * Then reduce the mesh count by 1 
     * Mesh will only render up to the mesh count which mean the swapped mesh at the last position will not be rendered.
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    deleteBlockInstance(x, y, z) {
        try {
            const block = this.getBlock(x, y, z);
            if (block.id === blocks.empty.id || block.instanceId === null) return;
            const mesh = this.children.find((instanceMesh) => instanceMesh.name === block.id);
            const instanceId = block.instanceId;
            if(!mesh) {
                throw new Error('Mesh not found.');
            }

            const lastMatrix = new THREE.Matrix4();
            mesh.getMatrixAt(mesh.count - 1, lastMatrix);

            const v = new THREE.Vector3();
            v.applyMatrix4(lastMatrix);
            this.setBlockInstanceId(v.x, v.y, v.z, instanceId);
            
            mesh.setMatrixAt(instanceId, lastMatrix);
            mesh.count--; 

            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
            
            this.setBlockInstanceId(x, y, z, null);
        } catch (err) {
            console.error(err.message);
            return
        }
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     */
    addBlockInstance(x, y, z) {
        const block = this.getBlock(x, y, z);
        if (block && block.id !== blocks.empty.id && block.instanceId === null) {
            const mesh = this.children.find((instanceMesh) => instanceMesh.name === block.id);
            const instanceId = mesh.count++;
            this.setBlockInstanceId(x, y, z, instanceId);
            const matrix = new THREE.Matrix4();
            matrix.setPosition(x, y, z);
            mesh.setMatrixAt(instanceId, matrix);
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
        }
    }

    addBlock (x, y, z, blockId) {
        if (this.getBlock(x, y, z).id === blocks.empty.id) {
            this.setBlockId(x, y, z, blockId);
            this.addBlockInstance(x, y, z);
        }
    }
}