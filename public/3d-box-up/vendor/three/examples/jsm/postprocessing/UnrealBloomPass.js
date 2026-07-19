import * as THREE from 'three';

const fullscreenTriangle = new THREE.BufferGeometry();
fullscreenTriangle.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 3, -1, -1, 3], 2));
fullscreenTriangle.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

class FullScreenQuad {
  constructor(material) {
    this._mesh = new THREE.Mesh(fullscreenTriangle, material);
    this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._scene = new THREE.Scene();
    this._scene.add(this._mesh);
  }

  get material() {
    return this._mesh.material;
  }

  set material(value) {
    this._mesh.material = value;
  }

  render(renderer) {
    renderer.render(this._scene, this._camera);
  }
}

class UnrealBloomPass {
  constructor(resolution = new THREE.Vector2(256, 256), strength = 1, radius = 0.4, threshold = 0.85) {
    this.enabled = true;
    this.needsSwap = true;
    this.renderToScreen = false;
    this.selectionScene = null;
    this.selectionCamera = null;
    this.selectionLayer = 1;
    this.strength = strength;
    this.radius = radius;
    this.threshold = threshold;
    this.resolution = resolution.clone();
    this.clearColor = new THREE.Color(0x000000);

    const parameters = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      stencilBuffer: false,
      depthBuffer: false,
    };

    this.highTarget = new THREE.WebGLRenderTarget(this.resolution.x, this.resolution.y, parameters);
    this.blurTargetA = this.highTarget.clone();
    this.blurTargetB = this.highTarget.clone();

    this.highPassMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        threshold: { value: threshold },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float threshold;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float brightness = max(max(color.r, color.g), color.b);
          float amount = smoothstep(threshold, threshold + 0.22, brightness);
          gl_FragColor = vec4(color.rgb * amount, color.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        texSize: { value: new THREE.Vector2(this.resolution.x, this.resolution.y) },
        direction: { value: new THREE.Vector2(1, 0) },
        radius: { value: radius },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 texSize;
        uniform vec2 direction;
        uniform float radius;
        varying vec2 vUv;
        void main() {
          vec2 texel = direction / texSize * mix(2.0, 7.0, radius);
          vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
          sum += texture2D(tDiffuse, vUv + texel * 1.384615) * 0.316216;
          sum += texture2D(tDiffuse, vUv - texel * 1.384615) * 0.316216;
          sum += texture2D(tDiffuse, vUv + texel * 3.230769) * 0.070270;
          sum += texture2D(tDiffuse, vUv - texel * 3.230769) * 0.070270;
          gl_FragColor = sum;
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        bloomTexture: { value: null },
        strength: { value: strength },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform sampler2D bloomTexture;
        uniform float strength;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec3 bloom = texture2D(bloomTexture, vUv).rgb * strength;
          gl_FragColor = vec4(base.rgb + bloom, base.a);
        }
      `,
      depthTest: false,
      depthWrite: false,
      transparent: false,
    });

    this.fsQuad = new FullScreenQuad(this.highPassMaterial);
  }

  setSize(width, height) {
    const bloomWidth = Math.max(1, Math.floor(width / 2));
    const bloomHeight = Math.max(1, Math.floor(height / 2));
    this.highTarget.setSize(bloomWidth, bloomHeight);
    this.blurTargetA.setSize(bloomWidth, bloomHeight);
    this.blurTargetB.setSize(bloomWidth, bloomHeight);
    this.blurMaterial.uniforms.texSize.value.set(bloomWidth, bloomHeight);
  }

  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.highTarget);
    renderer.clear();

    if (this.selectionScene && this.selectionCamera) {
      const oldMask = this.selectionCamera.layers.mask;
      this.selectionCamera.layers.set(this.selectionLayer);
      renderer.render(this.selectionScene, this.selectionCamera);
      this.selectionCamera.layers.mask = oldMask;
    } else {
      this.highPassMaterial.uniforms.tDiffuse.value = readBuffer.texture;
      this.highPassMaterial.uniforms.threshold.value = this.threshold;
      this.fsQuad.material = this.highPassMaterial;
      this.fsQuad.render(renderer);
    }

    this.blurMaterial.uniforms.radius.value = this.radius;
    this.blurMaterial.uniforms.tDiffuse.value = this.highTarget.texture;
    this.blurMaterial.uniforms.direction.value.set(1, 0);
    this.fsQuad.material = this.blurMaterial;
    renderer.setRenderTarget(this.blurTargetA);
    renderer.clear();
    this.fsQuad.render(renderer);

    this.blurMaterial.uniforms.tDiffuse.value = this.blurTargetA.texture;
    this.blurMaterial.uniforms.direction.value.set(0, 1);
    renderer.setRenderTarget(this.blurTargetB);
    renderer.clear();
    this.fsQuad.render(renderer);

    this.compositeMaterial.uniforms.tDiffuse.value = readBuffer.texture;
    this.compositeMaterial.uniforms.bloomTexture.value = this.blurTargetB.texture;
    this.compositeMaterial.uniforms.strength.value = this.strength;
    this.fsQuad.material = this.compositeMaterial;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    renderer.clear();
    this.fsQuad.render(renderer);
  }

  dispose() {
    this.highTarget.dispose();
    this.blurTargetA.dispose();
    this.blurTargetB.dispose();
    this.highPassMaterial.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
  }
}

export { UnrealBloomPass };
