class RenderPass {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.enabled = true;
    this.needsSwap = true;
    this.clear = true;
    this.renderToScreen = false;
  }

  render(renderer, writeBuffer) {
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = oldAutoClear;
  }
}

export { RenderPass };
