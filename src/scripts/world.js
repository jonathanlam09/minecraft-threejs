import * as THREE from 'three';
import { WorldChunk } from './worldChunk';

export class World extends THREE.Group {
    asyncLoading = true;
    drawDistance = 1;
    chunkSize = {
        width: 64,
        height: 32
    };
    params = {
        seed: 0,
        terrain: {
            scale: 30,
            magnitude: .5,
            offset: .2
        }
    };

    constructor(seed = 0) {
        super();
        this.seed = seed;
    }

    generate() {
        this.disposeChunks();
        for (let x=-this.drawDistance;x<=this.drawDistance;x++) {
            for(let z=-this.drawDistance;z<=this.drawDistance;z++) {
                const chunk = new WorldChunk(this.chunkSize, this.params);
                chunk.position.set(x * this.chunkSize.width, 0, z * this.chunkSize.width);
                chunk.userData= {x, z};
                chunk.generate();
                this.add(chunk);
            }
        }
    }
 
    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * @param {number} z 
     * @returns {{ 
     *  chunk: {x: number, z: number},
     *  block: {x: number, z: number}
     * }}
     */
    worldToChunkCoords(x, y, z) {
        const chunkCoords = {
            x: Math.floor(x / this.chunkSize.width),
            z: Math.floor(z / this.chunkSize.width)
        };
    
        const blockCoords = {
            x: x - this.chunkSize.width * chunkCoords.x,
            y,
            z: z - this.chunkSize.width * chunkCoords.z
        };
    
        return {
            chunk: chunkCoords,
            block: blockCoords
        }
    }

    getChunk(chunkX, chunkZ) {
        return this.children.find((chunk) => (
            chunk.userData.x === chunkX &&
            chunk.userData.z === chunkZ
        ));
    }

    getBlock(x, y, z) {
        const coords = this.worldToChunkCoords(x, y, z);
        const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

        if(chunk && chunk.loaded) {
            return chunk.getBlock(
                coords.block.x,
                coords.block.y,
                coords.block.z
            );
        } else {
            return null;
        }
    }

    disposeChunks() {
        this.traverse(chunk => {
            if(chunk.disposeInstances) chunk.disposeInstances();      
        });
        this.clear();
    }

    update(player) {
        const visibleChunks = this.getVisibleChunk(player);
        const chunksToAdd = this.getChunksToAdd(visibleChunks);
        this.removeUnusedChunks(visibleChunks);

        if(chunksToAdd.length > 0) {
            for(const chunk of chunksToAdd) {
                this.generateChunk(chunk.x, chunk.z);
            }
        }
    }

    getVisibleChunk (player) {
        const visibleChunks = [];
        const coords = this.worldToChunkCoords(
            player.position.x,
            player.position.y,
            player.position.z
        );
        const chunkX = coords.chunk.x;
        const chunkZ  = coords.chunk.z;

        for(let x=chunkX - this.drawDistance;x<=chunkX + this.drawDistance;x++) {
            for(let z=chunkZ - this.drawDistance;z<=chunkZ + this.drawDistance;z++) {
                visibleChunks.push({x, z});
            }
        }
        return visibleChunks;
    }

    /**
     * 
     * @param {{ x: number, z: number }[]} visibleChunks 
     * @returns {{ x: number, z: number }[]}
     */
    getChunksToAdd(visibleChunks) {
        return visibleChunks.filter((chunk) => {
            const chunkExist = this.children
            .map((obj) => obj.userData)
            .find(({ x, z }) => (
                chunk.x === x && chunk.z === z
            ))
            return !chunkExist
        })
    }

    removeUnusedChunks(visibleChunks) {
        const chunksToRemove = this.children.filter((chunk) => {
            const { x, z } = chunk.userData;
            const chunkExist = visibleChunks
            .find((visibleChunk) => (
                visibleChunk.x === x && visibleChunk.z === z
            ))
            return !chunkExist
        })

        for (const chunks of chunksToRemove) {
            chunks.disposeInstances();
            this.remove(chunks);
        }
    }

    generateChunk (x, z) {
        const chunk = new WorldChunk(this.chunkSize, this.params);
        chunk.position.set(x * this.chunkSize.width, 0, z * this.chunkSize.width);
        chunk.userData= {x, z};
        if(this.asyncLoading) {
            requestIdleCallback(chunk.generate.bind(chunk), {timeout: 1000});
        } else {
            chunk.generate();
        }
        this.add(chunk);
    }
}