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

    constructor(size, params, dataStore) {
        super();
        this.size = size;
        this.params = params;
        this.loaded = false;
        this.dataStore = dataStore;
    }

    generate() {
        const rng = new RNG(this.params.seed);
        this.initializeTerrain();
        this.generateTerrain(rng);
        this.generateClouds(rng);
        this.loadPlayerChanges();
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

    loadPlayerChanges() {
        for(let x=0;x<this.size.width;x++) {
            for(let y=0;y<this.size.height;y++) {
                for(let z=0;z<this.size.width;z++) {
                    if(this.dataStore.contains(this.position.x, this.position.z, x, y, z)) {
                        const blockId = this.dataStore.get(this.position.x, this.position.y, x, y, z);
                        this.setBlockId(x, y, z, blockId);
                    }
                }
            }
        }
    }

    generateTerrain(rng) {
        // use Simplex noise for structured and smooth noise rather than random.
        const simplex = new SimplexNoise(rng);
        for(let x=0;x<this.size.width;x++) {
            for(let z=0;z<this.size.width;z++) {
                const biome = this.getBiome(simplex, x, z);
                // Compute the noise value at x-z location
                const value = simplex.noise(
                    (this.position.x + x) / this.params.terrain.scale,
                    (this.position.z + z) / this.params.terrain.scale
                );

                // Scale the noise based on the magnitude/offset to generate mountains
                const scaledNoise = this.params.terrain.offset + this.params.terrain.magnitude * value;

                // Compute the height of the terrain at x-z location.
                // Floor to get integer value
                let height = Math.floor(scaledNoise);

                // Clamp the height between 0, and the max
                height = Math.max(0, Math.min(height, this.size.height - 1));

                for (let y = this.size.height; y >= 0; y--) {
                    if (y <= this.params.terrain.waterOffset && y === height) {
                        this.setBlockId(x, y, z, blocks.sand.id);
                    } else if (y === height) {
                        let groundBlockType;
                        if (biome === 'Desert') {
                            groundBlockType = blocks.sand.id;
                        } else if (biome === 'Temperate' || biome === 'Jungle') {
                            groundBlockType = blocks.grass.id;
                        } else if (biome === 'Tundra') {
                            groundBlockType = blocks.snow.id;
                        } else if (biome === 'Jungle') {
                            groundBlockType = blocks.jungleGrass.id;
                        }
            
                        this.setBlockId(x, y, z, groundBlockType);
            
                        if (rng.random() < this.params.trees.frequency) {
                            this.generateTree(rng, biome, x, height + 1, z);
                        }
                    } else if (y < height && this.getBlock(x, y, z).id === blocks.empty.id) {
                        this.generateResourceIfNeeded(simplex, x, y, z);
                    }
                }
            }
        }
    }

    generateMeshes() {
        this.clear();
        this.generateWater();
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
            this.dataStore.set(this.position.x, this.position.z, x, y, z, blocks.empty.id);
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
            this.dataStore.set(this.position.x, this.position.z, x, y, z, blockId);
        }
    }

    generateTree(rng, biome, x, y, z) {
        const minH = this.params.trees.trunk.minHeight;
        const maxH = this.params.trees.trunk.maxHeight;
        const h = Math.round(minH + (maxH - minH) * rng.random());
    
        for (let treeY = y; treeY < y + h; treeY++) {
            if (biome === 'Temperate' || biome === 'Tundra') {
                this.setBlockId(x, treeY, z, blocks.tree.id);
            } else if (biome === 'Jungle') {
                this.setBlockId(x, treeY, z, blocks.jungleTree.id);
            } else if (biome === 'Desert') {
                this.setBlockId(x, treeY, z, blocks.cactus.id);
            }
        }
    
        if (biome === 'Temperate' || biome === 'Jungle') {
            this.generateTreeCanopy(biome, x, y + h, z, rng);
        }
    }
    
    generateTreeCanopy(biome, centerX, centerY, centerZ, rng) {
        const minR = this.params.trees.canopy.minRadius;
        const maxR = this.params.trees.canopy.maxRadius;
        const r = Math.round(minR + (maxR - minR) * rng.random());
    
        for (let x = -r; x <= r; x++) {
            for (let y = -r; y <= r; y++) {
                for (let z = -r; z <= r; z++) {
                const n = rng.random();
        
                if (x * x + y * y + z * z > r * r) continue;
                    const block = this.getBlock(centerX + x, centerY + y, centerZ + z);
                    if (block && block.id !== blocks.empty.id) continue;
                    if (n < this.params.trees.canopy.density) {
                        if (biome === 'Temperate') {
                            this.setBlockId(centerX + x, centerY + y, centerZ + z, blocks.leaves.id);
                        } else if (biome === 'Jungle') {
                            this.setBlockId(centerX + x, centerY + y, centerZ + z, blocks.jungleLeaves.id);
                        }
                    }
                }
            }
        }
    }

    generateResourceIfNeeded(simplex, x, y, z) {
        this.setBlockId(x, y, z, blocks.dirt.id);
        resources.forEach(resource => {
            const value = simplex.noise3d(
                (this.position.x + x) / resource.scale.x,
                (this.position.y + y) / resource.scale.y,
                (this.position.z + z) / resource.scale.z);
        
            if (value > resource.scarcity) {
                this.setBlockId(x, y, z, resource.id);
            }
        });
    }

    generateClouds(rng) {
        const simplex = new SimplexNoise(rng);
        for(let x=0;x<this.size.width;x++) {
            for(let z=0;z<this.size.width;z++) {
                const value = (simplex.noise(
                    (this.position.x+x)/this.params.clouds.scale,
                    (this.position.z+z)/this.params.clouds.scale
                ) + 1) * 0.5; 

                if(value < this.params.clouds.density) {
                    this.setBlockId(x, this.size.height -1, z, blocks.cloud.id)
                }
            }
        }
    }

    generateWater() {
        const material = new THREE.MeshLambertMaterial({
            color: 0x9090e0,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
        waterMesh.rotateX(-Math.PI / 2.0);
        waterMesh.position.set(
            this.size.width / 2,
            this.params.terrain.waterOffset + 0.4,
            this.size.width / 2
        );
        waterMesh.scale.set(this.size.width, this.size.width, 1);
        waterMesh.layers.set(1);

        this.add(waterMesh);
    }

    /**
     * 
     * @param {Simplex} simplex 
     * @param {number} x 
     * @param {number} z 
     */
    getBiome(simplex, x, z) {
        let noise = 0.5 * simplex.noise(
            (this.position.x + x) / this.params.biomes.scale,
            (this.position.z + z) / this.params.biomes.scale
        ) + 0.5;

        noise += this.params.biomes.variation.amplitude * (simplex.noise(
            (this.position.x + x) / (this.params.biomes.scale / this.params.biomes.variation.scale),
            (this.position.z + z) / (this.params.biomes.scale / this.params.biomes.variation.scale)
        ));

        if(noise < this.params.biomes.tundraToTemperate) {
            return 'Tundra';
        } else if(noise < this.params.biomes.temperateToJungle) {
            return 'Temperate';
        } else if(noise < this.params.biomes.jungleToDesert) {
            return 'Jungle';
        } else {
            return 'Desert';
        }
    }
}