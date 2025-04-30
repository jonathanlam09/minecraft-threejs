import * as THREE from 'three';

export class Tool extends THREE.Group {
    animate = false;
    animationAmplitude = 0.5;
    animationDuration = 1000;
    animationStart = 0;
    animationSpeed = 0.025;
    animation = undefined;
    toolMesh = undefined;

    setMesh(mesh) {
        this.clear();
        this.toolMesh = mesh;
        this.add(mesh);
        mesh.receiveShadow = true;
        mesh.castShadow = true;

        this.position.set(0.6, -0.3, -0.5);
        this.scale.set(0.5, 0.5, 0.5);
        this.rotation.z = Math.PI / 2;
        this.rotation.y = Math.PI + 0.2;
    }

    get animationTime() {
        return performance.now() - this.animationStart;
    }

    update() {
        if(this.animate && this.toolMesh) {
            this.toolMesh.rotation.y = this.animationAmplitude * Math.sin(this.animationTime * this.animationSpeed);
        }
    }

    startAnimation() {
        if(this.animate) return;
        
        this.animate = true;
        this.animationStart = performance.now();
        clearTimeout(this.animate);

        this.animation = setTimeout(() => {
            this.animate = false;
            this.toolMesh.rotation.y = 0;
        }, this.animationDuration)
    }
}