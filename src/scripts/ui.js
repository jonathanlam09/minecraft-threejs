import { GUI } from 'three/addons/libs/lil-gui.module.min.js'
import { blocks, resources } from './blocks';

export function createUI(world, player) {
    const gui = new GUI();

    const playerFolder = gui.addFolder('Player');
    playerFolder.add(player, 'maxSpeed', 1, 20).name('Max Speed');

    gui.add(world.chunkSize, 'width', 8, 128, 1).name('Width');
    gui.add(world.chunkSize, 'height', 8, 64, 1).name('Height');

    const terrainFolder = gui.addFolder('Terrain');
    terrainFolder.add(world.params, 'seed', 0, 10000).name('Seed');
    terrainFolder.add(world.params.terrain, 'scale', 10, 100).name('Scale');
    terrainFolder.add(world.params.terrain, 'magnitude', 0, 1).name('Magnitude');
    terrainFolder.add(world.params.terrain, 'offset', 0, 1).name('Offset');

    const resourcesFolder = gui.addFolder('Resources');
    resources.forEach((resource) => {
        const scaleFolder = resourcesFolder.addFolder('Scale');
        resourcesFolder.add(resource, 'scarcity', 0, 1).name('Scarcity');

        scaleFolder.add(resource.scale, 'x', 10, 100).name('X scale');
        scaleFolder.add(resource.scale, 'y', 10, 100).name('Y scale');
        scaleFolder.add(resource.scale, 'z', 10, 100).name('Z scale');
    })

    gui.onChange(() => {
        world.generate();
    })
} 