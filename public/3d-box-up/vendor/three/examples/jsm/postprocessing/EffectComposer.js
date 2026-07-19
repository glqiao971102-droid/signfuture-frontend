import * as THREE from 'three';

class EffectComposer {
  constructor(renderer) {
    this.renderer = renderer;
    this.passes = [];
    this.pixelRatio = renderer.getPixelRatio();
    const size = renderer.getSize(new THREE.Vector2());
    this.width = size.width;
    this.height = size.height;
    const parameters = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      stencilBuffer: false,
      depthBuffer: true,
    };
    this.renderTarget1 = new THREE.WebGLRenderTarget(size.width * this.pixelRatio, size.height * this.pixelRatio, parameters);
    this.renderTarget2 = this.renderTarget1.clone();
    this.writeBuffer = this.renderTarget1;
    this.readBuffer = this.renderTarget2;
  }

  addPass(pass) {
    this.passes.push(pass);
    pass.setSize?.(this.width * this.pixelRatio, this.height * this.pixelRatio);
  }

  swapBuffers() {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  }

  setPixelRatio(pixelRatio) {
    this.pixelRatio = pixelRatio;
    this.setSize(this.width, this.height);
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;
    const effectiveWidth = Math.max(1, Math.floor(width * this.pixelRatio));
    const effectiveHeight = Math.max(1, Math.floor(height * this.pixelRatio));
    this.renderTarget1.setSize(effectiveWidth, effectiveHeight);
    this.renderTarget2.setSize(effectiveWidth, effectiveHeight);
    this.passes.forEach((pass) => pass.setSize?.(effectiveWidth, effectiveHeight));
  }

  render(deltaTime) {
    let maskActive = false;
    const enabledPasses = this.passes.filter((pass) => pass.enabled !== false);
    enabledPasses.forEach((pass, index) => {
      pass.renderToScreen = index === enabledPasses.length - 1;
      pass.render(this.renderer, this.writeBuffer, this.readBuffer, deltaTime, maskActive);
      if (pass.needsSwap !== false) this.swapBuffers();
    });
  }

  dispose() {
    this.renderTarget1.dispose();
    this.renderTarget2.dispose();
    this.passes.forEach((pass) => pass.dispose?.());
  }
}

export { EffectComposer };
