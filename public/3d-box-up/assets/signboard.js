// =============================================================================
// 3D Signboard renderer (Phase 1)
// -----------------------------------------------------------------------------
// Loaded ONLY on the /3d-signboard variant (gated by window.__SIGNBOARD_MODE__).
// It OVERRIDES the box-up craft-preview entry points on `window`, so the box-up
// app (/3d-box-up) is never affected — it never loads this file.
//
// What it does, per the product spec:
//   - Reads every detected object straight from the Letter / Logo records
//     (each .letter-dimension-item carries data-highlight = its position as
//     fractions of the artwork, plus a crop image of its real pixels).
//   - Lays the WHOLE artwork out in its original positions on a signboard panel.
//   - Flat mode  -> exact 2D artwork (no thickness), "Flat Signboard Preview".
//   - 3D mode    -> the SELECTED objects extrude into fabricated 3D slabs
//                   (depth, side material, LED face glow, soft shadows); the
//                   rest of the artwork stays flat.
//   - Flat / 3D toggle, per-object selection, and live updates on any control.
//
// Phase 1 applies the global controls (Surface / Box Up Size / Side / LED) to
// the selected objects. Per-object independent configuration and true
// vector-glyph extrusion are Phase 2 (the slab front face already shows the
// real letters/logo, so layout and colours are exact today).
// =============================================================================

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const scenes = new Map(); // stage element -> scene state
const textureCache = new Map(); // crop src -> Promise<THREE.Texture|null>

// ---- LED settings mirrored from the box-up engine so the look matches --------
function ledSettings(ledColor, isBlack) {
  if (isBlack || !ledColor || ledColor === "None") {
    return { emissive: 0x000000, lit: false, bloom: 0, hueAnim: false };
  }
  const map = {
    "3000K": { emissive: 0xffb35c, lit: true, bloom: 0.72 },
    "4200K": { emissive: 0xfff1d0, lit: true, bloom: 0.7 },
    "10000K": { emissive: 0x8fd8ff, lit: true, bloom: 0.76 },
    "RGB": { emissive: 0xff0044, lit: true, bloom: 0.85, hueAnim: true },
  };
  return map[ledColor] || { emissive: 0x000000, lit: false, bloom: 0 };
}

// Filament side colours (white kept bright so a white filament reads white).
const FILAMENT_SIDE = {
  "White": 0xf2f4f6,
  "Translucent White": 0xeef2ea,
  "Translucent Red": 0xe0454f,
  "Translucent Yellow": 0xf0d23a,
  "Translucent Green": 0x46c878,
  "Translucent Blue": 0x4e8fe8,
  "Translucent Orange": 0xf08a2e,
  "Translucent Cyclamen": 0xb05fd6,
};
function filamentSideColor(name) {
  return FILAMENT_SIDE[name] != null ? FILAMENT_SIDE[name] : FILAMENT_SIDE["White"];
}
function isTranslucent(name) {
  return /^Translucent\b/i.test(name || "");
}

// Read the Side Finishing config (Option 1/2/3 + per-segment filament colours)
// exactly like box-up's getSideMaterialConfig — so the extruded letter SIDES
// follow the 3D Filament Color + Side Finishing option the user picks.
function getSignboardSideConfig(card) {
  const scope = (card && (card.closest(".result, .design-card") || card)) || document;
  const selected = (scope.querySelector(".selected-side-finishing strong")?.textContent || "Option 1").trim();
  const mainColor = ((scope.querySelector(".selected-color strong")?.textContent || "White").split(",")[0] || "White").trim();
  const totalMm = (scope.querySelector(".box-up-size-select")?.value || "5cm") === "3cm" ? 30 : 50;
  const clamp = (v, t) => Math.max(0, Math.min(t, Math.round(Number(v) || 0)));
  const rowColor = (row, fb) =>
    (row && (row.querySelector(".side-filament-option.is-selected")?.dataset.sideColor || row.querySelector(".side-filament-select")?.value)) || fb;
  if (selected === "Option 2") {
    const rows = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 2"] .side-segment-card'));
    const first = clamp(rows[0]?.querySelector(".side-mm-input")?.value || Math.round(totalMm / 2), totalMm);
    const colors = rows.map((r) => rowColor(r, mainColor));
    return { colors: [colors[0] || mainColor, colors[1] || mainColor], weights: [first, totalMm - first] };
  }
  if (selected === "Option 3") {
    const rows = Array.from(scope.querySelectorAll('.side-finishing-config[data-config-for="Option 3"] .side-segment-card'));
    const colors = rows.map((r) => rowColor(r, mainColor));
    const maxEdge = Math.floor(totalMm / 2);
    const edge = Math.min(maxEdge, clamp(rows[0]?.querySelector(".side-mm-input")?.value || Math.round(totalMm / 3), maxEdge));
    return { colors: [colors[0] || mainColor, colors[1] || mainColor, colors[0] || mainColor], weights: [edge, Math.max(0, totalMm - edge * 2), edge] };
  }
  return { colors: [mainColor], weights: [1] };
}

// ---- DOM reading -------------------------------------------------------------
function cardOf(stage) {
  return stage.closest(".result, .design-card") || stage.closest(".craft-3d-preview");
}

function contentAspect(card) {
  const el = card && card.querySelector(".preview-total strong");
  const txt = el ? el.textContent || "" : "";
  // Text is "12.34 in x 56.78 in" — parse without backslash escapes.
  const m = txt.match(/([0-9.]+) in x ([0-9.]+) in/i);
  if (m) {
    const w = parseFloat(m[1]);
    const h = parseFloat(m[2]);
    if (w > 0 && h > 0) return w / h;
  }
  return 3.0;
}

function readObjects(card) {
  const items = Array.from(card.querySelectorAll(".letter-dimension-item"));
  return items
    .map((item) => {
      let hl = null;
      try {
        hl = JSON.parse(item.getAttribute("data-highlight") || "null");
      } catch (e) {
        hl = null;
      }
      const img = item.querySelector(".letter-item-preview img");
      const strong = item.querySelector(".letter-item-preview strong");
      return {
        id: item.getAttribute("data-record-id"),
        el: item,
        label: strong ? (strong.textContent || "").trim() : "",
        hl: hl, // { left, top, width, height } fractions of the content box
        src: img ? img.getAttribute("src") : null,
        selected: item.classList.contains("is-selected"),
        ledWarning: item.classList.contains("is-led-warning"),
      };
    })
    .filter((o) => o.hl);
}

function readControls(card) {
  const scope = card.closest(".result, .design-card") || card;
  const get = (sel, fallback) => {
    const el = scope.querySelector(sel);
    if (!el) return fallback;
    if (el.value != null && el.tagName === "SELECT") return el.value;
    return (el.textContent || "").trim() || fallback;
  };
  const surface = get(".mounting-base-select", "3mm White Acrylic");
  const ledColor = get(".selected-led-color strong", "None");
  const mainFilament =
    ((scope.querySelector(".selected-color strong")?.textContent || "White").split(",")[0] || "White").trim();
  return {
    surface,
    isBlack: surface === "3mm Black Acrylic",
    boxSize: get(".box-up-size-select", "5cm"),
    finishing: get(".finishing-select", "None"),
    ledColor,
    sideColorName: mainFilament,
  };
}

// ---- Texture loading (crop pixels -> transparent-background texture) ---------
// The crops are rasterised with a white background; key near-white to alpha 0 so
// the artwork colours sit cleanly on any signboard surface colour.
function loadTexture(src) {
  if (textureCache.has(src)) return textureCache.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || 2;
        c.height = img.naturalHeight || 2;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244) d[i + 3] = 0;
        }
        ctx.putImageData(data, 0, 0);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        tex.needsUpdate = true;
        resolve(tex);
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  textureCache.set(src, p);
  return p;
}

// Full artwork texture (no white-keying — shown exactly as designed). Returns
// the texture plus the image's natural size so the board aspect can match it.
function loadArtworkTexture(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 16;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      resolve({ tex, w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// From a sub-rect of the artwork, key OUT the board/background colour (estimated
// from the border pixels) so only the text/logo remains. Returns a texture whose
// transparent areas are the board — used to extrude just the lettering, not the
// rectangular board panel.
function buildKeyedTexture(image, u0, u1, v0, v1) {
  if (!image || !image.naturalWidth) return null;
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  const sx = Math.max(0, Math.round(u0 * iw));
  const sw = Math.max(1, Math.round((u1 - u0) * iw));
  const sy = Math.max(0, Math.round((1 - v1) * ih));
  const sh = Math.max(1, Math.round((v1 - v0) * ih));
  const sc = Math.min(1, 600 / sw);
  const cw = Math.max(1, Math.round(sw * sc));
  const ch = Math.max(1, Math.round(sh * sc));
  const cnv = document.createElement("canvas");
  cnv.width = cw;
  cnv.height = ch;
  const ctx = cnv.getContext("2d");
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, cw, ch);
  let data;
  try { data = ctx.getImageData(0, 0, cw, ch); } catch (e) { return null; }
  const d = data.data;
  // Estimate the board colour from the border pixels.
  let br = 0, bg = 0, bb = 0, n = 0;
  const addEdge = (px, py) => { const i = (py * cw + px) * 4; br += d[i]; bg += d[i + 1]; bb += d[i + 2]; n++; };
  const stepX = Math.max(1, (cw / 40) | 0);
  const stepY = Math.max(1, (ch / 20) | 0);
  for (let px = 0; px < cw; px += stepX) { addEdge(px, 0); addEdge(px, ch - 1); }
  for (let py = 0; py < ch; py += stepY) { addEdge(0, py); addEdge(cw - 1, py); }
  if (!n) return null;
  br /= n; bg /= n; bb /= n;
  const thr2 = 78 * 78;
  let kept = 0;
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb;
    if (dr * dr + dg * dg + db * db < thr2) d[i + 3] = 0;
    else kept++;
  }
  // If keying removed almost everything (or nothing), the region had no clear
  // foreground — keep the raw crop so something still shows.
  if (kept < d.length / 4 * 0.002) return null;
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(cnv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// ---- Scene plumbing ----------------------------------------------------------
function disposeGroup(group) {
  group.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
    else if (child.material) child.material.dispose();
  });
}

function stageSize(stage) {
  const r = stage.getBoundingClientRect();
  return {
    width: Math.max(320, Math.floor(r.width || 640)),
    height: Math.max(260, Math.floor(r.height || 460)),
  };
}

const VIEWS = {
  front: [0, 0.02, 1],
  angle: [0.5, 0.2, 1],
  side: [1.15, 0.12, 0.06],
  top: [0.12, 1.05, 0.45],
  install: [0.55, 0.22, 1],
};

function fitCamera(state) {
  const box = new THREE.Box3().setFromObject(state.content);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const v = VIEWS[state.currentView] || VIEWS.front;
  const fov = THREE.MathUtils.degToRad(state.camera.fov);
  const dist = Math.max(6, (sphere.radius / Math.sin(fov / 2)) * 1.06);
  state.camera.position.set(
    sphere.center.x + dist * v[0],
    sphere.center.y + dist * v[1],
    sphere.center.z + dist * v[2]
  );
  state.camera.near = 0.1;
  state.camera.far = 400;
  state.camera.updateProjectionMatrix();
  state.controls.target.copy(sphere.center);
  state.controls.update();
}

// Remap the +z (front) face UVs of a BoxGeometry to a sub-rect of the shared
// artwork texture so a raised slab shows exactly its region of the design.
function mapFrontFaceUV(geo, u0, u1, v0, v1) {
  const uv = geo.attributes.uv;
  // BoxGeometry face order px,nx,py,ny,pz,nz -> +z face = vertices 16..19.
  for (let i = 16; i < 20; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    uv.setXY(i, u < 0.5 ? u0 : u1, v < 0.5 ? v0 : v1);
  }
  uv.needsUpdate = true;
}

async function buildContent(state) {
  const card = cardOf(state.stage);
  if (!card) return;
  const preview = state.stage.closest(".craft-3d-preview");
  const artworkSrc = preview ? preview.getAttribute("data-artwork-src") : null;

  // clear previous content
  while (state.content.children.length) {
    const child = state.content.children[0];
    state.content.remove(child);
    disposeGroup(child);
  }
  state.litMeshes = [];

  const objs = readObjects(card);
  state.objectCount = objs.length;

  const ctrl = readControls(card);
  const mode3d = state.mode === "3d";
  // Subtle raise only — the green board is the flat sign base, the picked text
  // just pops a little. (Was much deeper before; the user wanted only slight 3D.)
  const depth = ctrl.boxSize === "3cm" ? 0.15 : 0.2;
  const led = ledSettings(ctrl.ledColor, ctrl.isBlack);
  // Side colour follows the 3D Filament Color + Side Finishing option (1/2/3),
  // split into segments along the depth like box-up.
  const sideCfg = getSignboardSideConfig(card);
  const sideWSum = sideCfg.weights.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  const sideCum = [];
  let sideAcc = 0;
  sideCfg.weights.forEach((wgt) => { sideAcc += Math.max(0, wgt) / sideWSum; sideCum.push(sideAcc); });
  // segment colour for a front->back fraction (0 = at the face, 1 = back)
  const sideColorForFrac = (frac) => {
    for (let i = 0; i < sideCum.length; i++) if (frac <= sideCum[i] + 1e-6) return sideCfg.colors[i];
    return sideCfg.colors[sideCfg.colors.length - 1];
  };
  const sideHex = filamentSideColor(sideCfg.colors[0]);
  const sideTranslucent = isTranslucent(ctrl.sideColorName);

  // Load the FULL artwork (exact design). The board aspect follows the image.
  let artTex = null;
  let artAspect = contentAspect(card);
  if (artworkSrc) {
    const r = await loadArtworkTexture(artworkSrc);
    if (r) {
      artTex = r.tex;
      if (r.w > 0 && r.h > 0) artAspect = r.w / r.h;
    }
  }
  const BW = 6.0;
  const BH = BW / Math.max(0.06, artAspect);

  if (artTex) {
    // FLAT base layer = the whole artwork, shown exactly as designed (unlit so
    // colours match the AI file). Selected objects raise above it in 3D mode.
    const baseMat = new THREE.MeshBasicMaterial({ map: artTex, toneMapped: false });
    const base = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), baseMat);
    base.position.z = 0;
    state.content.add(base);

    // Regions to raise as 3D = the boxes the user dragged on the Dimension
    // Preview (state.regions) plus any selected Letter/Logo records.
    const raiseRects = [];
    (state.regions || []).forEach((r) => raiseRects.push(r));
    objs.forEach((o) => { if (o.selected) raiseRects.push(o.hl); });

    raiseRects.forEach((r) => {
      const pw = Math.max(0.03, r.width * BW);
      const ph = Math.max(0.03, r.height * BH);
      const cx = (r.left + r.width / 2 - 0.5) * BW;
      const cy = (0.5 - (r.top + r.height / 2)) * BH;
      const u0 = r.left;
      const u1 = r.left + r.width;
      const v1 = 1 - r.top;
      const v0 = 1 - (r.top + r.height);

      if (mode3d) {
        // Extrude ONLY the lettering/logo inside the picked box — the board
        // colour is keyed out so the green/coloured base is NOT raised. The
        // text is faked into 3D by stacking alpha-cut layers (front = lit face,
        // back layers = the side-finishing colour) like real channel letters.
        // Prefer the object's connected-component mask (logo lines / letter only,
        // no overlapping text, no green board); fall back to colour-keying a
        // manually-dragged box.
        let keyed;
        if (r.maskCanvas) {
          keyed = new THREE.CanvasTexture(r.maskCanvas);
          keyed.colorSpace = THREE.SRGBColorSpace;
          keyed.anisotropy = 8;
          keyed.needsUpdate = true;
        } else {
          keyed = buildKeyedTexture(artTex.image, u0, u1, v0, v1);
        }
        if (!keyed) return;
        const LAYERS = 14;
        const step = depth / LAYERS;
        for (let l = 0; l < LAYERS; l++) {
          const isFront = l === LAYERS - 1;
          const z = 0.04 + (l + 1) * step;
          let mat;
          if (isFront) {
            if (led.lit) {
              // LED selected -> glowing lit face.
              mat = new THREE.MeshStandardMaterial({ map: keyed, transparent: true, alphaTest: 0.45, roughness: 0.5, metalness: 0.0 });
              mat.emissive = new THREE.Color(led.emissive);
              mat.emissiveMap = keyed;
              mat.emissiveIntensity = 1.25;
              state.litMeshes.push(mat);
            } else {
              // No LED -> crisp, real-colour face (matches the flat board), no glow.
              mat = new THREE.MeshBasicMaterial({ map: keyed, transparent: true, alphaTest: 0.45, toneMapped: false });
            }
          } else {
            const t = l / (LAYERS - 1);
            // l: 0 = back, LAYERS-1 = front face. fromFront = 0 near the face.
            const fromFront = (LAYERS - 1 - l) / (LAYERS - 1);
            const segHex = filamentSideColor(sideColorForFrac(fromFront));
            const shade = new THREE.Color(segHex).multiplyScalar(0.72 + 0.28 * t);
            mat = new THREE.MeshBasicMaterial({
              map: keyed,
              color: shade,
              transparent: true,
              alphaTest: 0.45,
              toneMapped: false,
            });
          }
          const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
          p.position.set(cx, cy, z);
          if (isFront) p.castShadow = true;
          state.content.add(p);
        }
      } else {
        // Flat mode: outline the picked region so the user sees what's selected.
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.PlaneGeometry(pw, ph)),
          new THREE.LineBasicMaterial({ color: 0x35d8ff })
        );
        edges.position.set(cx, cy, 0.02);
        state.content.add(edges);
      }
    });
  } else if (objs.length) {
    // Fallback (no artwork image): assemble from per-object crops, white-keyed.
    const textures = await Promise.all(objs.map((o) => loadTexture(o.src)));
    objs.forEach((o, i) => {
      const tex = textures[i];
      const pw = Math.max(0.03, o.hl.width * BW);
      const ph = Math.max(0.03, o.hl.height * BH);
      const cx = (o.hl.left + o.hl.width / 2 - 0.5) * BW;
      const cy = (0.5 - (o.hl.top + o.hl.height / 2)) * BH;
      const faceMat = new THREE.MeshPhysicalMaterial({ map: tex || null, transparent: true, alphaTest: 0.04, roughness: 0.55, clearcoat: 0.5 });
      if (mode3d && o.selected) {
        if (led.lit) { faceMat.emissive = new THREE.Color(led.emissive); faceMat.emissiveMap = tex || null; faceMat.emissiveIntensity = 1.15; }
        const sideMat = new THREE.MeshPhysicalMaterial({ color: sideHex, metalness: 0.35, roughness: 0.45 });
        const mats = [sideMat, sideMat, sideMat, sideMat, faceMat, new THREE.MeshStandardMaterial({ color: 0x0a0d12 })];
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, depth), mats);
        mesh.position.set(cx, cy, depth / 2);
        mesh.castShadow = true; mesh.userData.recordId = o.id;
        state.content.add(mesh);
        if (led.lit) state.litMeshes.push(faceMat);
      } else {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), faceMat);
        mesh.position.set(cx, cy, 0.03);
        state.content.add(mesh);
      }
    });
  }

  // Bloom whenever letters are raised (they glow); LED sets a stronger bloom.
  // Bloom only when an LED colour is actually selected — otherwise the bright
  // green board would bloom into a haze and look blurry.
  state.bloom.strength = state.litMeshes.length && led.lit ? led.bloom * 0.7 : 0;
  state.rgbAnim = !!led.hueAnim && state.litMeshes.length > 0;
  fitCamera(state);
}

function renderLoop(state) {
  if (!state.running) return;
  state.controls.update();
  if (state.rgbAnim && state.litMeshes.length) {
    state.hue = (state.hue + 0.0025) % 1;
    const col = new THREE.Color().setHSL(state.hue, 1.0, 0.5);
    state.litMeshes.forEach((m) => {
      if (m.emissive) m.emissive.copy(col);
    });
  }
  state.composer.render();
  requestAnimationFrame(() => renderLoop(state));
}

function injectToggle(state) {
  const card = cardOf(state.stage);
  const title = card && card.querySelector(".craft-3d-title");
  if (!title || title.querySelector(".sb-mode-toggle")) return;
  const wrap = document.createElement("div");
  wrap.className = "sb-mode-toggle";
  wrap.style.cssText =
    "display:inline-flex;gap:4px;margin-left:auto;background:rgba(3,15,31,.7);border:1px solid rgba(112,164,255,.34);border-radius:999px;padding:3px;";
  const mk = (label, mode) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.mode = mode;
    b.style.cssText =
      "border:0;border-radius:999px;padding:4px 14px;font:600 12px/1 'Segoe UI',Arial,sans-serif;cursor:pointer;color:#b9c9df;background:transparent;";
    b.addEventListener("click", () => {
      state.mode = mode;
      updateToggleUI(state);
      buildContent(state);
    });
    return b;
  };
  wrap.appendChild(mk("Flat", "flat"));
  wrap.appendChild(mk("3D", "3d"));
  // Clear the dragged 3D selections.
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Clear";
  clear.style.cssText =
    "border:0;border-radius:999px;padding:4px 12px;font:600 12px/1 'Segoe UI',Arial,sans-serif;cursor:pointer;color:#b9c9df;background:transparent;";
  clear.addEventListener("click", () => {
    state.regions = [];
    drawRegionOverlays(state);
    buildContent(state);
  });
  wrap.appendChild(clear);
  // place before the "Live Preview" label if present, else append
  title.appendChild(wrap);
  state.toggle = wrap;
  updateToggleUI(state);
}

function updateToggleUI(state) {
  if (!state.toggle) return;
  state.toggle.querySelectorAll("button").forEach((b) => {
    const on = b.dataset.mode === state.mode;
    b.style.background = on ? "linear-gradient(100deg,#244bff,#08d3e7)" : "transparent";
    b.style.color = on ? "#ffffff" : "#b9c9df";
  });
}

function wireViewButtons(state) {
  const card = cardOf(state.stage);
  if (!card) return;
  card.querySelectorAll(".craft-view-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentView = btn.dataset.view || "front";
      fitCamera(state);
      card.querySelectorAll(".craft-view-card").forEach((b) =>
        b.classList.toggle("is-active", b === btn)
      );
    });
  });
}

function wireSelection(state) {
  const card = cardOf(state.stage);
  const list = card && card.querySelector(".letter-dimension-list");
  if (!list) return;
  // Rebuild after the app's own selection handler has toggled .is-selected.
  list.addEventListener("click", () => {
    window.setTimeout(() => buildContent(state), 0);
  });
}

// The signboard swaps the Dimension Preview image for the clean full-artboard
// artwork (see swapDimensionPreview), which has no annotation margins — so drag
// coordinates map directly to the artwork with zero margins.
const PREVIEW_MARGIN = { left: 0, top: 0, right: 0, bottom: 0 };

// Map a client point over the dimension-preview image to a fraction (0..1) of
// the artwork content box (same space as data-highlight / the artwork texture).
function previewPointToFraction(img, clientX, clientY) {
  const ib = img.getBoundingClientRect();
  const nx = ((clientX - ib.left) / ib.width) * img.naturalWidth;
  const ny = ((clientY - ib.top) / ib.height) * img.naturalHeight;
  const cw = img.naturalWidth - PREVIEW_MARGIN.left - PREVIEW_MARGIN.right;
  const ch = img.naturalHeight - PREVIEW_MARGIN.top - PREVIEW_MARGIN.bottom;
  return {
    fx: (nx - PREVIEW_MARGIN.left) / Math.max(1, cw),
    fy: (ny - PREVIEW_MARGIN.top) / Math.max(1, ch),
  };
}

// Persistent cyan boxes over the preview showing what was picked.
function drawRegionOverlays(state) {
  const ov = state.regionOverlay;
  if (!ov) return;
  ov.querySelectorAll(".sb-region-box").forEach((b) => b.remove());
  const card = cardOf(state.stage);
  const previewBox = card && card.querySelector(".dimension-preview");
  const img = previewBox && previewBox.querySelector("img");
  if (!img || !img.naturalWidth) return;
  const ib = img.getBoundingClientRect();
  const ob = previewBox.getBoundingClientRect();
  const cwN = img.naturalWidth - PREVIEW_MARGIN.left - PREVIEW_MARGIN.right;
  const chN = img.naturalHeight - PREVIEW_MARGIN.top - PREVIEW_MARGIN.bottom;
  const cLeft = ib.left + (PREVIEW_MARGIN.left / img.naturalWidth) * ib.width;
  const cTop = ib.top + (PREVIEW_MARGIN.top / img.naturalHeight) * ib.height;
  const cW = (cwN / img.naturalWidth) * ib.width;
  const cH = (chN / img.naturalHeight) * ib.height;
  (state.regions || []).forEach((r) => {
    const box = document.createElement("div");
    box.className = "sb-region-box";
    box.style.cssText =
      "position:absolute;border:2px solid #35d8ff;background:rgba(53,216,255,.16);pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.4);";
    box.style.left = cLeft + r.left * cW - ob.left + "px";
    box.style.top = cTop + r.top * cH - ob.top + "px";
    box.style.width = r.width * cW + "px";
    box.style.height = r.height * cH + "px";
    ov.appendChild(box);
  });
}

// Replace the (content-cropped, annotated) Dimension Preview image with the
// clean FULL artboard artwork so the user sees the complete uploaded file.
function swapDimensionPreview(stage, artworkSrc) {
  if (!artworkSrc) return;
  const card = cardOf(stage);
  const img = card && card.querySelector(".dimension-preview img");
  if (!img) return;
  img.removeAttribute("data-src");
  img.classList.remove("delayed-preview");
  img.src = artworkSrc;
  img.style.objectFit = "contain";
}

// Drag a rectangle on the Dimension Preview to mark what becomes 3D.
function wireRegionSelect(state) {
  const card = cardOf(state.stage);
  const previewBox = card && card.querySelector(".dimension-preview");
  const img = previewBox && previewBox.querySelector("img");
  if (!previewBox || !img) return;

  if (getComputedStyle(previewBox).position === "static") previewBox.style.position = "relative";
  // Keep the zoom button clickable above the drag overlay.
  const zoom = previewBox.querySelector(".dimension-zoom-button");
  if (zoom) zoom.style.zIndex = "10";

  const overlay = document.createElement("div");
  overlay.className = "sb-region-overlay";
  overlay.style.cssText = "position:absolute;inset:0;cursor:crosshair;z-index:5;touch-action:none;";
  overlay.title = "Drag to select the part to make 3D";
  previewBox.appendChild(overlay);
  state.regionOverlay = overlay;

  let dragging = false;
  let sx = 0;
  let sy = 0;
  let rectEl = null;

  overlay.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    rectEl = document.createElement("div");
    rectEl.style.cssText =
      "position:fixed;border:2px solid #35d8ff;background:rgba(53,216,255,.2);z-index:99999;pointer-events:none;";
    document.body.appendChild(rectEl);
    try { overlay.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  overlay.addEventListener("pointermove", (e) => {
    if (!dragging || !rectEl) return;
    const x = Math.min(sx, e.clientX);
    const y = Math.min(sy, e.clientY);
    rectEl.style.left = x + "px";
    rectEl.style.top = y + "px";
    rectEl.style.width = Math.abs(e.clientX - sx) + "px";
    rectEl.style.height = Math.abs(e.clientY - sy) + "px";
  });
  const finish = (e) => {
    if (!dragging) return;
    dragging = false;
    if (rectEl) { rectEl.remove(); rectEl = null; }
    const a = previewPointToFraction(img, sx, sy);
    const b = previewPointToFraction(img, e.clientX, e.clientY);
    const clamp = (v) => Math.max(0, Math.min(1, v));
    const left = clamp(Math.min(a.fx, b.fx));
    const top = clamp(Math.min(a.fy, b.fy));
    const right = clamp(Math.max(a.fx, b.fx));
    const bottom = clamp(Math.max(a.fy, b.fy));
    const w = right - left;
    const h = bottom - top;
    if (w < 0.012 || h < 0.012) return; // ignore stray clicks
    state.regions.push({ left, top, width: w, height: h });
    drawRegionOverlays(state);
    // Jump to 3D so the picked part immediately shows as 3D.
    state.mode = "3d";
    updateToggleUI(state);
    buildContent(state);
  };
  overlay.addEventListener("pointerup", finish);
  overlay.addEventListener("pointercancel", () => {
    dragging = false;
    if (rectEl) { rectEl.remove(); rectEl = null; }
  });
}

async function createScene(stage) {
  if (scenes.has(stage)) return scenes.get(stage);
  const canvas = stage.querySelector(".craft-three-canvas");
  if (!canvas) return null;
  stage.classList.add("has-three");

  const { width, height } = stageSize(stage);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = null;
  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;

  const camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 400);
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  // Higher threshold so only bright lit text blooms (not the board) -> crisp.
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0, 0.4, 0.6);
  composer.addPass(bloom);

  const controls = new OrbitControls(camera, stage);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 4.5;
  controls.maxDistance = 40;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: null, RIGHT: null };
  stage.addEventListener(
    "pointerdown",
    (e) => {
      controls.enabled = e.button === 0;
    },
    true
  );
  window.addEventListener("pointerup", () => {
    controls.enabled = false;
  });

  // Lighting (mirrors the box-up studio setup).
  const softLeft = new THREE.RectAreaLight(0xffffff, 4.0, 9, 5);
  softLeft.position.set(-4, 4.2, 5.4);
  softLeft.lookAt(0, 0, 0);
  scene.add(softLeft);
  const key = new THREE.DirectionalLight(0xffffff, 5.6);
  key.position.set(-3.4, 5.2, 7.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.bias = -0.0002;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf4f8ff, 4.2);
  rim.position.set(6, 3.5, -5.5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x111316, 0.35));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 28),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.5 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.2;
  floor.receiveShadow = true;
  scene.add(floor);

  const content = new THREE.Group();
  scene.add(content);

  const state = {
    stage,
    renderer,
    composer,
    bloom,
    scene,
    camera,
    controls,
    content,
    running: true,
    mode: "flat",
    currentView: "front",
    litMeshes: [],
    hue: 0,
    rgbAnim: false,
    objectCount: 0,
    regions: [],
  };
  scenes.set(stage, state);

  injectToggle(state);
  wireViewButtons(state);
  wireSelection(state);
  wireRegionSelect(state);

  // Show the actual file/artboard size (not the trimmed content bbox).
  const previewEl = stage.closest(".craft-3d-preview");
  const pageSize = previewEl && previewEl.getAttribute("data-page-size");
  if (pageSize) {
    const sizeCard = cardOf(stage);
    const totalEl = sizeCard && sizeCard.querySelector(".preview-total strong");
    if (totalEl) totalEl.textContent = pageSize;
  }
  // Show the full uploaded artboard in the Dimension Preview (not the crop).
  swapDimensionPreview(stage, previewEl && previewEl.getAttribute("data-artwork-src"));
  // Drop the bogus single "Letter 1" record — records come from selections.
  clearSignboardRecords(state);

  // default the view strip to "front"
  const card = cardOf(stage);
  if (card) {
    card.querySelectorAll(".craft-view-card").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.view === "front")
    );
  }

  // resize handling
  const ro = new ResizeObserver(() => {
    const s = stageSize(stage);
    camera.aspect = s.width / s.height;
    camera.updateProjectionMatrix();
    renderer.setSize(s.width, s.height, false);
    composer.setSize(s.width, s.height);
  });
  ro.observe(stage);

  await buildContent(state);
  const loader = stage.querySelector(".craft-three-loading");
  if (loader) loader.remove();
  renderLoop(state);
  return state;
}

// ===== Selection modal: pick logo/text on the full artwork -> 3D 发光字 =======
let activeState = null;
let selModal = null;

// Auto-detect individual WORDS / logo inside the artwork (even on a solid-colour
// board): estimate the board colour from the border, build a foreground mask,
// find connected components (each letter/shape), then merge components that sit
// on the same line within a small gap into a word. Returns one tight box per
// word/logo as fractions {left,top,width,height} of the image.
function detectObjects(image) {
  if (!image || !image.naturalWidth) return [];
  const sc = Math.min(1, 760 / image.naturalWidth);
  const w = Math.max(1, Math.round(image.naturalWidth * sc));
  const h = Math.max(1, Math.round(image.naturalHeight * sc));
  const cnv = document.createElement("canvas");
  cnv.width = w;
  cnv.height = h;
  const ctx = cnv.getContext("2d");
  ctx.drawImage(image, 0, 0, w, h);
  let d;
  try { d = ctx.getImageData(0, 0, w, h).data; } catch (e) { return []; }
  let br = 0, bg = 0, bb = 0, n = 0;
  const at = (px, py) => { const i = (py * w + px) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const sx = Math.max(1, (w / 60) | 0);
  const sy = Math.max(1, (h / 30) | 0);
  for (let px = 0; px < w; px += sx) { const a = at(px, 0), b = at(px, h - 1); br += a[0] + b[0]; bg += a[1] + b[1]; bb += a[2] + b[2]; n += 2; }
  for (let py = 0; py < h; py += sy) { const a = at(0, py), b = at(w - 1, py); br += a[0] + b[0]; bg += a[1] + b[1]; bb += a[2] + b[2]; n += 2; }
  br /= n; bg /= n; bb /= n;
  const thr2 = 66 * 66;
  const fg = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb;
    fg[p] = dr * dr + dg * dg + db * db > thr2 ? 1 : 0;
  }
  // connected components (4-connectivity = stricter, so things that only touch
  // diagonally — e.g. a logo and the text line above it — stay separate).
  const label = new Int32Array(w * h);
  const comps = [];
  const stack = [];
  let next = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!fg[p] || label[p]) continue;
      let x0 = x, y0 = y, x1 = x, y1 = y, area = 0;
      label[p] = next;
      stack.length = 0;
      stack.push(p);
      while (stack.length) {
        const q = stack.pop();
        const qy = (q / w) | 0;
        const qx = q - qy * w;
        area++;
        if (qx < x0) x0 = qx; if (qx > x1) x1 = qx;
        if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
        if (qx > 0 && fg[q - 1] && !label[q - 1]) { label[q - 1] = next; stack.push(q - 1); }
        if (qx < w - 1 && fg[q + 1] && !label[q + 1]) { label[q + 1] = next; stack.push(q + 1); }
        if (qy > 0 && fg[q - w] && !label[q - w]) { label[q - w] = next; stack.push(q - w); }
        if (qy < h - 1 && fg[q + w] && !label[q + w]) { label[q + w] = next; stack.push(q + w); }
      }
      comps.push({ x0, y0, x1, y1, area, cw: x1 - x0 + 1, ch: y1 - y0 + 1, lbl: next });
      next++;
    }
  }
  // drop noise and the whole-board blob
  const minArea = Math.max(8, w * h * 0.00012);
  let parts = comps.filter((c) => c.area >= minArea && c.cw < w * 0.97 && c.ch < h * 0.92 && c.cw >= 2 && c.ch >= 4);
  if (!parts.length) return [];
  // Each connected component = one selectable object. Build, per component, a
  // MASK canvas (its real-colour pixels only, transparent elsewhere) for the 3D
  // + thumbnail, a cyan SHAPE for the highlight, and a boolean grid for precise
  // hit-testing — so selecting the logo follows its outline and never grabs the
  // overlapping text inside its bounding box.
  return parts.map((c) => {
    const padX = Math.round(c.cw * 0.05) + 1;
    const padY = Math.round(c.ch * 0.06) + 1;
    const bx0 = Math.max(0, c.x0 - padX), by0 = Math.max(0, c.y0 - padY);
    const bx1 = Math.min(w - 1, c.x1 + padX), by1 = Math.min(h - 1, c.y1 + padY);
    const mw = bx1 - bx0 + 1, mh = by1 - by0 + 1;
    const maskCv = document.createElement("canvas"); maskCv.width = mw; maskCv.height = mh;
    const dispCv = document.createElement("canvas"); dispCv.width = mw; dispCv.height = mh;
    const mctx = maskCv.getContext("2d"), dctx = dispCv.getContext("2d");
    const mImg = mctx.createImageData(mw, mh), dImg = dctx.createImageData(mw, mh);
    const md = mImg.data, dd = dImg.data;
    const grid = new Uint8Array(mw * mh);
    for (let yy = 0; yy < mh; yy++) {
      for (let xx = 0; xx < mw; xx++) {
        const pi = (by0 + yy) * w + (bx0 + xx);
        const li = (yy * mw + xx) * 4;
        if (label[pi] === c.lbl) {
          const di = pi * 4;
          md[li] = d[di]; md[li + 1] = d[di + 1]; md[li + 2] = d[di + 2]; md[li + 3] = 255;
          dd[li] = 53; dd[li + 1] = 216; dd[li + 2] = 255; dd[li + 3] = 255;
          grid[yy * mw + xx] = 1;
        }
      }
    }
    mctx.putImageData(mImg, 0, 0);
    dctx.putImageData(dImg, 0, 0);
    return {
      left: bx0 / w, top: by0 / h, width: mw / w, height: mh / h,
      maskCanvas: maskCv, dispUrl: dispCv.toDataURL("image/png"),
      mw, mh, mask: grid,
    };
  });
}

function buildSelectModal() {
  if (selModal) return selModal;
  const root = document.createElement("div");
  root.className = "sb-select-modal";
  root.style.cssText =
    "position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;background:rgba(2,7,16,.84);backdrop-filter:blur(4px);";
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:relative;max-width:1160px;background:#08152b;border:1px solid rgba(63,176,255,.6);border-radius:14px;padding:14px;box-shadow:0 0 40px rgba(53,216,255,.25);display:flex;flex-direction:column;gap:12px;";
  const bar = document.createElement("div");
  bar.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;";
  bar.innerHTML =
    '<strong style="color:#eaf3ff;font-size:13.5px;">Click a letter / logo box to select it, or drag a box across several — then apply 3D illuminated letters</strong><span style="flex:1"></span>';
  const mkBtn = (label, act, css) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.act = act;
    b.textContent = label;
    b.style.cssText = css;
    return b;
  };
  bar.appendChild(mkBtn("Apply 3D 发光字", "apply", "border:0;border-radius:9px;padding:9px 16px;font:700 13px/1 'Segoe UI',Arial;cursor:pointer;color:#fff;background:linear-gradient(100deg,#244bff,#08d3e7);"));
  bar.appendChild(mkBtn("Clear", "clear", "border:1px solid rgba(112,164,255,.34);border-radius:9px;padding:9px 14px;font:600 13px/1 'Segoe UI',Arial;cursor:pointer;color:#b9c9df;background:transparent;"));
  bar.appendChild(mkBtn("✕", "close", "border:1px solid rgba(112,164,255,.34);border-radius:9px;width:36px;height:36px;cursor:pointer;color:#cfe0f5;background:transparent;"));
  const stageEl = document.createElement("div");
  stageEl.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center;background:#02060f;border-radius:10px;padding:8px;";
  const img = document.createElement("img");
  img.alt = "Artwork";
  // max size is set in px by sync() (vw/vh are unreliable inside the iframe).
  img.style.cssText = "display:block;border-radius:6px;";
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;cursor:crosshair;touch-action:none;";
  stageEl.appendChild(img);
  stageEl.appendChild(overlay);
  panel.appendChild(bar);
  panel.appendChild(stageEl);
  root.appendChild(panel);
  document.body.appendChild(root);
  selModal = { root, stageEl, img, overlay };

  const eqRect = (a, b) => Math.abs(a.left - b.left) < 0.006 && Math.abs(a.top - b.top) < 0.006 && Math.abs(a.width - b.width) < 0.006 && Math.abs(a.height - b.height) < 0.006;
  const redrawBoxes = () => {
    overlay.querySelectorAll(".sb-sel-box").forEach((b) => b.remove());
    if (!activeState) return;
    const w = overlay.clientWidth;
    const h = overlay.clientHeight;
    (activeState.regions || []).forEach((r) => {
      // Mask selections show their bright SHAPE (via renderDetected) — don't draw
      // the bounding-box rectangle, which would visually reach neighbouring text.
      if (r.maskCanvas) return;
      const d = document.createElement("div");
      d.className = "sb-sel-box";
      d.style.cssText = "position:absolute;border:2px solid #35d8ff;background:rgba(53,216,255,.16);pointer-events:none;box-shadow:0 0 0 1px rgba(0,0,0,.45);";
      d.style.left = r.left * w + "px";
      d.style.top = r.top * h + "px";
      d.style.width = r.width * w + "px";
      d.style.height = r.height * h + "px";
      overlay.appendChild(d);
    });
  };
  // Clickable frames for each auto-detected object.
  const renderDetected = () => {
    overlay.querySelectorAll(".sb-detected").forEach((b) => b.remove());
    if (!activeState) return;
    const w = overlay.clientWidth;
    const h = overlay.clientHeight;
    (selModal.detected || []).forEach((r) => {
      const sel = (activeState.regions || []).some((g) => eqRect(g, r));
      // Show the component's actual SHAPE (cyan silhouette), not a rectangle.
      const d = document.createElement("img");
      d.className = "sb-detected" + (sel ? " is-sel" : "");
      d.src = r.dispUrl;
      d.style.cssText =
        "position:absolute;pointer-events:none;image-rendering:auto;opacity:" +
        (sel ? "0.9" : "0.3") + ";" + (sel ? "filter:drop-shadow(0 0 2px #35d8ff);" : "");
      d.style.left = r.left * w + "px";
      d.style.top = r.top * h + "px";
      d.style.width = r.width * w + "px";
      d.style.height = r.height * h + "px";
      overlay.appendChild(d);
    });
  };
  const sync = () => {
    const availW = root.clientWidth || 900;
    const availH = root.clientHeight || 600;
    img.style.maxWidth = Math.max(120, Math.min(availW * 0.9, 1100)) + "px";
    img.style.maxHeight = Math.max(120, availH - 120) + "px";
    const ir = img.getBoundingClientRect();
    const sr = stageEl.getBoundingClientRect();
    overlay.style.left = ir.left - sr.left + "px";
    overlay.style.top = ir.top - sr.top + "px";
    overlay.style.width = ir.width + "px";
    overlay.style.height = ir.height + "px";
    redrawBoxes();
    renderDetected();
  };
  selModal.sync = sync;
  selModal.redrawBoxes = redrawBoxes;
  selModal.renderDetected = renderDetected;
  img.addEventListener("load", sync);
  window.addEventListener("resize", () => {
    if (root.style.display !== "none") sync();
  });

  // Drag = marquee that SELECTS the detected boxes it touches (a stray drag that
  // hits nothing leaves no box behind). A plain click toggles the box under it.
  let down = false;
  let sx = 0;
  let sy = 0;
  let marquee = null;
  overlay.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const or = overlay.getBoundingClientRect();
    down = true;
    sx = e.clientX - or.left;
    sy = e.clientY - or.top;
    marquee = null;
    try { overlay.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });
  overlay.addEventListener("pointermove", (e) => {
    if (!down) return;
    const or = overlay.getBoundingClientRect();
    const cx = e.clientX - or.left;
    const cy = e.clientY - or.top;
    if (!marquee && (Math.abs(cx - sx) > 4 || Math.abs(cy - sy) > 4)) {
      marquee = document.createElement("div");
      marquee.style.cssText = "position:absolute;border:1.5px dashed #35d8ff;background:rgba(53,216,255,.1);pointer-events:none;border-radius:2px;";
      overlay.appendChild(marquee);
    }
    if (marquee) {
      marquee.style.left = Math.min(sx, cx) + "px";
      marquee.style.top = Math.min(sy, cy) + "px";
      marquee.style.width = Math.abs(cx - sx) + "px";
      marquee.style.height = Math.abs(cy - sy) + "px";
    }
  });
  overlay.addEventListener("pointerup", (e) => {
    if (!down) return;
    down = false;
    const wasMarquee = !!marquee;
    if (marquee) { marquee.remove(); marquee = null; }
    const or = overlay.getBoundingClientRect();
    const w = or.width, h = or.height;
    if (!activeState || w <= 0 || h <= 0) return;
    const cx = e.clientX - or.left, cy = e.clientY - or.top;
    const det = selModal.detected || [];
    const has = (r) => (activeState.regions || []).some((g) => eqRect(g, r));
    const regionOf = (o) => ({ left: o.left, top: o.top, width: o.width, height: o.height, maskCanvas: o.maskCanvas });
    // does object o have any of its OWN pixels inside the fraction rect [L,R]x[T,B]?
    const maskInRect = (o, L, T, R, B) => {
      const step = Math.max(1, Math.floor(o.mw / 30));
      for (let ly = 0; ly < o.mh; ly += step) {
        for (let lx = 0; lx < o.mw; lx += step) {
          if (!o.mask[ly * o.mw + lx]) continue;
          const gx = o.left + (lx / o.mw) * o.width;
          const gy = o.top + (ly / o.mh) * o.height;
          if (gx >= L && gx <= R && gy >= T && gy <= B) return true;
        }
      }
      return false;
    };
    if (wasMarquee) {
      // select objects whose OWN shape (not just bounding box) is in the rectangle
      const L = Math.min(sx, cx) / w, T = Math.min(sy, cy) / h, R = Math.max(sx, cx) / w, B = Math.max(sy, cy) / h;
      det.forEach((o) => { if (maskInRect(o, L, T, R, B) && !has(o)) activeState.regions.push(regionOf(o)); });
    } else {
      // click: toggle the object whose SHAPE is under the point (smallest)
      const fx = cx / w, fy = cy / h;
      let pick = null, pickArea = Infinity;
      det.forEach((o) => {
        if (fx < o.left || fx > o.left + o.width || fy < o.top || fy > o.top + o.height) return;
        const lx = Math.floor((fx - o.left) / o.width * o.mw);
        const ly = Math.floor((fy - o.top) / o.height * o.mh);
        if (lx < 0 || ly < 0 || lx >= o.mw || ly >= o.mh || !o.mask[ly * o.mw + lx]) return;
        const a = o.width * o.height;
        if (a < pickArea) { pick = o; pickArea = a; }
      });
      if (pick) {
        const i = (activeState.regions || []).findIndex((g) => eqRect(g, pick));
        if (i >= 0) activeState.regions.splice(i, 1);
        else activeState.regions.push(regionOf(pick));
      }
    }
    redrawBoxes();
    renderDetected();
  });

  root.addEventListener("click", (e) => {
    if (e.target === root) { closeSelectModal(); return; }
    const act = e.target.closest("[data-act]") && e.target.closest("[data-act]").dataset.act;
    if (!act) return;
    if (act === "close") closeSelectModal();
    else if (act === "clear") { if (activeState) { activeState.regions = []; redrawBoxes(); } }
    else if (act === "apply") applySelection();
  });
  return selModal;
}

// Position the fixed modal over the parent's VISIBLE viewport (the app runs in a
// content-sized iframe, so plain position:fixed would size to the tall iframe).
// Mirrors box-up's placeModalInViewport.
function placeSelectModal(root) {
  try {
    if (window.parent && window.parent !== window && window.frameElement) {
      const iframeTop = window.frameElement.getBoundingClientRect().top + window.parent.scrollY;
      const visTop = window.parent.scrollY - iframeTop;
      root.style.position = "absolute";
      root.style.inset = "auto";
      root.style.left = "0";
      root.style.width = "100%";
      root.style.top = Math.max(0, visTop) + "px";
      root.style.height = window.parent.innerHeight + "px";
      return;
    }
  } catch (e) {}
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.left = "";
  root.style.width = "";
  root.style.top = "";
  root.style.height = "";
}

function setParentScrollLockSB(locked) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.document.documentElement.style.overflow = locked ? "hidden" : "";
      window.parent.document.body.style.overflow = locked ? "hidden" : "";
    }
  } catch (e) {}
}

function openSelectModal(state, card) {
  activeState = state;
  const m = buildSelectModal();
  const src = card.querySelector(".craft-3d-preview") && card.querySelector(".craft-3d-preview").getAttribute("data-artwork-src");
  if (src && m.img.src !== src) m.img.src = src;
  m.root.style.display = "flex";
  placeSelectModal(m.root);
  setParentScrollLockSB(true);
  // Auto-detect the objects once the artwork is available, then size + render.
  const runDetect = () => {
    try { m.detected = detectObjects(m.img); } catch (e) { m.detected = []; }
    m.sync();
  };
  if (m.img.complete && m.img.naturalWidth) runDetect();
  m.img.onload = runDetect;
  // The modal also needs a layout pass before the overlay can be sized.
  requestAnimationFrame(() => m.sync());
  window.setTimeout(() => m.sync(), 120);
  window.setTimeout(() => m.sync(), 300);
}

function closeSelectModal() {
  if (selModal) selModal.root.style.display = "none";
  setParentScrollLockSB(false);
}

function applySelection() {
  if (activeState) {
    activeState.mode = "3d";
    updateToggleUI(activeState);
    drawRegionOverlays(activeState);
    updateRecordsFromSelection(activeState);
    buildContent(activeState).catch(() => {});
  }
  closeSelectModal();
}

// The signboard analyzer only finds one bogus "Letter 1" record (the whole
// image). Clear it — records come from what the user actually selects.
function clearSignboardRecords(state) {
  const card = cardOf(state.stage);
  const panel = card && card.querySelector(".letter-dimensions");
  if (!panel) return;
  const list = panel.querySelector(".letter-dimension-list");
  const countEl = panel.querySelector(".record-count");
  if (list) list.innerHTML = '<div class="sb-records-empty" style="padding:18px 12px;color:#7e93ad;font-size:13px;text-align:center;line-height:1.5;">Click the Dimension Preview, then pick the letters / logo to add them here.</div>';
  if (countEl) countEl.textContent = "0";
}

// Build a Letter / Logo record per selected region (thumbnail + size + price).
function updateRecordsFromSelection(state) {
  const card = cardOf(state.stage);
  const panel = card && card.querySelector(".letter-dimensions");
  if (!panel) return;
  const list = panel.querySelector(".letter-dimension-list");
  const countEl = panel.querySelector(".record-count");
  if (!list) return;
  const regions = state.regions || [];
  if (!regions.length) { clearSignboardRecords(state); return; }
  const previewEl = state.stage.closest(".craft-3d-preview");
  const psize = previewEl && previewEl.getAttribute("data-page-size");
  let pwIn = 0, phIn = 0;
  if (psize) { const m = psize.match(/([0-9.]+) in x ([0-9.]+) in/i); if (m) { pwIn = parseFloat(m[1]); phIn = parseFloat(m[2]); } }
  const img = selModal && selModal.img;
  const money = (v) => "RM " + v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const html = regions.map((r, i) => {
    let thumb = "";
    if (r.maskCanvas) {
      // only the letter/logo pixels (transparent background)
      try { thumb = r.maskCanvas.toDataURL("image/png"); } catch (e) {}
    } else if (img && img.naturalWidth) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const sx = Math.max(0, Math.round(r.left * iw)), sy = Math.max(0, Math.round(r.top * ih));
      const sw = Math.max(1, Math.round(r.width * iw)), sh = Math.max(1, Math.round(r.height * ih));
      const tw = Math.max(1, Math.min(150, sw));
      const th = Math.max(1, Math.round(sh * (tw / sw)));
      const cv = document.createElement("canvas");
      cv.width = tw; cv.height = th;
      const ctx = cv.getContext("2d");
      try { ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th); thumb = cv.toDataURL("image/png"); } catch (e) {}
    }
    const wIn = r.width * pwIn, hIn = r.height * phIn;
    const price = Math.max(30, wIn * hIn * 0.5);
    const hl = JSON.stringify({ left: r.left, top: r.top, width: r.width, height: r.height });
    return '<div class="letter-dimension-item" data-record-id="record-' + i + '" data-highlight=\'' + hl + '\'>'
      + '<span class="letter-item-preview">' + (thumb ? '<img src="' + thumb + '" alt="">' : '') + '<strong>Letter ' + (i + 1) + '</strong></span>'
      + '<span class="letter-dimension-size"><span>' + wIn.toFixed(2) + ' in x ' + hIn.toFixed(2) + ' in</span>'
      + '<strong class="letter-item-price">' + money(price) + '</strong></span></div>';
  }).join("");
  list.innerHTML = html;
  if (countEl) countEl.textContent = String(regions.length);
}

// ---- Public entry points (override the box-up ones) -------------------------
function initAll() {
  document.querySelectorAll(".craft-3d-stage").forEach((stage) => {
    createScene(stage).catch((err) => {
      console.error("Signboard 3D init failed", err);
      stage.classList.remove("has-three");
      const loader = stage.querySelector(".craft-three-loading");
      if (loader) loader.textContent = "3D renderer failed to load";
    });
  });
}

function updatePreview(panel) {
  if (!panel) return;
  const stage = panel.querySelector(".craft-3d-stage");
  if (!stage) return;
  const state = scenes.get(stage);
  if (!state) {
    initAll();
    return;
  }
  buildContent(state).catch((err) => console.error("Signboard 3D update failed", err));
}

if (window.__SIGNBOARD_MODE__) {
  // The inline box-up module uses a top-level `await`, so this module's body can
  // run while it is suspended — and then the inline module resumes and would
  // overwrite our overrides. Lock them as accessors with a no-op setter so the
  // inline module's later `window.x = ...` assignments are ignored.
  const lock = (name, fn) => {
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => fn,
        set: () => {},
      });
    } catch (e) {
      window[name] = fn;
    }
  };
  lock("initCraftThreePreviews", initAll);
  lock("updateCraftThreePreview", updatePreview);
  lock("updateCraftLedFace", updatePreview);

  // Intercept the Dimension Preview magnifier (capture phase, before box-up's
  // own window-level handler) and open OUR selection modal instead, so the user
  // can drag-pick the logo/text on the full artwork and make them 3D 发光字.
  document.addEventListener(
    "click",
    (e) => {
      // Any click inside the Dimension Preview (image OR magnifier) opens OUR
      // selection modal instead of box-up's single-record modal.
      const trigger = e.target.closest && e.target.closest(".dimension-preview");
      if (!trigger) return;
      const card = trigger.closest(".result, .design-card");
      if (!card) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const stage = card.querySelector(".craft-3d-stage");
      if (!stage) return;
      const existing = scenes.get(stage);
      if (existing) openSelectModal(existing, card);
      else createScene(stage).then((s) => { if (s) openSelectModal(s, card); }).catch(() => {});
    },
    true
  );

  // If a result was already rendered before this module finished loading.
  if (document.querySelector(".craft-3d-stage")) initAll();
}
