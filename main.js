/* ============================================================
   Bappy — Hero Section & Interactive 3D Phone Experience
   - High-fidelity Three.js 3D iPhone 17 Pro Max with Orange Titanium finish
   - Synchronized preloader (3D model + background video)
   - Apple-style entrance swoop & slow-motion spin
   - Geometric center pivot rotation (Zero wobble)
   - Interactive cursor parallax when outside the phone
   - Direct mouse grab & 3D orbital rotation with inertia
   - Smart auto-return to default rest position after idle delay
   - Liquid glass wordmark dynamic reflection
   - 0.5px Orange titanium neon cursor trail
   - Eased inertia scrolling & adaptive navbar
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ---------- DOM elements --------------------------------- */
const preloaderEl     = document.getElementById('preloader');
const preloaderNum    = document.getElementById('preloader-num');
const preloaderBar    = document.getElementById('preloader-bar');
const preloaderStatus = document.getElementById('preloader-status');

const heroEl      = document.querySelector('.hero');
const phoneCanvas = document.getElementById('phone-canvas');
const wordmark    = document.getElementById('wordmark');
const burger      = document.getElementById('burger');
const menu        = document.getElementById('menu');
const navEl       = document.getElementById('nav');
const bgVideo     = document.getElementById('video-back');

let isPreloaded = false;
let menuOpen = false;

const pointer = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  tx: window.innerWidth / 2,
  ty: window.innerHeight / 2,
  nx: 0, // normalized -1 to 1
  ny: 0,
};
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Organic Stepped Progress Engine ---------------- */
let modelLoaded = false;
let currentPct = 0;
let realProgressPct = 25;

let lastStepTime = performance.now();
let stepDelay = 45; // ms before next tick

function updatePreloaderUI(pct) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  if (preloaderNum) preloaderNum.textContent = `${p}`;
  if (preloaderBar) preloaderBar.style.transform = `scaleX(${p / 100})`;
}

// Organic progressive ticker with momentum, micro-stepping & natural pauses
function runSteppedTicker() {
  if (isPreloaded) return;

  const now = performance.now();
  if (now - lastStepTime < stepDelay) {
    requestAnimationFrame(runSteppedTicker);
    return;
  }
  lastStepTime = now;

  if (modelLoaded && phoneMeshGroup) {
    // 3D Model is 100% parsed & in scene -> hit 100% and slide up
    currentPct = 100;
    updatePreloaderUI(100);
    setTimeout(triggerPreloaderExit, 220);
    return;
  }

  // Behind real progress -> catch up with momentum steps (capped at 96 until model is ready)
  const targetPct = modelLoaded ? 100 : Math.min(96, realProgressPct);
  if (currentPct < targetPct) {
    const diff = targetPct - currentPct;
    if (diff > 16) {
      // Big gap -> rapid lively momentum jumps (e.g. 35 -> 46 -> 60 -> 71 -> 75)
      const jump = Math.floor(Math.random() * 4) + Math.ceil(diff * 0.28);
      currentPct = Math.min(targetPct, currentPct + jump);
      stepDelay = Math.floor(Math.random() * 30) + 35; // 35-65ms fast cadence
    } else if (diff > 3) {
      // Moderate gap -> steady stepped rhythm (e.g. 5, 8, 12, 17, 21, 25)
      const jump = Math.floor(Math.random() * 3) + 2;
      currentPct = Math.min(targetPct, currentPct + jump);
      stepDelay = Math.floor(Math.random() * 40) + 45; // 45-85ms
    } else {
      // Approaching target -> single step with brief realistic landing pause
      currentPct += 1;
      stepDelay = currentPct === targetPct ? 220 : 60; // pause briefly upon hitting target
    }
  } else if (!modelLoaded) {
    // Waiting for real 3D model GLTF to finish loading -> gently creep forward up to 96%
    if (currentPct < 96) {
      currentPct += 1;
      if (currentPct < 40) {
        stepDelay = Math.floor(Math.random() * 80) + 90; // 90-170ms
      } else if (currentPct < 75) {
        stepDelay = Math.floor(Math.random() * 110) + 120; // 120-230ms
      } else {
        stepDelay = Math.floor(Math.random() * 140) + 150; // 150-290ms
      }
    } else {
      // Hold firmly at 96% until the 3D phone model GLTF is completely in scene
      stepDelay = 120;
    }
  }

  updatePreloaderUI(currentPct);
  requestAnimationFrame(runSteppedTicker);
}

requestAnimationFrame(runSteppedTicker);

function triggerPreloaderExit() {
  if (isPreloaded) return;
  isPreloaded = true;
  updatePreloaderUI(100);

  setTimeout(() => {
    if (preloaderEl) preloaderEl.classList.add('is-done');
    // Start background video playback
    if (bgVideo) bgVideo.play().catch(() => {});
    // Launch the 3D phone swoop & spin entrance animation
    startPhoneEntrance();
  }, 350);
}

// Background video loader tracking
function initVideoTracking() {
  function kickVideo() {
    if (bgVideo) bgVideo.play().catch(() => {});
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kickVideo(); });
  window.addEventListener('pointerdown', kickVideo, { once: true });
}

/* ============================================================
   THREE.JS 3D PHONE EXPERIENCE
   ============================================================ */
let scene, camera, renderer;
let stageGroup, phonePivot, phoneMeshGroup;
let raycaster, mouseNDC;
let isHoveringPhone = false;
let isDragging = false;
let isAutoReturning = false;
let returnStartTime = 0;
let returnDuration = 1200;
let returnStartRot = { x: 0, y: 0, z: 0 };
let returnTimeoutId = null;

// Default rest orientation & position (Top Center X: ~732px, Bottom Center X: ~679px)
const DEFAULT_POS = { x: -0.0045, y: -0.006, z: 0 };
const DEFAULT_ROT = { x: -0.11, y: -0.32, z: -0.05 };

// Intro animation state
let introActive = false;
let introStartTime = 0;
const introDuration = 1600; // ms

// Interactive state
const userRot = { x: 0, y: 0, z: 0 };
const userRotTarget = { x: 0, y: 0, z: 0 };
const dragVelocity = { x: 0, y: 0 };
let lastDragPointer = { x: 0, y: 0 };

const parallaxRot = { x: 0, y: 0 };

/* ---------- Interactive Screen Wireframe / Hi-Fi / Quote Slider Engine ------------ */
let screenMesh = null;
const texLoader = new THREE.TextureLoader();
const texWireframe = texLoader.load('assets/screen-wireframe.png');
const texHifi = texLoader.load('assets/screen-hifi.png');
const texQuoteBad = texLoader.load('assets/quote-bad-ui.png');
const texQuoteGood = texLoader.load('assets/quote-good-ui.png');

// Fix vertical orientation & color spaces for crisp OLED rendering
[texWireframe, texHifi, texQuoteBad, texQuoteGood].forEach((t) => {
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = true;
});

const screenUniforms = {
  uCursorUV: { value: new THREE.Vector2(0.5, 0.5) },
  uMaskRadius: { value: 0.0 },
  uMaskAlpha: { value: 0.0 },
  uRotation: { value: 0.0 },
  uAspect: { value: 1080.0 / 2340.0 },
  uTexWireframe: { value: texWireframe },
  uTexHifi: { value: texHifi },
  uTexQuoteBad: { value: texQuoteBad },
  uTexQuoteGood: { value: texQuoteGood },
  uQuoteMode: { value: 0.0 },     // 0.0 = Hero screen, 1.0 = Quote screen
  uSliderX: { value: 0.0 },       // Default: 0.0 (100% Bad UI/UX shown)
  uSliderAlpha: { value: 0.0 },   // Split line & handle visibility
};

const targetCursorUV = new THREE.Vector2(0.5, 0.5);
const currentCursorUV = new THREE.Vector2(0.5, 0.5);
let targetMaskRadius = 0.0;
let currentMaskRadius = 0.0;
let targetMaskAlpha = 0.0;
let currentMaskAlpha = 0.0;
let targetSliderX = 0.5;          // Persistent slider position (starts centered at 50%)
let currentSliderX = 0.5;
let targetSliderAlpha = 0.0;
let currentSliderAlpha = 0.0;
let isHoveringScreen = false;
let lastScreenTouchTime = 0;
let quoteSliderTimeOffset = 0;

function createScreenMaterial() {
  // Using MeshBasicMaterial so phone screen behaves like a true emissive OLED display
  // with 100% pixel-perfect contrast, razor-sharp text, and zero lighting washout.
  const mat = new THREE.MeshBasicMaterial({
    map: texWireframe,
    color: new THREE.Color(0xffffff),
    toneMapped: false,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCursorUV = screenUniforms.uCursorUV;
    shader.uniforms.uMaskRadius = screenUniforms.uMaskRadius;
    shader.uniforms.uMaskAlpha = screenUniforms.uMaskAlpha;
    shader.uniforms.uRotation = screenUniforms.uRotation;
    shader.uniforms.uAspect = screenUniforms.uAspect;
    shader.uniforms.uTexWireframe = screenUniforms.uTexWireframe;
    shader.uniforms.uTexHifi = screenUniforms.uTexHifi;
    shader.uniforms.uTexQuoteBad = screenUniforms.uTexQuoteBad;
    shader.uniforms.uTexQuoteGood = screenUniforms.uTexQuoteGood;
    shader.uniforms.uQuoteMode = screenUniforms.uQuoteMode;
    shader.uniforms.uSliderX = screenUniforms.uSliderX;
    shader.uniforms.uSliderAlpha = screenUniforms.uSliderAlpha;

    shader.fragmentShader = `
      uniform vec2 uCursorUV;
      uniform float uMaskRadius;
      uniform float uMaskAlpha;
      uniform float uRotation;
      uniform float uAspect;
      uniform sampler2D uTexWireframe;
      uniform sampler2D uTexHifi;
      uniform sampler2D uTexQuoteBad;
      uniform sampler2D uTexQuoteGood;
      uniform float uQuoteMode;
      uniform float uSliderX;
      uniform float uSliderAlpha;
    ` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #ifdef USE_MAP
        // ─── 1. HERO SCREEN MODE: Lo-Fi vs Hi-Fi Rotating Badge ───
        vec4 colWf = texture2D( uTexWireframe, vMapUv );
        colWf.rgb = clamp((colWf.rgb - 0.5) * 1.32 + 0.5, 0.0, 1.0);
        vec4 colHf = texture2D( uTexHifi, vMapUv );

        vec2 relPos = vec2(vMapUv.x - uCursorUV.x, (vMapUv.y - uCursorUV.y) / uAspect);
        float dist = length(relPos);
        float angle = atan(relPos.y, relPos.x) - uRotation;
        float scallop = 1.0 + 0.065 * cos(12.0 * angle);
        float shapeRadius = uMaskRadius * scallop;
        float feather = 0.018;
        float mask = smoothstep(shapeRadius + feather, shapeRadius - feather, dist) * uMaskAlpha;

        vec4 colHero = mix(colWf, colHf, mask);

        float ringWidth = 0.006;
        float ring = smoothstep(shapeRadius + ringWidth + feather, shapeRadius, dist) * 
                     smoothstep(shapeRadius - ringWidth - feather, shapeRadius, dist) * uMaskAlpha;
        vec3 ringColor = mix(vec3(0.21, 0.88, 0.50), vec3(1.0, 0.48, 0.22), vMapUv.y);
        colHero.rgb += ringColor * ring * 1.05;

        // ─── 2. QUOTE SCREEN MODE: Bad UI/UX vs Good UI/UX Persistent Split Slider ───
        vec4 colBad = texture2D( uTexQuoteBad, vMapUv );
        vec4 colGood = texture2D( uTexQuoteGood, vMapUv );

        // Left of slider (< uSliderX) = Good UI/UX, Right of slider (>= uSliderX) = Bad UI/UX
        float splitMask = smoothstep(uSliderX - 0.0015, uSliderX + 0.0015, vMapUv.x);
        vec4 colQuote = mix(colGood, colBad, splitMask);

        // Crisp Cosmic Orange vertical divider line
        float lineDist = abs(vMapUv.x - uSliderX);
        float lineWidth = 0.0028;
        float lineVal = smoothstep(lineWidth + 0.001, lineWidth - 0.0008, lineDist) * uSliderAlpha;
        vec3 orangeColor = vec3(1.0, 0.34, 0.13);

        // Circular slider handle on the divider line
        vec2 handleCenter = vec2(uSliderX, clamp(uCursorUV.y, 0.15, 0.85));
        vec2 handleRel = vec2(vMapUv.x - handleCenter.x, (vMapUv.y - handleCenter.y) / uAspect);
        float handleDist = length(handleRel);
        float handleOuter = smoothstep(0.024, 0.021, handleDist) * uSliderAlpha;
        float handleInner = smoothstep(0.018, 0.015, handleDist) * uSliderAlpha;

        colQuote.rgb = mix(colQuote.rgb, orangeColor, lineVal);
        colQuote.rgb = mix(colQuote.rgb, orangeColor, handleOuter);
        colQuote.rgb = mix(colQuote.rgb, vec3(1.0, 1.0, 1.0), handleInner);

        // ─── 3. SEAMLESS DUAL-MODE BLEND ───
        diffuseColor = mix(colHero, colQuote, uQuoteMode);
      #endif
      `
    );
  };

  return mat;
}

function initThreeScene() {
  if (!phoneCanvas) return;

  const width = phoneCanvas.clientWidth || window.innerWidth;
  const height = phoneCanvas.clientHeight || window.innerHeight;

  // Scene
  scene = new THREE.Scene();

  // Perspective Camera
  camera = new THREE.PerspectiveCamera(38, width / height, 0.05, 50);
  camera.position.set(0, 0, 0.44);

  // High-performance WebGL Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: phoneCanvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Clean natural studio lighting preserving 100% original model colors
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(3.0, 4.0, 4.0);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 1.4);
  fillLight.position.set(-3.0, 2.5, 3.0);
  scene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0xffffff, 1.0);
  backLight.position.set(0, 3.0, -3.0);
  scene.add(backLight);

  // Hierarchy:
  // stageGroup (handles responsive scale & framing)
  //   └─ phonePivot (handles entrance swoop, direct drag, and central pivot rotation)
  //        └─ phoneMeshGroup (offset by -center so (0,0,0) is true geometric center)
  stageGroup = new THREE.Group();
  scene.add(stageGroup);

  phonePivot = new THREE.Group();
  phonePivot.position.set(DEFAULT_POS.x, DEFAULT_POS.y, DEFAULT_POS.z);
  phonePivot.rotation.set(DEFAULT_ROT.x, DEFAULT_ROT.y, DEFAULT_ROT.z);
  stageGroup.add(phonePivot);

  raycaster = new THREE.Raycaster();
  mouseNDC = new THREE.Vector2(-999, -999);

  updateResponsiveFraming();
  loadPhoneModel();
  setupInteractions();
}

/* ---------- 3D Model Loader ------------------------------ */
function loadPhoneModel() {
  const loader = new GLTFLoader();
  const modelUrl = 'assets/phone.glb?v=2.6';

  function onModelSuccess(gltf) {
    phoneMeshGroup = gltf.scene;

    // ══ TRUE GEOMETRIC CENTER PIVOT & SCALE NORMALIZATION ═══
    const bbox = new THREE.Box3().setFromObject(phoneMeshGroup);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());

    // Center the model exactly at (0, 0, 0)
    phoneMeshGroup.position.set(-center.x, -center.y, -center.z);

    // Normalize scale (scaled down to match exact reference proportions)
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scaleFactor = 0.215 / maxDim;
      phoneMeshGroup.scale.setScalar(scaleFactor);
    }

    // Use 100% original model materials, and attach interactive mask shader to the screen mesh
    phoneMeshGroup.traverse((child) => {
      if (child.isMesh && child.material) {
        const mat = child.material;
        mat.toneMapped = true;

        // Attach dynamic Wireframe <-> Hi-Fi reveal mask shader to screen display
        if (
          mat.name === 'BsXHDwLKqtDOfrW' ||
          (mat.name && mat.name.toLowerCase().includes('screen')) ||
          (child.name && child.name.includes('HkNSnYzBPABcqwM'))
        ) {
          child.material = createScreenMaterial();
          screenMesh = child;
        }
      }
    });

    phonePivot.add(phoneMeshGroup);

    // Hide above screen until preloader exit
    phonePivot.position.y = DEFAULT_POS.y + 0.60;
    phonePivot.rotation.y = DEFAULT_ROT.y + Math.PI * 2;
    phonePivot.rotation.x = DEFAULT_ROT.x - 0.45;
    phonePivot.rotation.z = DEFAULT_ROT.z + 0.15;

    // Pre-render a frame to warm up WebGL shader compilation and GPU buffers before reveal
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }

    modelLoaded = true;
    realProgressPct = 100;
  }

  loader.load(
    modelUrl,
    onModelSuccess,
    (xhr) => {
      if (xhr.lengthComputable && xhr.total > 0) {
        const pct = (xhr.loaded / xhr.total) * 100;
        realProgressPct = Math.max(realProgressPct, Math.min(96, Math.round(pct)));
      } else if (xhr.loaded > 0) {
        const approxPct = (xhr.loaded / (5.3 * 1024 * 1024)) * 100;
        realProgressPct = Math.max(realProgressPct, Math.min(96, Math.round(approxPct)));
      }
    },
    (err) => {
      console.warn('Network issue loading phone model, retrying...', err);
      setTimeout(() => {
        loader.load(modelUrl, onModelSuccess, null, (err2) => {
          console.error('Failed to load phone model after retry:', err2);
        });
      }, 1200);
    }
  );

  // Generous failsafe: Ensure preloader will never permanently hang (35s)
  setTimeout(() => {
    if (!modelLoaded) {
      console.warn('Preloader timeout reached: releasing UI');
      modelLoaded = true;
      realProgressPct = 100;
    }
  }, 35000);
}

/* ---------- Responsive 3D Stage Framing ------------------ */
function updateResponsiveFraming() {
  if (!phoneCanvas || !renderer || !camera || !stageGroup) return;

  const w = heroEl ? heroEl.clientWidth : window.innerWidth;
  const h = heroEl ? heroEl.clientHeight : window.innerHeight;

  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  // Compute adaptive scale so phone is framed elegantly at any screen ratio
  let targetScale = 1.0;
  let targetYOffset = 0;

  if (w > 1200) {
    targetScale = 1.0;
    targetYOffset = 0;
  } else if (w > 860) {
    targetScale = 0.92;
    targetYOffset = -0.005;
  } else if (w > 540) {
    targetScale = 0.82;
    targetYOffset = 0.005;
  } else {
    targetScale = 0.72;
    targetYOffset = 0.008;
  }

  stageGroup.scale.setScalar(targetScale);
  stageGroup.position.y = targetYOffset;
}

window.addEventListener('resize', updateResponsiveFraming, { passive: true });

/* ---------- Entrance Swoop & Spin ------------------------ */
function startPhoneEntrance() {
  introActive = true;
  introStartTime = performance.now();

  // Sequence typography entrance slightly after phone starts swooping
  setTimeout(() => {
    document.documentElement.classList.add('is-ready');
  }, 450);
}

function easeOutQuart(x) {
  return 1 - Math.pow(1 - x, 4);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function stepPhoneEntrance(now) {
  if (!introActive || !phonePivot) return;

  const elapsed = now - introStartTime;
  const progress = Math.min(1, elapsed / introDuration);
  const t = easeOutQuart(progress);

  const startY = DEFAULT_POS.y + 0.60;
  const startRotY = DEFAULT_ROT.y + Math.PI * 2;
  const startRotX = DEFAULT_ROT.x - 0.45;
  const startRotZ = DEFAULT_ROT.z + 0.15;

  phonePivot.position.y = startY + (DEFAULT_POS.y - startY) * t;
  phonePivot.rotation.y = startRotY + (DEFAULT_ROT.y - startRotY) * t;
  phonePivot.rotation.x = startRotX + (DEFAULT_ROT.x - startRotX) * t;
  phonePivot.rotation.z = startRotZ + (DEFAULT_ROT.z - startRotZ) * t;

  if (progress >= 1) {
    introActive = false;
    phonePivot.position.y = DEFAULT_POS.y;
    phonePivot.rotation.set(DEFAULT_ROT.x, DEFAULT_ROT.y, DEFAULT_ROT.z);
  }
}

/* ---------- 3D Interaction: Grab, Rotate & Auto-Return ---- */
function setupInteractions() {
  if (!phoneCanvas) return;

  // Pointer Move (Raycasting for Hover + Cursor Parallax + Active Dragging)
  window.addEventListener('pointermove', (e) => {
    pointer.tx = e.clientX;
    pointer.ty = e.clientY;
    pointer.nx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ny = (e.clientY / window.innerHeight) * 2 - 1;

    // Raycast NDC coordinates
    const rect = phoneCanvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (!isDragging && phoneMeshGroup && camera) {
      raycaster.setFromCamera(mouseNDC, camera);
      const hits = raycaster.intersectObject(phonePivot, true);
      isHoveringPhone = hits.length > 0;
      phoneCanvas.classList.toggle('is-hovered', isHoveringPhone);
      phoneCanvas.style.pointerEvents = isHoveringPhone ? 'auto' : 'none';

      // If cursor is outside the phone, allow hovering over wordmark letters behind canvas
      if (!isHoveringPhone && wordmark && wmSpans.length) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        let hoveredSpan = null;
        for (const el of elements) {
          if (el.matches && el.matches('#wordmark span')) {
            hoveredSpan = el;
            break;
          }
        }
        wmSpans.forEach((span) => {
          if (span === hoveredSpan) {
            span.style.fontVariationSettings = `"wght" 100, "wdth" var(--wm-width, 100)`;
            span.style.fontWeight = '100';
          } else {
            span.style.fontVariationSettings = `"wght" var(--wm-weight, 900), "wdth" var(--wm-width, 100)`;
            span.style.fontWeight = '900';
          }
        });
      }
    }

    if (isDragging) {
      const dx = e.clientX - lastDragPointer.x;
      const dy = e.clientY - lastDragPointer.y;
      lastDragPointer.x = e.clientX;
      lastDragPointer.y = e.clientY;

      dragVelocity.x = dx;
      dragVelocity.y = dy;

      userRotTarget.y += dx * 0.0068;
      userRotTarget.x += dy * 0.0068;

      // Clamp X rotation to prevent inverted flipping
      userRotTarget.x = Math.max(-1.45, Math.min(1.45, userRotTarget.x));
    }
  }, { passive: true });

  // Pointer Down (Start Direct Grabbing ONLY when hovered over the 3D phone on desktop)
  phoneCanvas.addEventListener('pointerdown', (e) => {
    if (introActive || !isHoveringPhone || window.innerWidth <= 860 || e.pointerType === 'touch') return;

    isDragging = true;
    isAutoReturning = false;
    if (returnTimeoutId) clearTimeout(returnTimeoutId);

    lastDragPointer.x = e.clientX;
    lastDragPointer.y = e.clientY;
    dragVelocity.x = 0;
    dragVelocity.y = 0;

    phoneCanvas.classList.add('is-grabbing');
    try { phoneCanvas.setPointerCapture(e.pointerId); } catch (_) {}
  });

  // Pointer Up / Cancel (Release Grab -> Schedule Auto-Return)
  const onPointerRelease = (e) => {
    if (!isDragging) return;
    isDragging = false;
    phoneCanvas.classList.remove('is-grabbing');
    phoneCanvas.style.pointerEvents = isHoveringPhone ? 'auto' : 'none';
    try { phoneCanvas.releasePointerCapture(e.pointerId); } catch (_) {}

    // Schedule auto-return to default rest position after 1.8 seconds idle
    if (returnTimeoutId) clearTimeout(returnTimeoutId);
    returnTimeoutId = setTimeout(() => {
      startAutoReturn();
    }, 1800);
  };

  window.addEventListener('pointerup', onPointerRelease);
  window.addEventListener('pointercancel', onPointerRelease);

  // Touch coordinates for mobile phone screen interactions (Hero spotlight mask & Quote comparison slider)
  const updateTouchCoords = (e) => {
    if (!e.touches || e.touches.length === 0 || !phoneCanvas) return;
    const t = e.touches[0];
    const rect = phoneCanvas.getBoundingClientRect();
    mouseNDC.x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((t.clientY - rect.top) / rect.height) * 2 + 1;
  };

  window.addEventListener('touchstart', updateTouchCoords, { passive: true });
  window.addEventListener('touchmove', updateTouchCoords, { passive: true });
  window.addEventListener('touchend', () => {
    setTimeout(() => {
      mouseNDC.set(-999, -999);
      isHoveringScreen = false;
    }, 60);
  }, { passive: true });
}

function startAutoReturn() {
  if (isDragging || introActive) return;
  isAutoReturning = true;
  returnStartTime = performance.now();
  returnStartRot.x = userRot.x;
  returnStartRot.y = userRot.y;
  returnStartRot.z = userRot.z;
}

function step3DInteractions(now) {
  if (!phonePivot || introActive) return;

  const stageEl = document.querySelector('.hero__stage');
  const heroEl = document.querySelector('.hero');
  const clientsEl = document.querySelector('.clients');
  const quoteSecEl = document.getElementById('quote');
  const quoteWords = document.querySelectorAll('.quote-word');

  const scrollY = window.scrollY || window.pageYOffset || 0;
  const heroH = heroEl ? heroEl.offsetHeight : window.innerHeight;
  const quoteTop = quoteSecEl ? quoteSecEl.offsetTop : (heroH + 200);
  const quoteH = quoteSecEl ? quoteSecEl.offsetHeight : (window.innerHeight * 2.6);
  const quoteScrollRange = Math.max(1, quoteH - window.innerHeight);

  // Quote scroll progress (0.0 to 1.0 inside quote section)
  const quoteProg = Math.max(0, Math.min(1, (scrollY - quoteTop) / quoteScrollRange));

  // Global transition progress from top of page into the quote section
  // Smoothly show/hide 3D stage when scrolling past the Quote section into About
  // Phone rides UP with scroll when leaving Quote section, NEVER advancing down into About!
  const quoteExitScroll = quoteTop + quoteScrollRange;
  const excessScroll = Math.max(0, scrollY - quoteExitScroll);

  if (stageEl) {
    if (excessScroll > window.innerHeight * 0.8) {
      stageEl.style.opacity = '0';
      stageEl.style.visibility = 'hidden';
      stageEl.style.pointerEvents = 'none';
    } else {
      const exitFade = Math.max(0, 1 - excessScroll / (window.innerHeight * 0.65));
      stageEl.style.opacity = `${exitFade.toFixed(2)}`;
      stageEl.style.visibility = 'visible';
      stageEl.style.pointerEvents = 'none';
    }
  }

  // 1. Inertia / Drag Easing
  if (isDragging) {
    userRot.x += (userRotTarget.x - userRot.x) * 0.28;
    userRot.y += (userRotTarget.y - userRot.y) * 0.28;
  } else if (isAutoReturning) {
    const elapsed = now - returnStartTime;
    const progress = Math.min(1, elapsed / returnDuration);
    const t = easeOutCubic(progress);

    userRot.x = returnStartRot.x * (1 - t);
    userRot.y = returnStartRot.y * (1 - t);
    userRot.z = returnStartRot.z * (1 - t);
    userRotTarget.x = userRot.x;
    userRotTarget.y = userRot.y;

    if (progress >= 1) {
      isAutoReturning = false;
      userRot.x = 0;
      userRot.y = 0;
      userRot.z = 0;
      userRotTarget.x = 0;
      userRotTarget.y = 0;
    }
  } else {
    dragVelocity.x *= 0.92;
    dragVelocity.y *= 0.92;
    userRotTarget.y += dragVelocity.x * 0.005;
    userRotTarget.x += dragVelocity.y * 0.005;
    userRotTarget.x = Math.max(-1.45, Math.min(1.45, userRotTarget.x));
    userRot.x += (userRotTarget.x - userRot.x) * 0.15;
    userRot.y += (userRotTarget.y - userRot.y) * 0.15;
  }

  // 2. Cursor Parallax Tilt (Active when outside the phone & not dragging)
  if (!isDragging && !isAutoReturning) {
    const targetParallaxY = pointer.nx * 0.22;
    const targetParallaxX = -pointer.ny * 0.16;

    parallaxRot.x += (targetParallaxX - parallaxRot.x) * 0.055;
    parallaxRot.y += (targetParallaxY - parallaxRot.y) * 0.055;
  } else {
    parallaxRot.x += (0 - parallaxRot.x) * 0.08;
    parallaxRot.y += (0 - parallaxRot.y) * 0.08;
  }

  // 3. Gentle Breathing Float Motion
  const floatY = Math.sin(now * 0.0016) * 0.0025;

  const isDesktop = window.innerWidth > 860;
  const targetX = isDesktop ? 0.135 : (window.innerWidth <= 540 ? 0.024 : 0.032);
  const targetY = isDesktop ? 0.0 : (window.innerWidth <= 540 ? 0.040 : 0.045); // lowered and shifted right for balanced mobile composition
  const transitionRange = quoteTop + quoteScrollRange * 0.35;
  const globalTransitionProg = Math.max(0, Math.min(1, scrollY / Math.max(1, transitionRange)));
  const moveT = 1 - Math.pow(1 - globalTransitionProg, 3);

  // When scrolling past Quote into About, phone scrolls naturally UP off-screen
  const exitOffsetY = (excessScroll / window.innerHeight) * 0.55;

  const posX = DEFAULT_POS.x + (targetX - DEFAULT_POS.x) * moveT;
  const posY = DEFAULT_POS.y + (targetY - DEFAULT_POS.y) * moveT + floatY + exitOffsetY;

  // 360-degree rotation tied directly to downward scroll
  const spinY = globalTransitionProg * (Math.PI * 2);
  // Elegant flip tilt on X-axis during mid-spin
  const flipTilt = Math.sin(globalTransitionProg * Math.PI) * 0.22;

  phonePivot.position.x = posX;
  phonePivot.position.y = posY;
  phonePivot.rotation.x = DEFAULT_ROT.x + flipTilt + parallaxRot.x + userRot.x;
  phonePivot.rotation.y = DEFAULT_ROT.y + spinY + parallaxRot.y + userRot.y;
  phonePivot.rotation.z = DEFAULT_ROT.z + userRot.z;

  // 5. Word-by-Word Progressive Smooth Blur Gradient (Word 1 clear -> Word 2 slight blur -> Word 3 more blur)
  if (quoteWords.length) {
    const totalWords = quoteWords.length;
    // Reveal completes by 58% of the scroll track, leaving 42% for comfortable reading & pause
    const wordRevealProg = Math.min(1, quoteProg / 0.58);
    const currentWordCursor = wordRevealProg * (totalWords + 2.5);

    quoteWords.forEach((word, idx) => {
      const diff = idx - currentWordCursor;

      if (diff <= -0.5) {
        // Fully revealed / crystal clear
        word.style.opacity = '1.0';
        word.style.filter = 'blur(0px)';
        word.style.transform = 'translateY(0px)';
        word.style.color = '#ffffff';
      } else if (diff < 0.5) {
        // Active word transitioning into full clarity
        const t = 1 - (diff + 0.5);
        const blurAmount = Math.max(0, (1 - t) * 4.5);
        const yShift = (1 - t) * 5;
        word.style.opacity = `${(0.70 + t * 0.30).toFixed(2)}`;
        word.style.filter = `blur(${blurAmount.toFixed(1)}px)`;
        word.style.transform = `translateY(${yShift.toFixed(1)}px)`;
        word.style.color = '#ffffff';
      } else if (diff < 1.8) {
        // Next immediate word: slightly blurry
        const subT = (diff - 0.5) / 1.3;
        const blurAmount = 5.0 + subT * 4.5;
        word.style.opacity = `${(0.55 - subT * 0.15).toFixed(2)}`;
        word.style.filter = `blur(${blurAmount.toFixed(1)}px)`;
        word.style.transform = `translateY(${(6 + subT * 6).toFixed(1)}px)`;
        word.style.color = 'rgba(255, 255, 255, 0.85)';
      } else if (diff < 3.2) {
        // Third word: more blurry
        const subT = (diff - 1.8) / 1.4;
        const blurAmount = 9.5 + subT * 4.5;
        word.style.opacity = `${(0.38 - subT * 0.15).toFixed(2)}`;
        word.style.filter = `blur(${blurAmount.toFixed(1)}px)`;
        word.style.transform = `translateY(${(12 + subT * 5).toFixed(1)}px)`;
        word.style.color = 'rgba(255, 255, 255, 0.65)';
      } else {
        // Subsequent words: deeply blurry
        word.style.opacity = '0.14';
        word.style.filter = 'blur(16px)';
        word.style.transform = 'translateY(20px)';
        word.style.color = 'rgba(255, 255, 255, 0.40)';
      }
    });
  }

  // 6. Dual Screen Mode (Hero -> Bad UI/UX vs Good UI/UX Persistent Sweep Slider)
  const quoteModeTarget = Math.max(0, Math.min(1, (globalTransitionProg - 0.45) * 2.5));
  screenUniforms.uQuoteMode.value = quoteModeTarget;

  const isMobile = window.innerWidth <= 860;

  if (screenMesh && camera) {
    raycaster.setFromCamera(mouseNDC, camera);
    const screenHits = raycaster.intersectObject(screenMesh, false);
    if (screenHits.length > 0 && screenHits[0].uv) {
      targetCursorUV.copy(screenHits[0].uv);
      isHoveringScreen = true;
      lastScreenTouchTime = now;

      if (quoteModeTarget > 0.4) {
        // Quote section: slider divider follows mouse/touch X directly
        targetSliderX = Math.max(0.04, Math.min(0.96, screenHits[0].uv.x));
        targetSliderAlpha = Math.min(1.0, Math.max(0.0, (quoteModeTarget - 0.25) * 2.5));
        // Seamlessly sync auto-slide time offset so that when touch/hover ends, auto-slide starts smoothly right from this position
        const normalizedX = (targetSliderX - 0.5) / 0.42;
        const clampedNorm = Math.max(-0.999, Math.min(0.999, normalizedX));
        quoteSliderTimeOffset = now - (Math.asin(clampedNorm) / 0.00065);
      } else {
        // Hero section: badge mask follows mouse/finger
        targetMaskAlpha = 1.0;
        targetMaskRadius = isMobile ? 0.54 : 0.58;
      }
    } else {
      isHoveringScreen = false;

      if (quoteModeTarget > 0.4) {
        // Quote section: divider line & circular handle stay visible for clear comparison
        targetSliderAlpha = Math.min(1.0, Math.max(0.0, (quoteModeTarget - 0.25) * 2.5));

        if (now - lastScreenTouchTime > 1600) {
          // Automatic peaceful back-and-forth comparison slide showing the difference between Bad UI/UX & Good UI/UX
          const autoPhase = (now - quoteSliderTimeOffset) * 0.00065;
          targetSliderX = 0.5 + Math.sin(autoPhase) * 0.42;
          targetCursorUV.y = 0.5;
        }
      } else {
        targetSliderAlpha = 0.0;
        if (isMobile) {
          // On mobile: Mask is ALWAYS active and automatically slides smoothly to showcase Hi-Fi design!
          targetMaskAlpha = 1.0;
          targetMaskRadius = 0.54;
          if (now - lastScreenTouchTime > 1200) {
            // Ultra-gentle, slow luxury breathing glide
            const autoX = 0.5 + Math.sin(now * 0.00045) * 0.28;
            const autoY = 0.5 + Math.cos(now * 0.00055) * 0.22;
            targetCursorUV.set(autoX, autoY);
          }
        } else {
          targetMaskAlpha = 0.0;
          targetMaskRadius = 0.0;
        }
      }
    }
  }

  // Smooth easing for spotlight mask position, radius & alpha
  currentCursorUV.lerp(targetCursorUV, isMobile ? 0.05 : 0.16);
  currentMaskRadius += (targetMaskRadius - currentMaskRadius) * 0.12;
  currentMaskAlpha += (targetMaskAlpha - currentMaskAlpha) * 0.14;

  currentSliderX += (targetSliderX - currentSliderX) * 0.18;
  currentSliderAlpha += (targetSliderAlpha - currentSliderAlpha) * 0.18;

  screenUniforms.uCursorUV.value.copy(currentCursorUV);
  screenUniforms.uMaskRadius.value = currentMaskRadius;
  screenUniforms.uMaskAlpha.value = currentMaskAlpha;
  screenUniforms.uRotation.value = now * (isMobile ? 0.00012 : 0.00035);
  screenUniforms.uSliderX.value = currentSliderX;
  screenUniforms.uSliderAlpha.value = currentSliderAlpha;
}

/* ---------- liquid-glass wordmark dynamic lighting & thinning ------- */
const wmSpans = wordmark ? Array.from(wordmark.querySelectorAll('span')) : [];

wmSpans.forEach((span) => {
  span.addEventListener('pointerenter', () => {
    span.style.fontVariationSettings = `"wght" 100, "wdth" var(--wm-width, 100)`;
    span.style.fontWeight = '100';
  });
  span.addEventListener('pointerleave', () => {
    span.style.fontVariationSettings = `"wght" var(--wm-weight, 900), "wdth" var(--wm-width, 100)`;
    span.style.fontWeight = '900';
  });
});

function updateWordmarkReflection(clientX) {
  if (!wordmark || !wmSpans.length) return;
  wmSpans.forEach((span) => {
    const sRect  = span.getBoundingClientRect();
    const center = sRect.left + sRect.width / 2;
    const dist   = Math.abs(clientX - center);
    const maxD   = window.innerWidth * 0.35;
    const near   = Math.max(0, 1 - dist / maxD);
    span.style.setProperty('--near', near.toFixed(3));
  });
}

/* ---------- 0.6px Cosmic Orange Magnetic / Snapping Target Cursor --------------- */
const cursorTrailEl = document.getElementById('cursor-trail');
const cursorTrail = {
  x: window.innerWidth / 2, y: window.innerHeight / 2,
  tx: window.innerWidth / 2, ty: window.innerHeight / 2,
  width: 44, height: 44, radius: 22,
  tWidth: 44, tHeight: 44, tRadius: 22,
  mode: 'circle',
  activeControl: null,
};

let hoveredProjectCard = null;

function updateCursorTrailTarget(x, y, targetEl) {
  if (window.innerWidth <= 860 || ('ontouchstart' in window && window.innerWidth <= 1024)) {
    hoveredProjectCard = null;
    if (cursorTrailEl) {
      cursorTrailEl.classList.remove('is-project-hover');
      cursorTrailEl.classList.remove('is-live');
    }
    return;
  }

  // If we are explicitly hovering a project card via native pointer events, prioritize it!
  if (hoveredProjectCard) {
    cursorTrail.activeControl = null;
    cursorTrail.mode = 'project-hover';
    cursorTrail.tx = x;
    cursorTrail.ty = y;
    cursorTrail.tWidth = 64;
    cursorTrail.tHeight = 64;
    cursorTrail.tRadius = 32;
    if (cursorTrailEl) {
      cursorTrailEl.classList.add('is-project-hover');
      cursorTrailEl.classList.remove('is-grabbing-target');
    }
    return;
  }

  if (!targetEl) targetEl = document.elementFromPoint(x, y);

  // Exclusions: Do NOT snap on bottom Designer wordmark text and NOT on 3D mobile screen!
  if (
    targetEl?.closest?.('#wordmark, .wordmark') ||
    isHoveringPhone ||
    isHoveringScreen
  ) {
    cursorTrail.activeControl = null;
    setCursorTrailCircle(x, y);
    if (cursorTrailEl) cursorTrailEl.classList.remove('is-grabbing-target');
    return;
  }

  // 1. Direct word-snap spans in hero copy, quote section words, about words & stats, process and testimonials
  const wordSnapEl = targetEl?.closest?.('.word-snap, .quote-word, .about-word, .about-stat-flip, .process-word, .testi-word');
  if (wordSnapEl) {
    cursorTrail.activeControl = wordSnapEl;
    const wRect = wordSnapEl.getBoundingClientRect();
    setCursorTrailRect(wRect, 'word', 6, 8);
    if (cursorTrailEl) cursorTrailEl.classList.add('is-grabbing-target');
    return;
  }

  // 2. Snapping & grabbing on buttons, links, controls with exact matching corner radius
  const control = targetEl?.closest?.('button, [role="button"], .btn-glass, .btn-talk, .about-btn-talk, .about-social-link, .status-pill, .pill, .burger, summary, a:not(.proj-card), .client-logo, .tag, .tags li, .shot');
  if (control) {
    cursorTrail.activeControl = control;
    const cRect = control.getBoundingClientRect();
    const isPill = control.classList.contains('status-pill') || control.classList.contains('btn-talk') || control.classList.contains('about-btn-talk') || control.classList.contains('burger') || control.classList.contains('pill');
    
    // Perfectly matched corner radius (e.g. Let's Talk button pill shape)
    let rad = 8;
    if (isPill) {
      rad = (cRect.height + 12) / 2;
    } else {
      const computed = window.getComputedStyle(control);
      const cr = parseFloat(computed.borderRadius) || 8;
      rad = cr > 16 ? (cRect.height + 12) / 2 : cr + 2;
    }

    setCursorTrailRect(cRect, 'control', 6, rad);
    if (cursorTrailEl) cursorTrailEl.classList.add('is-grabbing-target');
    return;
  }

  // 3. Project Card hover: Cosmic Orange filled ball with diagonal arrow
  const projCard = targetEl?.closest?.('.proj-card');
  if (projCard) {
    cursorTrail.activeControl = null;
    cursorTrail.mode = 'project-hover';
    cursorTrail.tx = x;
    cursorTrail.ty = y;
    cursorTrail.tWidth = 64;
    cursorTrail.tHeight = 64;
    cursorTrail.tRadius = 32;
    if (cursorTrailEl) {
      cursorTrailEl.classList.add('is-project-hover');
      cursorTrailEl.classList.remove('is-grabbing-target');
    }
    return;
  }

  // Remove project hover when not on a project card
  if (cursorTrailEl) cursorTrailEl.classList.remove('is-project-hover');

  // 4. Testimonial Review / Stat Cards (Clean natural cursor inside card while card shows exact outline)
  if (targetEl?.closest?.('.testi-card')) {
    cursorTrail.activeControl = null;
    setCursorTrailCircle(x, y);
    if (cursorTrailEl) cursorTrailEl.classList.remove('is-grabbing-target');
    return;
  }

  cursorTrail.activeControl = null;

  // 4. Snapping on general paragraph words
  const wordRect = getWordRectAtPoint(x, y);
  if (wordRect) {
    setCursorTrailRect(wordRect, 'word', 5, 6);
    if (cursorTrailEl) cursorTrailEl.classList.add('is-grabbing-target');
    return;
  }

  setCursorTrailCircle(x, y);
  if (cursorTrailEl) {
    cursorTrailEl.classList.remove('is-grabbing-target');
    cursorTrailEl.classList.remove('is-project-hover');
  }
}

function setCursorTrailCircle(x, y) {
  cursorTrail.mode = 'circle';
  cursorTrail.tx = x;
  cursorTrail.ty = y;
  cursorTrail.tWidth = 44;
  cursorTrail.tHeight = 44;
  cursorTrail.tRadius = 22;
}

function setCursorTrailRect(rect, mode, pad = 6, rad = 8) {
  cursorTrail.mode = mode;
  cursorTrail.tx = rect.left + rect.width / 2;
  cursorTrail.ty = rect.top + rect.height / 2;
  cursorTrail.tWidth = Math.max(28, rect.width + pad * 2);
  cursorTrail.tHeight = Math.max(22, rect.height + pad * 2);
  cursorTrail.tRadius = rad;
}

function getWordRectAtPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;

  const tag = el.tagName.toLowerCase();
  if (['input', 'textarea', 'select', 'canvas', 'svg', 'img', 'video', 'button', 'a'].includes(tag)) {
    return null;
  }

  if (el.closest('.wordmark, #wordmark, .nav, .menu, button, a, .hero__stage, #phone-canvas')) return null;

  const range = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y) : null;
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const node = range.startContainer;
  const text = node.nodeValue;
  if (!text) return null;

  let offset = range.startOffset;
  if (offset >= text.length) offset = Math.max(0, text.length - 1);

  if (/\s/.test(text[offset])) return null;

  let start = offset;
  while (start > 0 && !/\s/.test(text[start - 1])) start--;

  let end = offset;
  while (end < text.length && !/\s/.test(text[end])) end++;

  const word = text.slice(start, end).replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
  if (word.length < 2) return null;

  const wordRange = document.createRange();
  wordRange.setStart(node, start);
  wordRange.setEnd(node, end);

  const rects = Array.from(wordRange.getClientRects());
  for (const rect of rects) {
    if (x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top - 2 && y <= rect.bottom + 2) {
      return rect;
    }
  }

  return null;
}

window.addEventListener('pointermove', (e) => {
  updateWordmarkReflection(e.clientX);
  updateCursorTrailTarget(e.clientX, e.clientY);
}, { passive: true });

function stepCursorTrail() {
  if (!cursorTrailEl) return;

  // Strict Exclusions: Hide on loading screen, on 3D mobile phone, and inside mobile phone screen!
  const shouldHide = !isPreloaded || isHoveringPhone || isHoveringScreen;
  if (shouldHide) {
    cursorTrailEl.classList.remove('is-live');
    cursorTrailEl.classList.add('is-hidden');
  } else {
    cursorTrailEl.classList.add('is-live');
    cursorTrailEl.classList.remove('is-hidden');
  }

  if (cursorTrail.mode === 'control' && cursorTrail.activeControl) {
    const cRect = cursorTrail.activeControl.getBoundingClientRect();
    const isPill = cursorTrail.activeControl.classList.contains('status-pill') || cursorTrail.activeControl.classList.contains('btn-talk') || cursorTrail.activeControl.classList.contains('burger') || cursorTrail.activeControl.classList.contains('pill');
    let rad = 8;
    if (isPill) {
      rad = (cRect.height + 12) / 2;
    } else {
      const computed = window.getComputedStyle(cursorTrail.activeControl);
      const cr = parseFloat(computed.borderRadius) || 8;
      rad = cr > 16 ? (cRect.height + 12) / 2 : cr + 2;
    }
    setCursorTrailRect(cRect, 'control', 6, rad);
  }

  const easePos  = 0.18;
  const easeSize = 0.20;

  cursorTrail.x += (cursorTrail.tx - cursorTrail.x) * easePos;
  cursorTrail.y += (cursorTrail.ty - cursorTrail.y) * easePos;
  cursorTrail.width  += (cursorTrail.tWidth - cursorTrail.width) * easeSize;
  cursorTrail.height += (cursorTrail.tHeight - cursorTrail.height) * easeSize;
  cursorTrail.radius += (cursorTrail.tRadius - cursorTrail.radius) * easeSize;

  const left = cursorTrail.x - cursorTrail.width / 2;
  const top  = cursorTrail.y - cursorTrail.height / 2;

  cursorTrailEl.style.transform    = `translate3d(${left.toFixed(2)}px, ${top.toFixed(2)}px, 0)`;
  cursorTrailEl.style.width        = `${cursorTrail.width.toFixed(2)}px`;
  cursorTrailEl.style.height       = `${cursorTrail.height.toFixed(2)}px`;
  cursorTrailEl.style.borderRadius = `${cursorTrail.radius.toFixed(2)}px`;
}

/* ---------- smooth scrolling engine ---------------------- */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
window.scrollTo(0, 0);

window.addEventListener('beforeunload', () => {
  window.scrollTo(0, 0);
  if (renderer) {
    try {
      renderer.dispose();
      renderer.forceContextLoss();
    } catch (e) {}
  }
});

window.addEventListener('pagehide', () => {
  if (renderer) {
    try {
      renderer.dispose();
      renderer.forceContextLoss();
    } catch (e) {}
  }
});

const isTouchOrMobile = () => {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth <= 860) return true;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
  const noHover = window.matchMedia('(hover: none)').matches;
  return isCoarse || (noHover && window.innerWidth <= 1024);
};

const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const scroller = { target: 0, current: 0, on: fine && !reduced && !isTouchOrMobile() };
let snapIdleTimer = null;

window.addEventListener('resize', () => {
  const mobile = isTouchOrMobile();
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  scroller.on = finePointer && !reduced && !mobile;
  if (mobile) {
    if (snapIdleTimer) clearTimeout(snapIdleTimer);
    scroller.target = scroller.current = window.scrollY;
  }
}, { passive: true });

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

function getSnapTargets() {
  if (!scroller.on || isTouchOrMobile()) return [];

  const quoteSecEl = document.getElementById('quote');
  const aboutSecEl = document.getElementById('about');
  const workSecEl = document.getElementById('work');
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const list = [
    { id: 'hero', pos: 0, radius: 240 }
  ];

  if (quoteSecEl) {
    const quoteTop = quoteSecEl.getBoundingClientRect().top + scrollY;
    const quoteH = quoteSecEl.offsetHeight;
    const quoteScrollRange = Math.max(1, quoteH - window.innerHeight);
    // Ideal reading sweetspot where quote text is 100% revealed & phone is centered
    list.push({ id: 'quote', pos: quoteTop + quoteScrollRange * 0.65, radius: 320 });
  }

  if (aboutSecEl) {
    const aboutTop = aboutSecEl.getBoundingClientRect().top + scrollY;
    const aboutH = aboutSecEl.offsetHeight;
    const aboutScrollRange = Math.max(1, aboutH - window.innerHeight);
    list.push({ id: 'about-start', pos: aboutTop, radius: 260 });
    list.push({ id: 'about-end', pos: aboutTop + aboutScrollRange * 0.80, radius: 260 });
  }

  // Automatic Magnetic Snap for all 7 Project Cards + See More Slide
  if (workSecEl) {
    const workTop = workSecEl.getBoundingClientRect().top + scrollY;
    const workH = workSecEl.offsetHeight;
    const workScrollDist = Math.max(1, workH - window.innerHeight);

    // Each project card (0..6) and See More (7) has a precise centered magnetic snap point
    for (let i = 0; i <= 7; i++) {
      const snapProg = (i + 1.0) / 8.8;
      const snapPos = workTop + snapProg * workScrollDist;
      list.push({ id: `project-card-${i}`, pos: snapPos, radius: 220, isProject: true });
    }
  }

  const testimonialsSecEl = document.getElementById('testimonials');
  if (testimonialsSecEl) {
    const testiTop = testimonialsSecEl.getBoundingClientRect().top + scrollY;
    const testiH = testimonialsSecEl.offsetHeight;
    const testiScrollRange = Math.max(1, testiH - window.innerHeight);
    list.push({ id: 'testimonials-start', pos: testiTop, radius: 260 });
    list.push({ id: 'testimonials-end', pos: testiTop + testiScrollRange * 0.82, radius: 260 });
  }

  const faqSecEl = document.getElementById('faq');
  if (faqSecEl) {
    const faqTop = faqSecEl.getBoundingClientRect().top + scrollY;
    const faqH = faqSecEl.offsetHeight;
    const faqScrollRange = Math.max(1, faqH - window.innerHeight);
    list.push({ id: 'faq-start', pos: faqTop, radius: 260 });
    list.push({ id: 'faq-end', pos: faqTop + faqScrollRange * 0.82, radius: 260 });
  }

  const contactsSecEl = document.getElementById('contacts');
  if (contactsSecEl) {
    const contactsTop = contactsSecEl.getBoundingClientRect().top + scrollY;
    const contactsH = contactsSecEl.offsetHeight;
    const contactsScrollRange = Math.max(1, contactsH - window.innerHeight);
    list.push({ id: 'contacts-start', pos: contactsTop, radius: 260 });
    list.push({ id: 'contacts-end', pos: contactsTop + contactsScrollRange * 0.82, radius: 260 });
  }

  return list;
}

let lastScrollDir = 0; // 1 = down, -1 = up

function checkMagneticSnap() {
  if (!scroller.on || isTouchOrMobile() || isDragging || menuOpen) return;
  const targets = getSnapTargets();
  const current = scroller.target;
  let best = null;
  let minD = Infinity;

  for (const t of targets) {
    const diff = current - t.pos; // >0 means past target, <0 means before target
    const dist = Math.abs(diff);

    // Project card capture zone vs general section capture zone
    const captureRadius = t.isProject ? 140 : 90;

    // Directional lock: Never pull backwards excessively against user's active scrolling direction!
    if (lastScrollDir > 0 && diff > 35) continue;
    if (lastScrollDir < 0 && diff < -35) continue;

    if (dist < minD && dist <= captureRadius) {
      minD = dist;
      best = t;
    }
  }

  if (best && minD > 1.5) {
    scroller.target = best.pos;
  }
}

window.addEventListener('wheel', (e) => {
  if (!scroller.on || isTouchOrMobile() || menuOpen) return;
  e.preventDefault();

  lastScrollDir = e.deltaY > 0 ? 1 : (e.deltaY < 0 ? -1 : 0);
  scroller.target = Math.min(Math.max(0, scroller.target + e.deltaY), maxScroll());

  if (snapIdleTimer) clearTimeout(snapIdleTimer);
  snapIdleTimer = setTimeout(checkMagneticSnap, 100);
}, { passive: false });

window.addEventListener('scroll', () => {
  if (!scroller.on || isTouchOrMobile()) {
    scroller.target = scroller.current = window.scrollY;
    return;
  }
  const settled = Math.abs(scroller.target - scroller.current) < 1;
  if (settled && Math.abs(window.scrollY - scroller.current) > 2) {
    scroller.target = scroller.current = window.scrollY;
  }
}, { passive: true });

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href === '#') return;
  const el = document.querySelector(href);
  if (!el) return;
  e.preventDefault();
  if (scroller.on && !isTouchOrMobile()) {
    scroller.target = Math.min(Math.max(0, el.getBoundingClientRect().top + window.scrollY), maxScroll());
  } else {
    el.scrollIntoView({ behavior: 'smooth' });
  }
});

function ease(rate, dt) { return 1 - Math.pow(1 - rate, dt * 60); }

function stepScroll(dt) {
  if (!scroller.on || isTouchOrMobile()) return;
  const gap = scroller.target - scroller.current;

  // Gentle magnetic attraction when user slows down near any project card or section sweet spot
  if (Math.abs(gap) < 40 && !menuOpen && !isDragging) {
    const targets = getSnapTargets();
    for (const t of targets) {
      const d = Math.abs(scroller.target - t.pos);
      const attrDist = t.isProject ? 160 : 120;
      if (d < attrDist && d > 1.5) {
        scroller.target += (t.pos - scroller.target) * 0.12;
        break;
      }
    }
  }

  if (Math.abs(gap) < 0.08) {
    scroller.current = scroller.target;
    return;
  }
  scroller.current += gap * ease(0.10, dt);
  window.scrollTo(0, scroller.current);
  updateNavState();
}

/* ---------- navbar scroll state & burger menu ------------- */
let lastNavScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

function updateNavState() {
  if (!navEl) return;
  const currentScrollY = window.scrollY;
  const isScrolled = currentScrollY > 20;
  navEl.classList.toggle('is-scrolled', isScrolled);

  // If mobile menu is open, never hide navbar so user can close it
  if (menuOpen) {
    navEl.classList.remove('is-hidden');
    lastNavScrollY = currentScrollY;
    return;
  }

  // Always keep navbar visible near the very top of the page
  if (currentScrollY <= 40) {
    navEl.classList.remove('is-hidden');
    lastNavScrollY = currentScrollY;
    return;
  }

  const delta = currentScrollY - lastNavScrollY;

  // Use a 6px threshold to prevent false triggers from touch bounce or jitter
  if (Math.abs(delta) >= 6) {
    if (delta > 0 && currentScrollY > 60) {
      // User is scrolling DOWN -> hide navbar
      navEl.classList.add('is-hidden');
    } else if (delta < 0) {
      // User is scrolling UP -> show navbar
      navEl.classList.remove('is-hidden');
    }
    lastNavScrollY = currentScrollY;
  }
}

updateNavState();

window.addEventListener('scroll', () => {
  updateNavState();
  updateCursorTrailTarget(pointer.tx, pointer.ty);
}, { passive: true });

if (burger && menu) {
  burger.addEventListener('click', () => {
    menuOpen = !menuOpen;
    burger.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
    burger.classList.toggle('is-open', menuOpen);
    menu.classList.toggle('is-open', menuOpen);
    menu.toggleAttribute('inert', !menuOpen);
    document.body.classList.toggle('no-scroll', menuOpen);
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuOpen = false;
      burger.setAttribute('aria-expanded', 'false');
      burger.classList.remove('is-open');
      menu.classList.remove('is-open');
      menu.setAttribute('inert', '');
      document.body.classList.remove('no-scroll');
    });
  });
}

/* ---------- main animation loop -------------------------- */
let prevT = performance.now();
function animate(now) {
  const dt = Math.min(0.05, (now - prevT) / 1000);
  prevT = now;

  stepScroll(dt);
  stepCursorTrail();

  if (introActive) {
    stepPhoneEntrance(now);
  } else if (modelLoaded) {
    step3DInteractions(now);
  }

  if (window._drawSectionStarfields) {
    window._drawSectionStarfields(now);
  }

  if (renderer && scene && camera && modelLoaded) {
    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);
}

/* ---------- 3D Flip Character Hover Animation (Magic UI Text3DFlip) --- */
function apply3DFlipToElement(wordEl, wordIdx = 0) {
  let rawText = '';
  const existingFronts = wordEl.querySelectorAll('.flip-char__front');
  if (existingFronts.length > 0) {
    rawText = Array.from(existingFronts).map(s => s.textContent).join('').trim();
  } else {
    rawText = wordEl.textContent.trim();
  }
  if (!rawText) return;

  wordEl.innerHTML = '';
  const chars = Array.from(rawText);
  chars.forEach((char, charIdx) => {
    const charSpan = document.createElement('span');
    charSpan.className = 'flip-char';
    charSpan.style.setProperty('--char-index', charIdx);
    charSpan.style.setProperty('--word-index', wordIdx);

    const innerSpan = document.createElement('span');
    innerSpan.className = 'flip-char__inner';

    const frontSpan = document.createElement('span');
    frontSpan.className = 'flip-char__front';
    frontSpan.textContent = char;

    const backSpan = document.createElement('span');
    backSpan.className = 'flip-char__back';
    backSpan.textContent = char;

    innerSpan.appendChild(frontSpan);
    innerSpan.appendChild(backSpan);
    charSpan.appendChild(innerSpan);
    wordEl.appendChild(charSpan);
  });
}

function initText3DFlip() {
  const elements = document.querySelectorAll('.quote-word, .about-word, .process-word, .testi-word, .faq-word, .proj-word');
  elements.forEach((el, idx) => {
    apply3DFlipToElement(el, idx);
  });
}

/* ---------- Section-Attached Interactive Physics Starfield Engine --- */
function initSectionStarfields() {
  const canvases = document.querySelectorAll('.sec-starfield');
  if (!canvases.length) return;

  const instances = [];

  canvases.forEach((canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1;
    let stars = [];
    let isVisible = false;
    const mouse = { x: -9999, y: -9999, active: false };
    let influence = 0;
    let smoothScrollOffset = 0;
    const t0 = performance.now() + Math.random() * 1000;

    const interactionRadius = 140;
    const speed = 0.5;
    const springK = 0.022 + speed * 0.068;
    const damping = 0.9 - speed * 0.13;
    const MAX_STRETCH = 18;
    const REPULSE_STR = 1.8;
    const baseRgb = [255, 195, 140]; // Warm golden-amber cosmic starlight
    const activeRgb = [255, 87, 34];   // Cosmic Orange (#ff5722) fiery ember spark!

    function seedStars(width, height) {
      // Clean, elegant star density (reduced clutter)
      const count = Math.min(140, Math.max(50, Math.round((width * height) / 10500)));
      return Array.from({ length: count }, () => {
        const ox = Math.random() * width;
        const oy = Math.random() * height;
        return {
          ox, oy,
          x: ox, y: oy,
          vx: 0, vy: 0,
          r: 0.75 + Math.random() * 1.3,
          alpha: 0.15 + Math.random() * 0.55,
          phase: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI * 2,
        };
      });
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.offsetWidth || canvas.parentElement?.offsetWidth || window.innerWidth;
      const maxScreenH = Math.max(window.innerHeight, window.screen?.height || 0);
      H = Math.max(canvas.offsetHeight || 0, canvas.parentElement?.offsetHeight || 0, maxScreenH);
      if (!W || W < 20) W = window.innerWidth;
      if (!H || H < 20) H = maxScreenH;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = seedStars(W, H);
    }

    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0 &&
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
      } else {
        mouse.active = false;
      }
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      mouse.active = false;
    });

    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true;
      if (isVisible && (W < 20 || H < 20 || !stars.length)) {
        resize();
      }
    }, { threshold: 0.01 });
    io.observe(canvas);

    function draw(now) {
      if (!isVisible || document.hidden) return;
      if (W < 20 || H < 20 || !stars.length) {
        resize();
      }
      const elapsed = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      if (mouse.active) {
        influence = Math.min(1, influence + 0.06);
      } else {
        influence = Math.max(0, influence - 0.03);
      }

      const ir2 = interactionRadius * interactionRadius;
      const parentStickySec = canvas.closest('.space-scroll-sec, .cosmic-horizon-sec');
      let rawScrollOffset = 0;
      if (parentStickySec) {
        const secRect = parentStickySec.getBoundingClientRect();
        rawScrollOffset = Math.max(0, -secRect.top);
      }
      // Gentle cosmic momentum: continues gliding and slowly coasts to a peaceful rest
      smoothScrollOffset += (rawScrollOffset - smoothScrollOffset) * 0.032;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Gentle, relaxed upward drift speed with smooth momentum
        let targetOy = s.oy;
        if (parentStickySec && H > 20) {
          const parallaxFactor = (s.r / 1.5) * 0.40 + 0.18;
          targetOy = ((s.oy - smoothScrollOffset * parallaxFactor) % H + H) % H;

          // Smooth wrap-around transition across canvas boundaries
          if (Math.abs(targetOy - s.y) > H * 0.5) {
            s.y = targetOy;
            s.vy = 0;
          }
        }

        // Physics: Repulse & Spring
        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const dist2 = dx * dx + dy * dy;
        const dist = Math.sqrt(dist2);

        let t = 0;
        if (influence > 0.01 && dist2 < ir2) {
          t = Math.pow(1 - dist / interactionRadius, 2) * influence;
        }

        if (t > 0.01 && dist > 0.1) {
          s.vx += (dx / dist) * REPULSE_STR * t;
          s.vy += (dy / dist) * REPULSE_STR * t;
          s.vx += (s.ox - s.x) * springK;
          s.vy += (targetOy - s.y) * springK;
          s.vx *= damping;
          s.vy *= damping;
          s.x += s.vx;
          s.y += s.vy;
        } else {
          // Silky smooth, zero-bounce critical damped coasting (slowly stops over time)
          s.x += (s.ox - s.x) * 0.06;
          s.y += (targetOy - s.y) * 0.06;
          s.vx *= 0.85;
          s.vy *= 0.85;
        }

        // Visuals: Twinkle & Dynamic Dash Stretch
        const twinkle = Math.sin(elapsed * 1.4 + s.phase) * 0.5 + 0.5;
        const baseA = s.alpha * (0.55 + twinkle * 0.45);
        const drawAlpha = Math.min(1, baseA + t * (1 - baseA));

        const stretchH = s.r * 2 + t * MAX_STRETCH;
        const stretchW = s.r * 2;

        const velMag = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        const drawRot = velMag > 0.3
          ? Math.atan2(s.vy, s.vx) + Math.PI / 2
          : s.rot;

        const r = Math.round(baseRgb[0] + (activeRgb[0] - baseRgb[0]) * t);
        const g = Math.round(baseRgb[1] + (activeRgb[1] - baseRgb[1]) * t);
        const b = Math.round(baseRgb[2] + (activeRgb[2] - baseRgb[2]) * t);
        const color = `rgb(${r},${g},${b})`;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(drawRot);
        ctx.globalAlpha = drawAlpha;
        ctx.fillStyle = color;

        if (t > 0.15) {
          ctx.shadowBlur = 8 + t * 18;
          ctx.shadowColor = `rgba(255, 87, 34, ${Math.min(1, t * 1.3).toFixed(2)})`;
        } else {
          ctx.shadowBlur = 0;
        }

        // Rounded-pill shape
        const hw = stretchW / 2;
        const hh = stretchH / 2;
        const cr = Math.min(hw, hh);
        ctx.beginPath();
        ctx.moveTo(-hw + cr, -hh);
        ctx.lineTo(hw - cr, -hh);
        ctx.quadraticCurveTo(hw, -hh, hw, -hh + cr);
        ctx.lineTo(hw, hh - cr);
        ctx.quadraticCurveTo(hw, hh, hw - cr, hh);
        ctx.lineTo(-hw + cr, hh);
        ctx.quadraticCurveTo(-hw, hh, -hw, hh - cr);
        ctx.lineTo(-hw, -hh + cr);
        ctx.quadraticCurveTo(-hw, -hh, -hw + cr, -hh);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    instances.push({ draw });
  });

  window._drawSectionStarfields = function(now) {
    for (let i = 0; i < instances.length; i++) {
      instances[i].draw(now);
    }
  };
}

/* ---------- About Section: Magnetic Snap, Extra Scroll Exit, Floating Portrait, Staggered Reveals --- */
/* ---------- About Section: Scroll-Locked Stage & Choreographed Blur-to-Clear Reveals --- */
function initAboutSectionEffects() {
  const aboutSec = document.getElementById('about');
  if (!aboutSec) return;

  const portraitWrap = document.getElementById('about-portrait-card');
  const innerCard = portraitWrap ? portraitWrap.querySelector('.about-portrait-card') : null;
  const headLabel = document.getElementById('about-head-label');
  const titleWords = aboutSec.querySelectorAll('.about-word');
  const descWords = aboutSec.querySelectorAll('.about-desc-word');
  const statCards = aboutSec.querySelectorAll('.about-stat');
  const ctaRow = document.getElementById('about-cta-row');
  const socials = document.getElementById('about-socials');

  // Set initial hidden/blurred states to prevent flash of content
  if (portraitWrap) {
    portraitWrap.style.opacity = '0.0';
    portraitWrap.style.filter = 'blur(24px)';
    portraitWrap.style.transform = 'translateY(44px) scale(0.95)';
  }
  if (headLabel) {
    headLabel.style.opacity = '0.0';
    headLabel.style.filter = 'blur(14px)';
    headLabel.style.transform = 'translateY(18px)';
  }
  titleWords.forEach(w => {
    w.style.opacity = '0.0';
    w.style.filter = 'blur(16px)';
    w.style.transform = 'translateY(22px)';
  });
  descWords.forEach(w => {
    w.style.opacity = '0.0';
    w.style.filter = 'blur(14px)';
    w.style.transform = 'translateY(16px)';
  });
  statCards.forEach(c => {
    c.style.opacity = '0.0';
    c.style.filter = 'blur(18px)';
    c.style.transform = 'translateY(26px)';
  });
  if (ctaRow && window.innerWidth > 860) {
    ctaRow.style.opacity = '0.0';
    ctaRow.style.filter = 'blur(16px)';
    ctaRow.style.transform = 'translateY(22px)';
  }
  if (socials && window.innerWidth > 860) {
    socials.style.opacity = '0.0';
    socials.style.filter = 'blur(16px)';
    socials.style.transform = 'translateY(20px)';
  }

  let isVisible = true;
  const io = new IntersectionObserver(([entry]) => {
    isVisible = entry?.isIntersecting ?? true;
  }, { threshold: 0.01 });
  io.observe(aboutSec);

  // 3D Pointer tilt on portrait card
  let currentRotX = 0, currentRotY = 0;
  let targetRotX = 0, targetRotY = 0;
  if (portraitWrap && innerCard) {
    portraitWrap.addEventListener('pointermove', (e) => {
      const rect = portraitWrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const nx = (x / rect.width) * 2 - 1;
      const ny = (y / rect.height) * 2 - 1;
      targetRotX = -ny * 10;
      targetRotY = nx * 10;
    });
    portraitWrap.addEventListener('pointerleave', () => {
      targetRotX = 0;
      targetRotY = 0;
    });
  }

  let statsCountTriggered = false;

  function updateAboutChoreography() {
    if (isVisible && !document.hidden) {
      const rect = aboutSec.getBoundingClientRect();
      const secH = aboutSec.offsetHeight;
      const winH = window.innerHeight;
      const maxScroll = secH - winH;

      if (maxScroll > 0) {
        const scrollDist = -rect.top;
        const rawProgress = Math.max(0, Math.min(1, scrollDist / maxScroll));

        // 0. Head Label reveal (0.00 -> 0.08)
        if (headLabel) {
          const t = Math.min(1, Math.max(0, rawProgress / 0.08));
          if (rawProgress >= 0.80) {
            headLabel.style.opacity = '';
            headLabel.style.filter = '';
            headLabel.style.transform = '';
          } else {
            headLabel.style.opacity = `${(t * 1.0).toFixed(2)}`;
            headLabel.style.filter = `blur(${((1 - t) * 14).toFixed(1)}px)`;
            headLabel.style.transform = `translateY(${((1 - t) * 18).toFixed(1)}px)`;
          }
        }

        // 1. Portrait Image Card Reveal (0.00 -> 0.18)
        if (portraitWrap) {
          const t1 = Math.min(1, Math.max(0, rawProgress / 0.18));
          const ease1 = t1 * t1 * (3 - 2 * t1);
          const opacity1 = ease1 * 1.0;
          const blur1 = (1 - ease1) * 24;
          const yShift1 = (1 - ease1) * 44;
          const scale1 = 0.95 + ease1 * 0.05;

          if (rawProgress >= 0.80) {
            portraitWrap.style.opacity = '';
            portraitWrap.style.filter = '';
            portraitWrap.style.transform = '';
          } else {
            portraitWrap.style.opacity = `${opacity1.toFixed(2)}`;
            portraitWrap.style.filter = `blur(${blur1.toFixed(1)}px)`;
            portraitWrap.style.transform = `translateY(${yShift1.toFixed(1)}px) scale(${scale1.toFixed(3)})`;
          }
        }

        // 3D Pointer tilt application on inner card
        if (innerCard) {
          currentRotX += (targetRotX - currentRotX) * 0.1;
          currentRotY += (targetRotY - currentRotY) * 0.1;
          innerCard.style.transform = `rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg)`;
        }

        // 2. Title ("Hi, I'm Bappy") Word-by-Word Reveal (0.18 -> 0.36)
        if (titleWords.length) {
          const phase2Prog = Math.min(1, Math.max(0, (rawProgress - 0.18) / 0.18));
          const titleCursor = phase2Prog * (titleWords.length + 1.2);

          titleWords.forEach((word, idx) => {
            if (rawProgress >= 0.80) {
              word.style.opacity = '';
              word.style.filter = '';
              word.style.transform = '';
            } else {
              const diff = idx - titleCursor;
              if (diff <= -0.5) {
                word.style.opacity = '1.0';
                word.style.filter = 'blur(0px)';
                word.style.transform = 'translateY(0px)';
              } else if (diff < 0.5) {
                const t = 1 - (diff + 0.5);
                const blurAmt = (1 - t) * 16;
                const yShift = (1 - t) * 22;
                word.style.opacity = `${t.toFixed(2)}`;
                word.style.filter = `blur(${blurAmt.toFixed(1)}px)`;
                word.style.transform = `translateY(${yShift.toFixed(1)}px)`;
              } else {
                word.style.opacity = '0.0';
                word.style.filter = 'blur(16px)';
                word.style.transform = 'translateY(22px)';
              }
            }
          });
        }

        // 3. Description Subtext Progressive Word-by-Word Focal Wave (0.36 -> 0.58)
        if (descWords.length) {
          const phase3Prog = Math.min(1, Math.max(0, (rawProgress - 0.36) / 0.22));
          const descCursor = phase3Prog * (descWords.length + 2.0);

          descWords.forEach((word, idx) => {
            if (rawProgress >= 0.80) {
              word.style.opacity = '';
              word.style.filter = '';
              word.style.transform = '';
            } else {
              const diff = idx - descCursor;
              if (diff <= -0.5) {
                word.style.opacity = '0.80';
                word.style.filter = 'blur(0px)';
                word.style.transform = 'translateY(0px)';
              } else if (diff < 0.5) {
                const t = 1 - (diff + 0.5);
                const blurAmt = (1 - t) * 14;
                const yShift = (1 - t) * 16;
                word.style.opacity = `${(t * 0.80).toFixed(2)}`;
                word.style.filter = `blur(${blurAmt.toFixed(1)}px)`;
                word.style.transform = `translateY(${yShift.toFixed(1)}px)`;
              } else if (diff < 2.0) {
                const subT = (diff - 0.5) / 1.5;
                const blurAmt = 6.0 + subT * 8.0;
                word.style.opacity = `${(0.30 - subT * 0.16).toFixed(2)}`;
                word.style.filter = `blur(${blurAmt.toFixed(1)}px)`;
                word.style.transform = `translateY(${(5 + subT * 10).toFixed(1)}px)`;
              } else {
                word.style.opacity = '0.0';
                word.style.filter = 'blur(14px)';
                word.style.transform = 'translateY(16px)';
              }
            }
          });
        }

        // 4. Stats Cards Staggered Rise & Deblur (0.58 -> 0.72)
        if (statCards.length) {
          const phase4Prog = Math.min(1, Math.max(0, (rawProgress - 0.58) / 0.14));
          statCards.forEach((card, idx) => {
            if (rawProgress >= 0.80) {
              card.style.opacity = '';
              card.style.filter = '';
              card.style.transform = '';
            } else {
              const cardStart = idx * 0.22;
              const cardT = Math.min(1, Math.max(0, (phase4Prog - cardStart) / 0.55));
              const easeStat = cardT * cardT * (3 - 2 * cardT);
              const op = easeStat * 1.0;
              const bl = (1 - easeStat) * 18;
              const ys = (1 - easeStat) * 26;

              card.style.opacity = `${op.toFixed(2)}`;
              card.style.filter = `blur(${bl.toFixed(1)}px)`;
              card.style.transform = `translateY(${ys.toFixed(1)}px)`;
            }
          });

          // Trigger stats counter count-up when phase 4 starts
          if (phase4Prog > 0.15 && !statsCountTriggered) {
            statsCountTriggered = true;
            if (typeof window._triggerAboutStatsCount === 'function') {
              window._triggerAboutStatsCount();
            }
          }
        }

        // 5. CTA Button & Social Links Reveal (0.72 -> 0.80)
        if (window.innerWidth <= 860) {
          if (ctaRow) {
            ctaRow.style.opacity = '1.0';
            ctaRow.style.filter = 'none';
            ctaRow.style.transform = 'none';
          }
          if (socials) {
            socials.style.opacity = '1.0';
            socials.style.filter = 'none';
            socials.style.transform = 'none';
          }
        } else {
          if (ctaRow) {
            const phase5Prog = Math.min(1, Math.max(0, (rawProgress - 0.72) / 0.08));
            const ease5 = phase5Prog * phase5Prog * (3 - 2 * phase5Prog);
            const op5 = ease5 * 1.0;
            const bl5 = (1 - ease5) * 16;
            const ys5 = (1 - ease5) * 22;

            if (rawProgress >= 0.80) {
              ctaRow.style.opacity = '';
              ctaRow.style.filter = '';
              ctaRow.style.transform = '';
            } else {
              ctaRow.style.opacity = `${op5.toFixed(2)}`;
              ctaRow.style.filter = `blur(${bl5.toFixed(1)}px)`;
              ctaRow.style.transform = `translateY(${ys5.toFixed(1)}px)`;
            }
          }

          if (socials) {
            const phase6Prog = Math.min(1, Math.max(0, (rawProgress - 0.74) / 0.06));
            const ease6 = phase6Prog * phase6Prog * (3 - 2 * phase6Prog);
            const op6 = ease6 * 1.0;
            const bl6 = (1 - ease6) * 16;
            const ys6 = (1 - ease6) * 20;

            if (rawProgress >= 0.80) {
              socials.style.opacity = '';
              socials.style.filter = '';
              socials.style.transform = '';
            } else {
              socials.style.opacity = `${op6.toFixed(2)}`;
              socials.style.filter = `blur(${bl6.toFixed(1)}px)`;
              socials.style.transform = `translateY(${ys6.toFixed(1)}px)`;
            }
          }
        }
      }
    }

    requestAnimationFrame(updateAboutChoreography);
  }

  requestAnimationFrame(updateAboutChoreography);
}

/* ---------- Animated Count-Up Numbers for About Stats ------------- */
function initAboutStatsCounter() {
  const statWraps = document.querySelectorAll('.about-stat-flip');
  if (!statWraps.length) return;

  let hasAnimated = false;

  window._triggerAboutStatsCount = function() {
    if (hasAnimated) return;
    hasAnimated = true;
    const duration = 2400; // ms
    const startTime = performance.now();

    statWraps.forEach((wrapEl) => {
      const target = parseInt(wrapEl.dataset.target, 10) || 0;
      const suffix = wrapEl.dataset.suffix || '';
      const numEl = wrapEl.querySelector('.about-stat__num');

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 2);

        let currentVal;
        if (progress >= 1) {
          currentVal = target;
        } else {
          currentVal = Math.min(target, Math.floor(ease * (target + 0.999)));
        }

        if (numEl) numEl.textContent = currentVal;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          wrapEl.textContent = `${target}${suffix}`;
          apply3DFlipToElement(wrapEl, 0);
        }
      }
      requestAnimationFrame(step);
    });
  };
}

/* ---------- Star Particle Discrete Step Snapping Engine (1 -> 2 -> 3 -> 4 -> 5 -> 6) --- */
function initProcessStarMorphingNumbers() {
  const sections = document.querySelectorAll('.process-scroll-sec');
  if (!sections.length) return;

  sections.forEach((section) => {
    const canvas = section.querySelector('.process-star-num-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = window.innerWidth, H = window.innerHeight, dpr = 1;
    const NUM_STARS = 650;
    let isVisible = true;
    const t0 = performance.now();

    const mouse = { x: -9999, y: -9999, active: false };
    let influence = 0;

    const interactionRadius = 95;
    const REPULSE_STR = 14;
    const springK = 0.075;
    const damping = 0.80;
    const MAX_STRETCH = 14;

    const isMobileProcess = W <= 960;
    const numeralW = isMobileProcess ? Math.min(280, Math.round(W * 0.72)) : 380;
    const numeralH = isMobileProcess ? Math.min(310, Math.round(H * 0.38)) : 440;

    // Sample target point matrices for all 6 numerals
    function sampleDigitPoints(text, targetCount, targetW = numeralW, targetH = numeralH) {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = targetW;
      offCanvas.height = targetH;
      const offCtx = offCanvas.getContext('2d');
      if (!offCtx) return [];

      offCtx.fillStyle = '#000000';
      offCtx.fillRect(0, 0, targetW, targetH);

      offCtx.fillStyle = '#ffffff';
      const fontSize = isMobileProcess ? Math.round(numeralH * 0.88) : 370;
      offCtx.font = `700 ${fontSize}px "Clash Display", sans-serif`;
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillText(text, targetW / 2, targetH / 2 + (isMobileProcess ? 8 : 10));

      const imgData = offCtx.getImageData(0, 0, targetW, targetH).data;
      const rawPoints = [];
      const step = 4;

      for (let y = 0; y < targetH; y += step) {
        for (let x = 0; x < targetW; x += step) {
          const idx = (y * targetW + x) * 4;
          if (imgData[idx] > 110) {
            rawPoints.push({ x, y });
          }
        }
      }

      if (!rawPoints.length) {
        return Array.from({ length: targetCount }, () => ({
          x: targetW / 2 + (Math.random() - 0.5) * 150,
          y: targetH / 2 + (Math.random() - 0.5) * 200
        }));
      }

      const points = [];
      for (let i = 0; i < targetCount; i++) {
        const pt = rawPoints[Math.floor((i / targetCount) * rawPoints.length)];
        points.push({
          x: pt.x + (Math.random() - 0.5) * 3,
          y: pt.y + (Math.random() - 0.5) * 3
        });
      }
      return points;
    }

    const digits = ['1', '2', '3', '4', '5', '6'];
    const digitTargets = digits.map(d => sampleDigitPoints(d, NUM_STARS));

    // Initialize stars with tight local explosion burst vectors
    const stars = Array.from({ length: NUM_STARS }, () => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 65;
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        entryX: Math.random() * window.innerWidth,
        entryY: Math.random() * window.innerHeight,
        burstVx: Math.cos(angle) * dist,
        burstVy: Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        r: 1.2 + Math.random() * 1.6,
        alpha: 0.65 + Math.random() * 0.35,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI
      };
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0 &&
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
      } else {
        mouse.active = false;
      }
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      mouse.active = false;
    });

    // Discrete Step Snapping State Machine (0: '1', 1: '2', 2: '3', 3: '4', 4: '5', 5: '6')
    let currentStep = 0;
    let fromStep = 0;
    let toStep = 0;
    let isTransitioning = false;
    let transitionStartTime = 0;
    const transitionDuration = 480;

    const stepItems = section.querySelectorAll('.process-step-item');

    function updateProcessStepElements(activeIdx) {
      stepItems.forEach((el, idx) => {
        el.classList.remove('is-active', 'is-next', 'is-prev', 'is-vanished-top', 'is-vanished-bottom');
        const diff = idx - activeIdx;
        if (diff === 0) {
          el.classList.add('is-active');
        } else if (diff === 1) {
          el.classList.add('is-next');
        } else if (diff === -1) {
          el.classList.add('is-prev');
        } else if (diff < -1) {
          el.classList.add('is-vanished-top');
        } else {
          el.classList.add('is-vanished-bottom');
        }
      });
    }
    updateProcessStepElements(0);

    function goToStep(newStep) {
      if (newStep === currentStep && !isTransitioning) return;
      if (newStep < 0 || newStep > 5) return;
      fromStep = currentStep;
      toStep = newStep;
      isTransitioning = true;
      transitionStartTime = performance.now();
      updateProcessStepElements(newStep);
    }

    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? true;
    }, { threshold: 0.01 });
    io.observe(section);

    function draw(now) {
      if (!isVisible || document.hidden) return;

      const rect = section.getBoundingClientRect();
      const sectionHeight = section.offsetHeight;
      const windowHeight = window.innerHeight;

      const scrollDist = -rect.top;
      const maxScroll = sectionHeight - windowHeight;
      const scrollProgress = Math.max(0, Math.min(1, maxScroll > 0 ? scrollDist / maxScroll : 0));

      let stepByScroll = 0;
      if (scrollProgress >= 0.84) {
        stepByScroll = 5;
      } else if (scrollProgress >= 0.66) {
        stepByScroll = 4;
      } else if (scrollProgress >= 0.48) {
        stepByScroll = 3;
      } else if (scrollProgress >= 0.30) {
        stepByScroll = 2;
      } else if (scrollProgress >= 0.14) {
        stepByScroll = 1;
      } else {
        stepByScroll = 0;
      }

      if (rect.top <= 0 && stepByScroll !== currentStep && !isTransitioning) {
        goToStep(stepByScroll);
      }

      const elapsed = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      const isMobile = W <= 960;
      let offsetX = isMobile ? (W - numeralW) / 2 : Math.max(40, (W * 0.43 - numeralW) / 2);
      let offsetY = isMobile ? Math.max(140, Math.round(H * 0.28)) : (H - numeralH) / 2;

      if (!isMobile) {
        const spacer = section.querySelector('.process-left-spacer');
        const bodyLayout = section.querySelector('.process-body-layout');
        const stageEl = section.querySelector('.process-sticky-stage');
        
        if (spacer && bodyLayout && stageEl) {
          const spacerBox = spacer.getBoundingClientRect();
          const bodyBox = bodyLayout.getBoundingClientRect();
          const stageBox = stageEl.getBoundingClientRect();
          
          offsetX = (spacerBox.left - stageBox.left) + (spacerBox.width - numeralW) / 2;
          offsetY = (bodyBox.top - stageBox.top) + (bodyBox.height - numeralH) / 2;
        }
      } else {
        const headEl = section.querySelector('.process-head');
        const trackEl = section.querySelector('.process-steps-track');
        const stageEl = section.querySelector('.process-sticky-stage');
        if (headEl && trackEl && stageEl) {
          const headBox = headEl.getBoundingClientRect();
          const trackBox = trackEl.getBoundingClientRect();
          const stageBox = stageEl.getBoundingClientRect();
          const headBottom = headBox.bottom - stageBox.top;
          const trackCenter = (trackBox.top - stageBox.top) + (trackBox.height / 2);
          const trackTopBound = trackCenter - 36;
          const availableSpace = trackTopBound - headBottom;
          if (availableSpace > numeralH) {
            offsetY = Math.round(headBottom + (availableSpace - numeralH) * 0.50);
          } else {
            offsetY = Math.max(headBottom + 12, Math.round(H * 0.24));
          }
        }
      }

      if (mouse.active) {
        influence = Math.min(1, influence + 0.06);
      } else {
        influence = Math.max(0, influence - 0.03);
      }

      const ir2 = interactionRadius * interactionRadius;

      const isLanding = rect.top > 0 && rect.top < windowHeight * 1.1;
      let landingAlpha = 1.0;
      if (isLanding) {
        const rawLanding = 1 - (rect.top / (windowHeight * 0.85));
        landingAlpha = Math.max(0, Math.min(1, rawLanding));
      }

      let transitionFraction = 0;
      let burstFactor = 0;

      if (isTransitioning) {
        const timeSinceStart = now - transitionStartTime;
        const progress = Math.min(1, Math.max(0, timeSinceStart / transitionDuration));
        transitionFraction = progress * progress * (3 - 2 * progress);
        burstFactor = Math.sin(progress * Math.PI);

        if (progress >= 1.0) {
          isTransitioning = false;
          currentStep = toStep;
          burstFactor = 0;
        }
      }

      for (let i = 0; i < NUM_STARS; i++) {
        const s = stars[i];
        let homeX, homeY;
        let burstGlow = 0;

        if (isLanding && landingAlpha < 0.98) {
          const t1 = digitTargets[0][i];
          const destX = t1.x + offsetX;
          const destY = t1.y + offsetY;
          const smoothLand = landingAlpha * landingAlpha * (3 - 2 * landingAlpha);
          homeX = s.entryX + (destX - s.entryX) * smoothLand;
          homeY = s.entryY + (destY - s.entryY) * smoothLand;
        } else if (!isTransitioning) {
          const pt = digitTargets[currentStep][i];
          homeX = pt.x + offsetX;
          homeY = pt.y + offsetY;
        } else {
          const ptA = digitTargets[fromStep][i];
          const ptB = digitTargets[toStep][i];

          const srcX = ptA.x + offsetX;
          const srcY = ptA.y + offsetY;
          const dstX = ptB.x + offsetX;
          const dstY = ptB.y + offsetY;

          const burstX = s.burstVx * burstFactor;
          const burstY = s.burstVy * burstFactor;

          if (transitionFraction < 0.5) {
            const tExp = transitionFraction * 2.0;
            homeX = srcX + burstX * tExp;
            homeY = srcY + burstY * tExp;
          } else {
            const tConv = (transitionFraction - 0.5) * 2.0;
            homeX = (srcX + burstX) + (dstX - (srcX + burstX)) * tConv;
            homeY = (srcY + burstY) + (dstY - (srcY + burstY)) * tConv;
          }

          burstGlow = burstFactor;
        }

        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const dist2 = dx * dx + dy * dy;
        const dist = Math.sqrt(dist2);

        let t = 0;
        if (influence > 0.01 && dist2 < ir2) {
          t = Math.pow(1 - dist / interactionRadius, 2) * influence;
        }

        if (t > 0.01 && dist > 0.1) {
          s.vx += (dx / dist) * REPULSE_STR * t;
          s.vy += (dy / dist) * REPULSE_STR * t;
          s.vx += (homeX - s.x) * springK;
          s.vy += (homeY - s.y) * springK;
          s.vx *= damping;
          s.vy *= damping;
          s.x += s.vx;
          s.y += s.vy;
        } else {
          s.x += (homeX - s.x) * 0.18;
          s.y += (homeY - s.y) * 0.18;
          s.vx *= 0.5;
          s.vy *= 0.5;
        }

        const twinkle = Math.sin(elapsed * 1.5 + s.phase) * 0.5 + 0.5;
        const baseA = s.alpha * (0.65 + twinkle * 0.35);
        const drawAlpha = Math.min(1, baseA + (t + burstGlow * 0.4) * (1 - baseA));

        const stretchH = s.r * 2 + (t + burstGlow * 0.6) * MAX_STRETCH;
        const stretchW = s.r * 2;

        const velMag = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        const drawRot = velMag > 0.3
          ? Math.atan2(s.vy, s.vx) + Math.PI / 2
          : s.rot;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(drawRot);
        ctx.globalAlpha = drawAlpha;
        ctx.fillStyle = '#ffffff';

        if (burstGlow > 0.1 || t > 0.15) {
          ctx.shadowBlur = 4 + (burstGlow + t) * 12;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        } else {
          ctx.shadowBlur = 2;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        }

        const hw = stretchW / 2;
        const hh = stretchH / 2;
        const rad = Math.min(hw, hh);

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(-hw, -hh, stretchW, stretchH, rad);
        } else {
          ctx.arc(0, 0, s.r, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }
    }

    function loop(now) {
      draw(now);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
}

// ══ COMBINED TESTIMONIALS & FAQ STICKY STAGE (Method 1: Shared 3D WebGL Logo & Scroll Phase Transitions) ══
function initCombinedTestiFaqSection() {
  const section = document.getElementById('testimonials-faq-combined');
  if (!section) return;

  // Staggered reveals elements - Testimonial Phase
  const testiHead = document.getElementById('combined-testi-head');
  const titleWordsTesti = testiHead ? testiHead.querySelectorAll('.testi-word') : [];
  const descWordsTesti = testiHead ? testiHead.querySelectorAll('.testi-desc-word') : [];
  const testiGrid = document.getElementById('combined-testi-grid');
  const cards = testiGrid ? testiGrid.querySelectorAll('.testi-card') : [];
  const statNums = testiGrid ? testiGrid.querySelectorAll('.testi-stat-num') : [];

  // Staggered reveals elements - FAQ Phase
  const faqHead = document.getElementById('combined-faq-head');
  const titleWordsFaq = faqHead ? faqHead.querySelectorAll('.faq-word') : [];
  const descWordsFaq = faqHead ? faqHead.querySelectorAll('.faq-desc-word') : [];
  const faqGrid = document.getElementById('combined-faq-grid');
  const accordionItems = faqGrid ? faqGrid.querySelectorAll('.faq-accordion-item') : [];

  // Shared 3D Logo Stage
  const stageEl = document.getElementById('combined-3d-glass-stage');

  let hasAnimatedStats = false;
  function runStatsCounter() {
    if (hasAnimatedStats) return;
    hasAnimatedStats = true;

    const duration = 2200;
    const startTime = performance.now();

    statNums.forEach((numEl) => {
      const target = parseInt(numEl.dataset.target, 10) || 0;
      const suffix = numEl.dataset.suffix || '';

      function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3);
        const currentVal = Math.floor(ease * target);

        numEl.textContent = `${currentVal}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          numEl.textContent = `${target}${suffix}`;
        }
      }
      requestAnimationFrame(step);
    });
  }

  // Set initial hidden/blurred states to prevent flash of content
  titleWordsTesti.forEach(w => { w.style.opacity = '0.0'; w.style.filter = 'blur(16px)'; w.style.transform = 'translateY(22px)'; });
  descWordsTesti.forEach(w => { w.style.opacity = '0.0'; w.style.filter = 'blur(14px)'; w.style.transform = 'translateY(16px)'; });
  titleWordsFaq.forEach(w => { w.style.opacity = '0.0'; w.style.filter = 'blur(16px)'; w.style.transform = 'translateY(22px)'; });
  descWordsFaq.forEach(w => { w.style.opacity = '0.0'; w.style.filter = 'blur(14px)'; w.style.transform = 'translateY(16px)'; });
  if (stageEl) {
    stageEl.style.opacity = '0.0';
    stageEl.style.filter = 'blur(24px)';
    stageEl.style.transform = 'translateY(44px) scale(0.95)';
  }
  cards.forEach(c => { c.style.opacity = '0.0'; c.style.filter = 'blur(18px)'; c.style.transform = 'translateY(28px)'; });
  accordionItems.forEach(c => { c.style.opacity = '0.0'; c.style.filter = 'blur(18px)'; c.style.transform = 'translateY(28px)'; });

  let isVisible = true;
  const io = new IntersectionObserver(([entry]) => {
    isVisible = entry?.isIntersecting ?? true;
  }, { threshold: 0.01 });
  io.observe(section);

  // Logo transform variables for animation sync
  let transitionSpin = 0;

  function updateCombinedChoreography() {
    if (isVisible && !document.hidden) {
      const rect = section.getBoundingClientRect();
      const secH = section.offsetHeight;
      const winH = window.innerHeight;
      const maxScroll = secH - winH;

      if (maxScroll > 0) {
        const scrollDist = -rect.top;
        const rawProgress = Math.max(0, Math.min(1, scrollDist / maxScroll));

        // ────────────────── PHASE 1: TESTIMONIALS (0.00 -> 0.45) ──────────────────
        if (rawProgress < 0.45) {
          // Layout Visibility
          if (testiHead) {
            testiHead.style.display = 'block';
            testiHead.style.opacity = '1.0';
            testiHead.style.transform = 'translateY(0px)';
            testiHead.style.pointerEvents = 'auto';
          }
          if (faqHead) {
            faqHead.style.display = 'none';
            faqHead.style.opacity = '0.0';
            faqHead.style.pointerEvents = 'none';
          }
          if (testiGrid) {
            testiGrid.style.setProperty('display', 'grid', 'important');
            testiGrid.style.opacity = '1.0';
            testiGrid.style.transform = 'translateY(0px)';
            testiGrid.style.pointerEvents = 'auto';
            testiGrid.classList.remove('is-hidden');
          }
          if (faqGrid) {
            faqGrid.style.display = 'none';
            faqGrid.style.opacity = '0.0';
            faqGrid.style.pointerEvents = 'none';
          }

          // Testi Progress mapped to 0.00 -> 0.40
          const phase1Prog = Math.min(1, Math.max(0, rawProgress / 0.40));

          // 1A. Testi Title reveal
          if (titleWordsTesti.length) {
            const titleCursor = phase1Prog * (titleWordsTesti.length + 1.2);
            titleWordsTesti.forEach((word, idx) => {
              const diff = idx - titleCursor;
              if (diff <= -0.5) {
                word.style.opacity = '1.0';
                word.style.filter = 'blur(0px)';
                word.style.transform = 'translateY(0px)';
              } else if (diff < 0.5) {
                const t = 1 - (diff + 0.5);
                word.style.opacity = `${t.toFixed(2)}`;
                word.style.filter = `blur(${((1 - t) * 16).toFixed(1)}px)`;
                word.style.transform = `translateY(${((1 - t) * 22).toFixed(1)}px)`;
              } else {
                word.style.opacity = '0.0';
                word.style.filter = 'blur(16px)';
                word.style.transform = 'translateY(22px)';
              }
            });
          }

          // 1B. Testi Description progressive focal wave
          if (descWordsTesti.length) {
            const descProgress = Math.min(1, Math.max(0, (phase1Prog - 0.25) / 0.50));
            const descCursor = descProgress * (descWordsTesti.length + 2.0);
            descWordsTesti.forEach((word, idx) => {
              const diff = idx - descCursor;
              if (diff <= -0.5) {
                word.style.opacity = '0.80';
                word.style.filter = 'blur(0px)';
                word.style.transform = 'translateY(0px)';
              } else if (diff < 0.5) {
                const t = 1 - (diff + 0.5);
                word.style.opacity = `${(t * 0.80).toFixed(2)}`;
                word.style.filter = `blur(${((1 - t) * 14).toFixed(1)}px)`;
                word.style.transform = `translateY(${((1 - t) * 16).toFixed(1)}px)`;
              } else if (diff < 2.0) {
                const subT = (diff - 0.5) / 1.5;
                word.style.opacity = `${(0.30 - subT * 0.16).toFixed(2)}`;
                word.style.filter = `blur(${(6.0 + subT * 8.0).toFixed(1)}px)`;
                word.style.transform = `translateY(${(5 + subT * 10).toFixed(1)}px)`;
              } else {
                word.style.opacity = '0.0';
                word.style.filter = 'blur(14px)';
                word.style.transform = 'translateY(16px)';
              }
            });
          }

          // 1C. 3D WebGL Logo slide-up
          if (stageEl) {
            const logoProgress = Math.min(1, Math.max(0, (phase1Prog - 0.40) / 0.35));
            const ease3 = logoProgress * logoProgress * (3 - 2 * logoProgress);
            const opacity3 = ease3 * 0.50;
            const blur3 = (1 - ease3) * 24;
            const yShift3 = (1 - ease3) * 44;
            const scale3 = 0.95 + ease3 * 0.05;

            stageEl.style.opacity = `${opacity3.toFixed(2)}`;
            stageEl.style.filter = `blur(${blur3.toFixed(1)}px)`;
            stageEl.style.transform = `translateY(${yShift3.toFixed(1)}px) scale(${scale3.toFixed(3)})`;
          }

          // 1D. 6 Cards Stagger reveal (One by one on desktop, synchronized rows on mobile)
          if (cards.length) {
            const cardsProgress = Math.min(1, Math.max(0, (phase1Prog - 0.40) / 0.50));
            const isMobile = window.innerWidth <= 860;
            cards.forEach((card, idx) => {
              const staggerIdx = isMobile ? (idx % 3) : idx;
              const cardStart = staggerIdx * 0.12;
              const cardT = Math.min(1, Math.max(0, (cardsProgress - cardStart) / 0.40));
              const easeCard = cardT * cardT * (3 - 2 * cardT);
              const op = easeCard * 1.0;
              const bl = (1 - easeCard) * 18;
              const ys = (1 - easeCard) * 28;

              if (cardsProgress >= 0.85) {
                card.style.opacity = '';
                card.style.filter = '';
                card.style.transform = '';
              } else {
                card.style.opacity = `${op.toFixed(2)}`;
                card.style.filter = `blur(${bl.toFixed(1)}px)`;
                card.style.transform = `translateY(${ys.toFixed(1)}px)`;
              }
            });

            // Trigger stats counter
            if (cardsProgress > 0.40 && !hasAnimatedStats) {
              runStatsCounter();
            }
          }

          // Clear inline styles when fully settled to allow hover interactions
          if (rawProgress >= 0.40 && rawProgress < 0.45) {
            titleWordsTesti.forEach(w => { w.style.opacity = ''; w.style.filter = ''; w.style.transform = ''; });
            descWordsTesti.forEach(w => { w.style.opacity = ''; w.style.filter = ''; w.style.transform = ''; });
            cards.forEach(c => { c.style.opacity = ''; c.style.filter = ''; c.style.transform = ''; });
            if (stageEl) {
              stageEl.style.opacity = '';
              stageEl.style.filter = '';
              stageEl.style.transform = '';
            }
          }
          
          transitionSpin = 0;
        }
        // ────────────────── PHASE 2: CINEMATIC TRANSITION (0.45 -> 0.55) ──────────────────
        else if (rawProgress >= 0.45 && rawProgress < 0.55) {
          const tTrans = (rawProgress - 0.45) / 0.10; // 0.0 -> 1.0

          // Fade out Testimonials elements
          const opTesti = Math.max(0, 1.0 - tTrans * 2.0); // complete fade by 0.50 progress
          if (testiHead) {
            testiHead.style.opacity = `${opTesti.toFixed(2)}`;
            testiHead.style.transform = `translateY(${(tTrans * -25).toFixed(1)}px)`;
            testiHead.style.display = opTesti > 0 ? 'block' : 'none';
            testiHead.style.pointerEvents = 'none';
          }
          if (testiGrid) {
            testiGrid.style.opacity = `${opTesti.toFixed(2)}`;
            testiGrid.style.transform = `translateY(${(tTrans * -35).toFixed(1)}px)`;
            if (opTesti > 0) {
              testiGrid.style.setProperty('display', 'grid', 'important');
              testiGrid.classList.remove('is-hidden');
            } else {
              testiGrid.style.setProperty('display', 'none', 'important');
              testiGrid.classList.add('is-hidden');
            }
            testiGrid.style.pointerEvents = 'none';
          }

          // Fade in FAQ elements
          const opFaq = Math.max(0, (tTrans - 0.5) * 2.0); // start fade at 0.50 progress, full at 0.55
          if (faqHead) {
            faqHead.style.display = opFaq > 0 ? 'block' : 'none';
            faqHead.style.opacity = `${opFaq.toFixed(2)}`;
            faqHead.style.transform = `translateY(${((1 - opFaq) * 25).toFixed(1)}px)`;
            faqHead.style.pointerEvents = 'none';
          }
          if (faqGrid) {
            faqGrid.style.display = opFaq > 0 ? 'flex' : 'none';
            faqGrid.style.opacity = `${opFaq.toFixed(2)}`;
            faqGrid.style.transform = `translateY(${((1 - opFaq) * 35).toFixed(1)}px)`;
            faqGrid.style.pointerEvents = 'none';
          }

          // Keep 3D speech bubble logo in persistent display, adding a cinematic rotation spin
          if (stageEl) {
            stageEl.style.opacity = '0.50';
            stageEl.style.filter = 'blur(0px)';
            stageEl.style.transform = 'translateY(0px) scale(1.0)';
          }
          transitionSpin = tTrans * Math.PI * 2.0; // Spin 360-degrees on transition!
        }
        // ────────────────── PHASE 3: FAQ (0.55 -> 1.00) ──────────────────
        else {
          // Layout Visibility
          if (testiHead) {
            testiHead.style.display = 'none';
            testiHead.style.opacity = '0.0';
            testiHead.style.pointerEvents = 'none';
          }
          if (faqHead) {
            faqHead.style.display = 'block';
            faqHead.style.opacity = '1.0';
            faqHead.style.transform = 'translateY(0px)';
            faqHead.style.pointerEvents = 'auto';
          }
          if (testiGrid) {
            testiGrid.style.setProperty('display', 'none', 'important');
            testiGrid.style.opacity = '0.0';
            testiGrid.style.pointerEvents = 'none';
            testiGrid.classList.add('is-hidden');
          }
          if (faqGrid) {
            faqGrid.style.setProperty('display', 'flex', 'important');
            faqGrid.style.opacity = '1.0';
            faqGrid.style.transform = 'translateY(0px)';
            faqGrid.style.pointerEvents = 'auto';
          }

          // FAQ Progress mapped to 0.55 -> 0.90
          const phase3Prog = Math.min(1, Math.max(0, (rawProgress - 0.55) / 0.35));

          // 3A. FAQ Title reveal
          if (titleWordsFaq.length) {
            const titleCursor = phase3Prog * (titleWordsFaq.length + 1.2);
            titleWordsFaq.forEach((word, idx) => {
              if (rawProgress >= 0.90) {
                word.style.opacity = '';
                word.style.filter = '';
                word.style.transform = '';
              } else {
                const diff = idx - titleCursor;
                if (diff <= -0.5) {
                  word.style.opacity = '1.0';
                  word.style.filter = 'blur(0px)';
                  word.style.transform = 'translateY(0px)';
                } else if (diff < 0.5) {
                  const t = 1 - (diff + 0.5);
                  word.style.opacity = `${t.toFixed(2)}`;
                  word.style.filter = `blur(${((1 - t) * 16).toFixed(1)}px)`;
                  word.style.transform = `translateY(${((1 - t) * 22).toFixed(1)}px)`;
                } else {
                  word.style.opacity = '0.0';
                  word.style.filter = 'blur(16px)';
                  word.style.transform = 'translateY(22px)';
                }
              }
            });
          }

          // 3B. FAQ Description progressive focal wave
          if (descWordsFaq.length) {
            const descProgress = Math.min(1, Math.max(0, (phase3Prog - 0.25) / 0.50));
            const descCursor = descProgress * (descWordsFaq.length + 2.0);
            descWordsFaq.forEach((word, idx) => {
              if (rawProgress >= 0.90) {
                word.style.opacity = '';
                word.style.filter = '';
                word.style.transform = '';
              } else {
                const diff = idx - descCursor;
                if (diff <= -0.5) {
                  word.style.opacity = '0.80';
                  word.style.filter = 'blur(0px)';
                  word.style.transform = 'translateY(0px)';
                } else if (diff < 0.5) {
                  const t = 1 - (diff + 0.5);
                  word.style.opacity = `${(t * 0.80).toFixed(2)}`;
                  word.style.filter = `blur(${((1 - t) * 14).toFixed(1)}px)`;
                  word.style.transform = `translateY(${((1 - t) * 16).toFixed(1)}px)`;
                } else if (diff < 2.0) {
                  const subT = (diff - 0.5) / 1.5;
                  word.style.opacity = `${(0.30 - subT * 0.16).toFixed(2)}`;
                  word.style.filter = `blur(${(6.0 + subT * 8.0).toFixed(1)}px)`;
                  word.style.transform = `translateY(${(5 + subT * 10).toFixed(1)}px)`;
                } else {
                  word.style.opacity = '0.0';
                  word.style.filter = 'blur(14px)';
                  word.style.transform = 'translateY(16px)';
                }
              }
            });
          }

          // 3C. 6 Accordion Items reveal
          if (accordionItems.length) {
            const listProgress = Math.min(1, Math.max(0, (phase3Prog - 0.25) / 0.65));
            accordionItems.forEach((card, idx) => {
              if (rawProgress >= 0.90) {
                card.style.opacity = '';
                card.style.filter = '';
                card.style.transform = '';
              } else {
                const cardStart = idx * 0.10;
                const cardT = Math.min(1, Math.max(0, (listProgress - cardStart) / 0.40));
                const easeCard = cardT * cardT * (3 - 2 * cardT);
                const op = easeCard * 1.0;
                const bl = (1 - easeCard) * 18;
                const ys = (1 - easeCard) * 28;

                card.style.opacity = `${op.toFixed(2)}`;
                card.style.filter = `blur(${bl.toFixed(1)}px)`;
                card.style.transform = `translateY(${ys.toFixed(1)}px)`;
              }
            });
          }


          // Maintain logo state
          if (stageEl) {
            if (rawProgress >= 0.90) {
              stageEl.style.opacity = '';
              stageEl.style.filter = '';
              stageEl.style.transform = '';
            } else {
              stageEl.style.opacity = '0.50';
              stageEl.style.filter = 'blur(0px)';
              stageEl.style.transform = 'translateY(0px) scale(1.0)';
            }
          }
          
          transitionSpin = Math.PI * 2.0;
        }
      }
    }
    requestAnimationFrame(updateCombinedChoreography);
  }
  requestAnimationFrame(updateCombinedChoreography);
  window.addEventListener('scroll', updateCombinedChoreography, { passive: true });
  window.addEventListener('resize', updateCombinedChoreography, { passive: true });

  // ─── 3D Shared Acrylic Glass Bubble Logo (WebGL PMREM Gradient Setup) ───
  const glassContainer = document.getElementById('combined-3d-glass-canvas-wrap');
  if (glassContainer && typeof THREE !== 'undefined') {
    const scene = new THREE.Scene();
    const w = glassContainer.clientWidth || 400;
    const h = glassContainer.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    camera.position.set(0, 0, 5.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.setClearColor(0x000000, 0);
    glassContainer.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envCanvas = document.createElement('canvas');
    envCanvas.width = 2048;
    envCanvas.height = 1024;
    const ctx = envCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#020305';
      ctx.fillRect(0, 0, 2048, 1024);

      const leftStrip = ctx.createLinearGradient(350, 0, 550, 0);
      leftStrip.addColorStop(0, 'rgba(255, 255, 255, 0)');
      leftStrip.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      leftStrip.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = leftStrip;
      ctx.fillRect(350, 150, 200, 724);

      const rightStrip = ctx.createLinearGradient(1500, 0, 1700, 0);
      rightStrip.addColorStop(0, 'rgba(255, 255, 255, 0)');
      rightStrip.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      rightStrip.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = rightStrip;
      ctx.fillRect(1500, 150, 200, 724);
    }

    const texture = new THREE.CanvasTexture(envCanvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    pmremGenerator.dispose();

    const acrylicGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x000000,
      emissive: 0x000000,
      transmission: 1.0,
      opacity: 0.50,
      transparent: true,
      roughness: 0.0,
      metalness: 0.0,
      ior: 1.52,
      thickness: 1.8,
      reflectivity: 1.0,
      specularIntensity: 1.5,
      specularColor: new THREE.Color(0xffffff),
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      attenuationColor: new THREE.Color(0x000000),
      attenuationDistance: 100.0,
      envMapIntensity: 2.4,
      side: THREE.DoubleSide
    });

    const extrudeSettings = {
      steps: 1,
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 20
    };

    const R = 0.60;
    const H = R * 2;
    const vGap = 0.22;
    const hGap = 0.18;
    const xLeft = -(R + hGap / 2 + R);
    const xCapCenter = (R + hGap / 2 + R) - R;
    const cornerRadius = 0.38;

    const logoGroup = new THREE.Group();

    // 1. Top Shape
    const topShape = new THREE.Shape();
    topShape.moveTo(xLeft, vGap / 2);
    topShape.lineTo(xCapCenter, vGap / 2);
    for (let i = 1; i <= 32; i++) {
      const theta = -Math.PI / 2 + (Math.PI * i) / 32;
      topShape.lineTo(xCapCenter + R * Math.cos(theta), vGap / 2 + R + R * Math.sin(theta));
    }
    topShape.lineTo(xLeft + cornerRadius, vGap / 2 + H);
    for (let i = 1; i <= 16; i++) {
      const theta = Math.PI / 2 + (Math.PI / 2 * i) / 16;
      topShape.lineTo((xLeft + cornerRadius) + cornerRadius * Math.cos(theta), (vGap / 2 + H - cornerRadius) + cornerRadius * Math.sin(theta));
    }
    topShape.lineTo(xLeft, vGap / 2);
    const geomTop = new THREE.ExtrudeGeometry(topShape, extrudeSettings);
    geomTop.computeVertexNormals();
    logoGroup.add(new THREE.Mesh(geomTop, acrylicGlassMaterial));

    // 2. Circle Shape
    const circleShape = new THREE.Shape();
    for (let i = 0; i < 64; i++) {
      const theta = (Math.PI * 2 * i) / 64;
      const x = xLeft + R + R * Math.cos(theta);
      const y = -(vGap / 2 + R) + R * Math.sin(theta);
      if (i === 0) circleShape.moveTo(x, y);
      else circleShape.lineTo(x, y);
    }
    circleShape.closePath();
    const geomCircle = new THREE.ExtrudeGeometry(circleShape, extrudeSettings);
    geomCircle.computeVertexNormals();
    logoGroup.add(new THREE.Mesh(geomCircle, acrylicGlassMaterial));

    // 3. D Shape
    const dShape = new THREE.Shape();
    dShape.moveTo(xLeft + 2 * R + hGap, -vGap / 2);
    dShape.lineTo(xCapCenter, -vGap / 2);
    for (let i = 1; i <= 32; i++) {
      const theta = Math.PI / 2 - (Math.PI * i) / 32;
      dShape.lineTo(xCapCenter + R * Math.cos(theta), -(vGap / 2 + H) + R + R * Math.sin(theta));
    }
    dShape.lineTo(xLeft + 2 * R + hGap, -(vGap / 2 + H));
    dShape.lineTo(xLeft + 2 * R + hGap, -vGap / 2);
    const geomD = new THREE.ExtrudeGeometry(dShape, extrudeSettings);
    geomD.computeVertexNormals();
    logoGroup.add(new THREE.Mesh(geomD, acrylicGlassMaterial));

    const midX = (xLeft + xCapCenter + R) / 2;
    const basePosY = 0.15;
    logoGroup.position.set(-midX, basePosY, 0);

    scene.add(logoGroup);

    // Grab-to-Rotate Interactivity
    let rotX = -0.08, rotY = 0.22;
    let targetRotX = -0.08, targetRotY = 0.22;
    let isDragging = false;
    let prevPointerX = 0, prevPointerY = 0;

    const interactiveTarget = stageEl || glassContainer;

    function startDrag(e) {
      isDragging = true;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      interactiveTarget.style.cursor = 'grabbing';
    }

    function onDrag(e) {
      if (!isDragging) return;
      const deltaX = e.clientX - prevPointerX;
      const deltaY = e.clientY - prevPointerY;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;

      targetRotY += deltaX * 0.007;
      targetRotX += deltaY * 0.007;
      targetRotX = Math.max(-0.6, Math.min(0.6, targetRotX));
    }

    function stopDrag() {
      isDragging = false;
      interactiveTarget.style.cursor = 'grab';
    }

    interactiveTarget.addEventListener('pointerdown', startDrag);
    window.addEventListener('pointermove', onDrag);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    function onResize() {
      if (!glassContainer) return;
      const currW = glassContainer.clientWidth || 400;
      const currH = glassContainer.clientHeight || 400;
      camera.aspect = currW / currH;
      camera.updateProjectionMatrix();
      renderer.setSize(currW, currH);
    }
    window.addEventListener('resize', onResize);

    let clockTime = 0;
    let isLogoVisible = true;
    const logoIo = new IntersectionObserver(([entry]) => {
      isLogoVisible = entry.isIntersecting;
    }, { threshold: 0.05 });
    logoIo.observe(interactiveTarget);

    function renderGlassLogo() {
      requestAnimationFrame(renderGlassLogo);
      if (!isLogoVisible) return;

      clockTime += 0.025;
      const ambientFloat = Math.sin(clockTime * 1.2) * 0.05;
      const ambientRotY = Math.sin(clockTime * 0.5) * 0.15;
      const ambientRotX = Math.cos(clockTime * 0.7) * 0.04;

      rotX += (targetRotX - rotX) * 0.10;
      rotY += (targetRotY - rotY) * 0.10;

      logoGroup.position.y = basePosY + ambientFloat;
      logoGroup.rotation.x = rotX + ambientRotX;
      logoGroup.rotation.y = rotY + ambientRotY + transitionSpin;

      renderer.render(scene, camera);
    }
    renderGlassLogo();
  }
}

// ══ FAQ INTERACTIVITY (Click-Driven Smart Accordion with Smooth Reveal) ══
function initFaqInteractivity() {
  const faqItems = document.querySelectorAll('.faq-accordion-item');
  if (!faqItems.length) return;

  faqItems.forEach((item) => {
    item.addEventListener('click', () => {
      const isAlreadyActive = item.classList.contains('is-active');

      // Close all other items
      faqItems.forEach((it) => {
        it.classList.remove('is-active');
        it.setAttribute('aria-expanded', 'false');
      });

      // If clicked item wasn't active, open it
      if (!isAlreadyActive) {
        item.classList.add('is-active');
        item.setAttribute('aria-expanded', 'true');
      }
    });

    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });
  });
}

// ══ SELECTED PROJECTS SECTION (PINNED HORIZONTAL SCROLL + 3D SPINNING LOGO) ══
function initSelectedProjectsSection() {
  const section = document.getElementById('work');
  if (!section) return;

  const track = document.getElementById('projects-track');
  const cards = section.querySelectorAll('.proj-card');
  const titleEl = document.getElementById('projects-active-title');
  const descEl = document.getElementById('projects-active-desc');
  const canvasWrap = document.getElementById('projects-3d-logo-wrap');
  const canvas = document.getElementById('projects-3d-logo-canvas');

  if (!track || !cards.length) return;

  let activeIndex = 0;
  let currentTranslateX = 0;
  let targetTranslateX = 0;
  let scrollProgress = 0;
  let isVisible = false;

  // 1. Three.js Background 3D Spinning Logo Setup (Exact Testimonials 3D Glass Model)
  let logoScene, logoCamera, logoRenderer, logoGroup;
  if (canvas && typeof THREE !== 'undefined') {
    logoScene = new THREE.Scene();
    const w = canvasWrap?.clientWidth || 600;
    const h = canvasWrap?.clientHeight || 600;
    logoCamera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    logoCamera.position.set(0, 0, 5.8); // Exact Testimonials camera distance

    logoRenderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    logoRenderer.setSize(w, h);
    logoRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    logoRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    logoRenderer.toneMappingExposure = 1.35; // Exact Testimonials exposure
    logoRenderer.setClearColor(0x000000, 0);

    // Studio HDRI Texture with Precision Dual White Strip Softboxes (Exact Testimonials Environment)
    const pmremGenerator = new THREE.PMREMGenerator(logoRenderer);
    pmremGenerator.compileEquirectangularShader();

    const envCanvas = document.createElement('canvas');
    envCanvas.width = 2048;
    envCanvas.height = 1024;
    const ctx = envCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#020305';
      ctx.fillRect(0, 0, 2048, 1024);

      // Left Crisp Studio Strip
      const leftStrip = ctx.createLinearGradient(350, 0, 550, 0);
      leftStrip.addColorStop(0, 'rgba(255, 255, 255, 0)');
      leftStrip.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      leftStrip.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = leftStrip;
      ctx.fillRect(350, 150, 200, 724);

      // Right Crisp Studio Strip
      const rightStrip = ctx.createLinearGradient(1500, 0, 1700, 0);
      rightStrip.addColorStop(0, 'rgba(255, 255, 255, 0)');
      rightStrip.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      rightStrip.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = rightStrip;
      ctx.fillRect(1500, 150, 200, 724);

      // Top Softbox
      const topSoftbox = ctx.createRadialGradient(1024, 180, 10, 1024, 180, 400);
      topSoftbox.addColorStop(0, 'rgba(255, 255, 255, 1)');
      topSoftbox.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
      topSoftbox.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = topSoftbox;
      ctx.fillRect(500, 0, 1048, 400);

      // Subtle Cosmic Orange Softbox from 200% Card (Bottom-Right, 50% Opacity)
      const cardOrangeGlow = ctx.createRadialGradient(1600, 750, 10, 1600, 750, 450);
      cardOrangeGlow.addColorStop(0, 'rgba(255, 87, 34, 0.48)');
      cardOrangeGlow.addColorStop(0.5, 'rgba(255, 87, 34, 0.22)');
      cardOrangeGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = cardOrangeGlow;
      ctx.fillRect(1100, 400, 948, 624);

      const envTexture = new THREE.CanvasTexture(envCanvas);
      envTexture.mapping = THREE.EquirectangularReflectionMapping;
      logoScene.environment = pmremGenerator.fromEquirectangular(envTexture).texture;
    }

    // Studio Lights (Zero diffuse ambient wash)
    logoScene.add(new THREE.AmbientLight(0x000000, 0));

    const keyLightL = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLightL.position.set(-6, 4, 5);
    logoScene.add(keyLightL);

    const keyLightR = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLightR.position.set(6, 4, 5);
    logoScene.add(keyLightR);

    const topLight = new THREE.DirectionalLight(0xffffff, 2.2);
    topLight.position.set(0, 7, 3);
    logoScene.add(topLight);

    const backRimLight = new THREE.DirectionalLight(0xffffff, 2.6);
    backRimLight.position.set(0, -3, -5);
    logoScene.add(backRimLight);

    // Cosmic Orange Light originating from 200% Growth Card (Bottom-Right, 50% Softened Opacity/Intensity)
    const cardLightBottomRight = new THREE.DirectionalLight(0xff5722, 2.4);
    cardLightBottomRight.position.set(6.5, -3.5, 4.0);
    logoScene.add(cardLightBottomRight);

    const cardPointLight = new THREE.PointLight(0xff5722, 3.5, 14, 1.2);
    cardPointLight.position.set(5.5, -2.5, 3.0);
    logoScene.add(cardPointLight);

    // 100% Completely Colorless Transparent Acrylic Glass Material (50% Opacity)
    const acrylicGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x000000,              // Pure black base: eliminates all white/grey diffuse color
      emissive: 0x000000,
      transmission: 1.0,            // 100% transparent optical transmission
      opacity: 0.50,                // 50% Opacity as requested
      transparent: true,
      roughness: 0.0,               // Zero surface roughness
      metalness: 0.0,
      ior: 1.52,                    // Optical acrylic index of refraction
      thickness: 1.8,
      reflectivity: 1.0,
      specularIntensity: 1.5,
      specularColor: new THREE.Color(0xffffff),
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      attenuationColor: new THREE.Color(0x000000), // Zero color tint
      attenuationDistance: 100.0,
      envMapIntensity: 2.4,
      side: THREE.DoubleSide
    });

    const extrudeSettings = {
      steps: 1,
      depth: 0.44,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 20
    };

    const R = 0.60;
    const H = R * 2;
    const vGap = 0.22;
    const hGap = 0.18;
    const xLeft = -(R + hGap / 2 + R);
    const xCapCenter = (R + hGap / 2 + R) - R;
    const cornerRadius = 0.38;

    logoGroup = new THREE.Group();

    // 1. Top Shape
    const topShape = new THREE.Shape();
    topShape.moveTo(xLeft, vGap / 2);
    topShape.lineTo(xCapCenter, vGap / 2);
    for (let i = 1; i <= 32; i++) {
      const theta = -Math.PI / 2 + (Math.PI * i) / 32;
      topShape.lineTo(xCapCenter + R * Math.cos(theta), vGap / 2 + R + R * Math.sin(theta));
    }
    topShape.lineTo(xLeft + cornerRadius, vGap / 2 + H);
    for (let i = 1; i <= 16; i++) {
      const theta = Math.PI / 2 + (Math.PI / 2 * i) / 16;
      topShape.lineTo((xLeft + cornerRadius) + cornerRadius * Math.cos(theta), (vGap / 2 + H - cornerRadius) + cornerRadius * Math.sin(theta));
    }
    topShape.lineTo(xLeft, vGap / 2);
    const geomTop = new THREE.ExtrudeGeometry(topShape, extrudeSettings);
    geomTop.computeVertexNormals();
    logoGroup.add(new THREE.Mesh(geomTop, acrylicGlassMaterial));

    // 2. Circle Shape
    const circleShape = new THREE.Shape();
    for (let i = 0; i < 64; i++) {
      const theta = (Math.PI * 2 * i) / 64;
      const x = xLeft + R + R * Math.cos(theta);
      const y = -(vGap / 2 + R) + R * Math.sin(theta);
      if (i === 0) circleShape.moveTo(x, y);
      else circleShape.lineTo(x, y);
    }
    circleShape.closePath();
    const geomCircle = new THREE.ExtrudeGeometry(circleShape, extrudeSettings);
    geomCircle.computeVertexNormals();
    logoGroup.add(new THREE.Mesh(geomCircle, acrylicGlassMaterial));

    // 3. D Shape
    const dShape = new THREE.Shape();
    dShape.moveTo(xLeft + 2 * R + hGap, -vGap / 2);
    dShape.lineTo(xCapCenter, -vGap / 2);
    for (let i = 1; i <= 32; i++) {
      const theta = Math.PI / 2 - (Math.PI * i) / 32;
      dShape.lineTo(xCapCenter + R * Math.cos(theta), -(vGap / 2 + H) + R + R * Math.sin(theta));
    }
    dShape.lineTo(xLeft + 2 * R + hGap, -(vGap / 2 + H));
    dShape.lineTo(xLeft + 2 * R + hGap, -vGap / 2);
    const geomD = new THREE.ExtrudeGeometry(dShape, extrudeSettings);
    geomD.computeVertexNormals();
    logoGroup.add(new THREE.Mesh(geomD, acrylicGlassMaterial));

    const midX = (xLeft + xCapCenter + R) / 2;
    const basePosY = 0.0;
    logoGroup.position.set(-midX, basePosY, 0);
    logoGroup.rotation.set(-0.08, 0.22, 0.04);

    logoScene.add(logoGroup);

    window.addEventListener('resize', () => {
      if (!canvasWrap || !logoCamera || !logoRenderer) return;
      const nw = canvasWrap.clientWidth || 600;
      const nh = canvasWrap.clientHeight || 600;
      logoCamera.aspect = nw / nh;
      logoCamera.updateProjectionMatrix();
      logoRenderer.setSize(nw, nh);
    });
  }

  // 2. Initial 3D Flip Setup for Active Title
  if (titleEl) {
    titleEl.querySelectorAll('.proj-word').forEach((wEl, wIdx) => apply3DFlipToElement(wEl, wIdx));
  }

  // 3. Intersection Observer
  const sectionIo = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
  }, { threshold: 0.01 });
  sectionIo.observe(section);

  // 4. Update Active Project Details
  function setActiveProject(index) {
    if (index === activeIndex) return;
    activeIndex = index;

    cards.forEach((card, idx) => {
      if (idx === activeIndex) {
        card.classList.add('is-active');
      } else {
        card.classList.remove('is-active');
      }
    });

    const activeCard = cards[activeIndex];
    if (activeCard && titleEl && descEl) {
      const newTitle = activeCard.dataset.title || `Project Title ${activeIndex + 1}`;
      const newDesc = activeCard.dataset.desc || '';

      // Animate Description
      descEl.style.opacity = '0';
      descEl.style.transform = 'translateY(6px)';

      setTimeout(() => {
        // Construct title words with .proj-word for 3D flip
        const words = newTitle.split(' ');
        titleEl.innerHTML = words.map(w => `<span class="proj-word">${w}</span>`).join(' ');
        titleEl.querySelectorAll('.proj-word').forEach((wEl, wIdx) => apply3DFlipToElement(wEl, wIdx));

        descEl.textContent = newDesc;
        descEl.style.opacity = '1';
        descEl.style.transform = 'translateY(0)';
      }, 150);
    }
  }

  // 5. Unidirectional Smooth Scroll Driver for 7 Projects + See More
  let logoClock = 0;
  const sliderStage = document.getElementById('projects-slider-stage');
  const infoWrap = document.getElementById('projects-info-wrap');

  const TOTAL_STEPS = 8.8; 
  // -1.0 -> 0.0: Natural 3D orbital slide-in for Card 1 (slides from bottom-right into center)
  // 0.0 -> 6.0: Active project cards 1 through 7
  // 6.0 -> 7.0: "See More" button centering
  // 7.0 -> 7.8: Pause & smooth exit fade

  function updateProjects(timestamp) {
    if (window.innerWidth <= 860) {
      requestAnimationFrame(updateProjects);
      return;
    }
    if (isVisible) {
      const rect = section.getBoundingClientRect();
      const totalDistance = section.offsetHeight - window.innerHeight;

      // Card dimensions & 100% Screen-centerline math
      const cardEl = cards[0];
      const cardWidth = cardEl ? cardEl.offsetWidth : 600;
      const stageWidth = window.innerWidth;
      const initialOffset = (stageWidth / 2) - (cardWidth / 2);
      const gap = parseInt(window.getComputedStyle(track).gap, 10) || 60;
      const stride = cardWidth + gap;

      let cardProgress = -1.0;

      // Pure Scroll-Driven Step Progress with Consistent Orbital Sliding Curve
      if (totalDistance > 0 && rect.top <= 0) {
        scrollProgress = Math.max(0, Math.min(1, -rect.top / totalDistance));
        // Maps scrollProgress (0..1) to cardProgress (-1.0 .. 7.8)
        cardProgress = -1.0 + (scrollProgress * TOTAL_STEPS);
      } else {
        scrollProgress = 0;
        cardProgress = -1.0;
        if (activeIndex !== 0) {
          setActiveProject(0);
        }
      }

      const currentActiveIdx = Math.max(0, Math.min(cards.length - 1, Math.round(Math.max(0, cardProgress))));
      if (currentActiveIdx !== activeIndex && currentActiveIdx >= 0 && currentActiveIdx < cards.length) {
        setActiveProject(currentActiveIdx);
      }

      // Horizontal track translation centering each active card (0..6) and fully centering See More (7)
      const trackStep = Math.max(-1.0, Math.min(7.0, cardProgress));
      targetTranslateX = initialOffset - (trackStep * stride);

      currentTranslateX += (targetTranslateX - currentTranslateX) * 0.18;
      track.style.transform = `translateX(${currentTranslateX.toFixed(2)}px)`;

      // Smooth exit fade only after the See More button has been fully centered
      let exitFade = 1.0;
      if (cardProgress > 7.1) {
        exitFade = Math.max(0, 1.0 - (cardProgress - 7.1) / 0.7);
      }

      // All cards (0..6) rendered in identical continuous 3D orbital sliding trajectory
      cards.forEach((card, idx) => {
        const diff = idx - cardProgress;
        const absDiff = Math.abs(diff);
        
        // 1. Enhanced Vertical Trajectory (Consistent across all cards)
        const cardY = diff * 280;
        
        // 2. 3D Spatial Depth Curve (Cards curve backwards along the orbital perimeter)
        const cardTranslateZ = -Math.pow(Math.min(3.0, absDiff), 1.25) * 120;

        // 3. Scale & Brightness (Consistent 3D orbital curve)
        const cardScale = Math.max(0.58, 1.0 - Math.min(1.0, absDiff) * 0.38);
        const cardBrightness = Math.max(0.42, 1.0 - Math.min(1.2, absDiff) * 0.55);

        card.style.transform = `translateY(${cardY.toFixed(2)}px) translateZ(${cardTranslateZ.toFixed(2)}px) scale(${cardScale.toFixed(3)})`;
        card.style.opacity = exitFade.toFixed(3);
        card.style.filter = `brightness(${cardBrightness.toFixed(3)})`;
      });

      // Project info text smoothly fades in as Card 1 centers, and fades out before See More
      if (infoWrap) {
        let infoFade = exitFade;
        if (cardProgress < 0.0) {
          infoFade = Math.max(0, 1.0 + cardProgress);
        } else if (cardProgress > 6.2) {
          infoFade = Math.max(0, 1.0 - (cardProgress - 6.2) / 0.6);
        }
        infoWrap.style.opacity = infoFade.toFixed(3);
        infoWrap.style.transform = 'translateY(0)';
      }

      // 3D Logo continuous spin linked to scroll + subtle float
      if (logoGroup && logoRenderer && logoScene && logoCamera) {
        logoClock += 0.02;
        const scrollSpin = Math.max(0, scrollProgress) * Math.PI * 4.5;
        const ambientFloat = Math.sin(logoClock * 1.5) * 0.08;
        const ambientRot = Math.cos(logoClock * 0.8) * 0.05;

        logoGroup.rotation.y = scrollSpin + ambientRot;
        logoGroup.rotation.x = -0.08 + Math.sin(logoClock * 0.6) * 0.04;
        logoGroup.position.y = ambientFloat;

        logoRenderer.domElement.style.opacity = exitFade.toFixed(3);
        logoRenderer.render(logoScene, logoCamera);
      }
    }

    requestAnimationFrame(updateProjects);
  }

  // 6. Direct click/hover event fallbacks to ensure 100% clickability and custom cursor trail
  cards.forEach(card => {
    card.addEventListener('pointerenter', () => {
      if (window.innerWidth <= 860) return;
      hoveredProjectCard = card;
    });
    card.addEventListener('pointerleave', () => {
      if (hoveredProjectCard === card) {
        hoveredProjectCard = null;
      }
    });
    card.addEventListener('click', (e) => {
      const href = card.getAttribute('href');
      if (href) {
        window.location.href = href;
      }
    });
  });

  // Stage click fallback to capture events intercepted by 3D transformZ planes
  if (sliderStage) {
    sliderStage.addEventListener('click', (e) => {
      // Prevent double triggers if the click actually did hit the card directly
      if (e.target.closest('a')) return;

      const cardEl = cards[0];
      const cardWidth = cardEl ? cardEl.offsetWidth : 600;
      const gap = parseInt(window.getComputedStyle(track).gap, 10) || 60;
      const stride = cardWidth + gap;

      const clickX = e.clientX;

      // Find which card was clicked
      for (let idx = 0; idx < cards.length; idx++) {
        const cardLeft = currentTranslateX + (idx * stride);
        const cardRight = cardLeft + cardWidth;
        if (clickX >= cardLeft && clickX <= cardRight) {
          const card = cards[idx];
          const href = card.getAttribute('href');
          if (href) {
            window.location.href = href;
          }
          return;
        }
      }

      // Check for See More button (index 7)
      const seeMoreLeft = currentTranslateX + (7 * stride);
      const seeMoreRight = seeMoreLeft + cardWidth;
      if (clickX >= seeMoreLeft && clickX <= seeMoreRight) {
        window.location.href = 'projects.html';
      }
    });
  }

  // Mathematical hover tracking fallback for 3D project cards
  window.addEventListener('pointermove', (e) => {
    // Only check if the projects section is visible in the viewport
    const rect = section.getBoundingClientRect();
    if (rect.top > window.innerHeight || rect.bottom < 0) {
      hoveredProjectCard = null;
      return;
    }

    const cardEl = cards[0];
    const cardWidth = cardEl ? cardEl.offsetWidth : 600;
    const gap = parseInt(window.getComputedStyle(track).gap, 10) || 60;
    const stride = cardWidth + gap;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Check if vertical position is within the slider stage bounds
    const stageRect = sliderStage.getBoundingClientRect();
    const isInsideStageY = mouseY >= stageRect.top && mouseY <= stageRect.bottom;

    let foundHover = null;
    if (isInsideStageY) {
      for (let idx = 0; idx < cards.length; idx++) {
        const cardLeft = currentTranslateX + (idx * stride);
        const cardRight = cardLeft + cardWidth;
        if (mouseX >= cardLeft && mouseX <= cardRight) {
          foundHover = cards[idx];
          break;
        }
      }
    }

    hoveredProjectCard = foundHover;
  }, { passive: true });

  requestAnimationFrame(updateProjects);
}

// ══ SPACE SECTION (PURE COSMIC VOID + SCROLL-DRIVEN SOLAR LIGHT ILLUMINATION 0-100%) ══
function initSpaceSectionTransition() {
  const section = document.getElementById('space');
  if (!section) return;

  const arcWrap = section.querySelector('.space-arc-wrap');
  if (!arcWrap) return;

  let isVisible = true;
  let smoothSpaceProgress = 0;

  const io = new IntersectionObserver(([entry]) => {
    isVisible = entry?.isIntersecting ?? true;
  }, { threshold: 0.01 });
  io.observe(section);

  function updateSpace(timestamp) {
    if (isVisible && !document.hidden) {
      const rect = section.getBoundingClientRect();
      const sectionHeight = section.offsetHeight;
      const windowHeight = window.innerHeight;
      const maxScroll = sectionHeight - windowHeight;

      if (maxScroll > 0) {
        const scrollDist = -rect.top;
        const scrollProgress = Math.max(0, Math.min(1, scrollDist / maxScroll));

        // Light Stripe Opacity smoothly connected to the exact same momentum as the star particles (10% -> 100%)
        smoothSpaceProgress += (scrollProgress - smoothSpaceProgress) * 0.032;

        const normT = Math.min(1, Math.max(0, smoothSpaceProgress / 0.80));
        const opacity = (rect.top > 0) ? 0.10 : (0.10 + normT * 0.90);
        const brightness = 0.70 + normT * 0.60;
        const scale = 0.94 + normT * 0.06;

        arcWrap.style.opacity = opacity.toFixed(3);
        arcWrap.style.transform = `scale(${scale.toFixed(3)})`;
        arcWrap.style.filter = `brightness(${brightness.toFixed(2)})`;
      }
    }

    requestAnimationFrame(updateSpace);
  }

  requestAnimationFrame(updateSpace);
}

// Initialize all components
initVideoTracking();
initThreeScene();
initText3DFlip();
initSectionStarfields();
initAboutSectionEffects();
initAboutStatsCounter();
initProcessStarMorphingNumbers();
initSelectedProjectsSection();
initSpaceSectionTransition();
initCombinedTestiFaqSection();
initTestimonialsMobileSlider();
initFaqInteractivity();
initContactWoodHover();
initContactFormSubmit();

/* ---------- Contact Wood Hover Reveal Effect ---------- */
function initContactWoodHover() {
  const stage = document.querySelector('.contact-sticky-stage');
  if (!stage) return;

  const grass = stage.querySelector('.wood-img-grass');
  if (!grass) return;

  stage.addEventListener('pointermove', (e) => {
    if (window.innerWidth <= 960) return;
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    grass.style.setProperty('--mouse-x', `${x}px`);
    grass.style.setProperty('--mouse-y', `${y}px`);
  });

  stage.addEventListener('pointerleave', () => {
    if (window.innerWidth <= 960) return;
    grass.style.setProperty('--mouse-x', '-1000px');
    grass.style.setProperty('--mouse-y', '-1000px');
  });
}

/* ---------- Contact Form AJAX Submission (FormSubmit.co) ---------- */
function initContactFormSubmit() {
  const contactForm = document.getElementById('contact-form');
  if (!contactForm) return;

  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const submitBtn = contactForm.querySelector('.contact-submit-btn');
    if (!submitBtn) return;
    
    const originalText = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Sending...</span>';
    
    const formData = {
      name: document.getElementById('contact-name').value,
      email: document.getElementById('contact-email').value,
      message: document.getElementById('contact-message').value,
      _subject: 'New Portfolio Inquiry from ' + document.getElementById('contact-name').value
    };
    
    fetch('https://formsubmit.co/ajax/bappiyslam@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
      if (data.success === 'true' || data.success === true) {
        submitBtn.innerHTML = '<span>Message Sent!</span>';
        submitBtn.style.background = '#2e7d32'; // Green background on success
        contactForm.reset();
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          submitBtn.style.background = '';
        }, 4000);
      } else {
        throw new Error('Submission failed');
      }
    })
    .catch(err => {
      console.error(err);
      submitBtn.innerHTML = '<span>Error! Try again</span>';
      submitBtn.style.background = '#c62828'; // Red background on error
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        submitBtn.style.background = '';
      }, 4000);
    });
  });
}

/* ---------- Testimonials Mobile 2-Column x 3-Row Drag & Slide Interactivity (Manual only, No Auto-slide, No Dots) ---------- */
function initTestimonialsMobileSlider() {
  const grid = document.getElementById('combined-testi-grid');
  if (!grid) return;

  const cards = grid.querySelectorAll('.testi-card');
  const totalSlides = 2; // Column 1 (Cards 0,1,2) & Column 2 (Cards 3,4,5)

  function getStep() {
    const card3 = cards[3];
    const card0 = cards[0];
    if (card3 && card0) {
      const stride = card3.getBoundingClientRect().left - card0.getBoundingClientRect().left;
      if (stride > 100) return stride;
      return Math.max(200, card3.offsetLeft - card0.offsetLeft);
    }
    return grid.clientWidth * 0.83;
  }

  function goToSlide(idx, smooth = true) {
    if (idx < 0) idx = 0;
    if (idx >= totalSlides) idx = totalSlides - 1;
    const step = getStep();
    const targetLeft = idx * step;

    grid.scrollTo({
      left: targetLeft,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  // Mouse drag-to-scroll support for desktop preview / testing
  let isMouseDown = false;
  let startX = 0;
  let scrollStart = 0;
  let hasDragged = false;

  grid.addEventListener('mousedown', (e) => {
    if (window.innerWidth > 860) return;
    isMouseDown = true;
    hasDragged = false;
    startX = e.pageX;
    scrollStart = grid.scrollLeft;
  });

  window.addEventListener('mouseup', () => {
    if (!isMouseDown) return;
    isMouseDown = false;
    if (hasDragged && window.innerWidth <= 860) {
      const step = getStep();
      const targetIdx = grid.scrollLeft > step * 0.4 ? 1 : 0;
      goToSlide(targetIdx, true);
    }
  });

  grid.addEventListener('mousemove', (e) => {
    if (!isMouseDown || window.innerWidth > 860) return;
    e.preventDefault();
    const diffX = e.pageX - startX;
    if (Math.abs(diffX) > 6) {
      hasDragged = true;
    }
    grid.scrollLeft = scrollStart - diffX;
  });

  grid.addEventListener('click', (e) => {
    if (hasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

requestAnimationFrame(animate);
