import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AgendaItem, CameraPreset } from '../types/agenda';
import {
  generatePaperEdgesCanvas,
  getAgenda3DCanvases,
} from '../utils/coverGenerator';
import { getDimensionsForFormat } from '../utils/formatters';

interface Agenda3DViewerProps {
  agenda: AgendaItem;
  activePreset: CameraPreset | null;
  autoRotate: boolean;
  reducedMotion: boolean;
  onUserInteract: () => void;
  onPresetComplete: () => void;
  onReady: () => void;
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

/**
 * Creates a rounded-right-corners rectangular Shape centered at (0,0)
 * Left side (x = -w/2) has sharp/hinged binding corners; right side (x = +w/2) has rounded corners.
 */
function createCoverShape(w: number, h: number, radius: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const r = Math.min(radius, hw * 0.25, hh * 0.25);

  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw, hh);
  shape.lineTo(-hw, -hh);
  return shape;
}

/**
 * Normalizes planar UVs of a geometry to [0..1] across [-w/2..w/2] and [-h/2..h/2].
 * If flipU is true, flips horizontal UV for the back cover face so text reads left-to-right from the back.
 */
function normalizePlanarUVs(
  geometry: THREE.BufferGeometry,
  w: number,
  h: number,
  flipU = false
) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  if (!pos || !uv) return;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    let u = (x + w / 2) / w;
    const v = (y + h / 2) / h;
    if (flipU) u = 1 - u;
    uv.setXY(i, Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)));
  }
  uv.needsUpdate = true;
}

/**
 * Generates a soft radial contact shadow texture
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(28, 25, 23, 0.42)');
  grad.addColorStop(0.55, 'rgba(28, 25, 23, 0.16)');
  grad.addColorStop(1, 'rgba(28, 25, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const COVER_STAGE_HEIGHT_FRACTION = 0.72;

export const Agenda3DViewer: React.FC<Agenda3DViewerProps> = ({
  agenda,
  activePreset,
  autoRotate,
  reducedMotion,
  onUserInteract,
  onPresetComplete,
  onReady,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const activePresetRef = useRef<CameraPreset | null>(activePreset);
  activePresetRef.current = activePreset;

  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const callbacksRef = useRef({
    onUserInteract,
    onPresetComplete,
    onReady,
  });
  callbacksRef.current = { onUserInteract, onPresetComplete, onReady };

  const requestRenderRef = useRef<(() => void) | null>(null);
  const startPresetTransitionRef = useRef<
    ((preset: CameraPreset) => void) | null
  >(null);

  useEffect(() => {
    if (activePreset && startPresetTransitionRef.current) {
      startPresetTransitionRef.current(activePreset);
    }
  }, [activePreset]);

  useEffect(() => {
    requestRenderRef.current?.();
  }, [autoRotate]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;

    // 1. Physical dimensions in Three.js units (1 unit = 100 mm)
    const dims = getDimensionsForFormat(agenda.format);
    const W = dims.widthMm / 100; // 1.48 for A5, 1.05 for A6
    const H = dims.heightMm / 100; // 2.10 for A5, 1.48 for A6
    const T = dims.thicknessMm / 100; // 0.25 (25 mm)
    const boardThick = 0.026; // ~2.6 mm rigid board
    const cornerRadius = 0.065; // ~6.5 mm rounded outer corners

    // 2. Scene & Renderer (calibrated for original sRGB color accuracy without external HDRI)
    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initialW = container.clientWidth || 520;
    const initialH = container.clientHeight || 520;
    renderer.setSize(initialW, initialH);
    renderer.domElement.className = 'w-full h-full block touch-none select-none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Camera calibrated so front cover matches the 2D flat cover height fraction
    const fov = 32;
    const camera = new THREE.PerspectiveCamera(
      fov,
      initialW / initialH,
      0.1,
      50
    );
    const halfFovRad = THREE.MathUtils.degToRad(fov / 2);
    const distToFrontFace =
      H / 2 / (COVER_STAGE_HEIGHT_FRACTION * Math.tan(halfFovRad));
    const frontFaceZ = T / 2 + boardThick / 2;
    const baseCamZ = frontFaceZ + distToFrontFace;
    camera.position.set(0, 0, baseCamZ);
    camera.lookAt(0, 0, 0);

    // 4. Studio Lighting (Own Ambient + Directional Lights, preserving original sRGB colors)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.15);
    keyLight.position.set(2.8, 3.8, 4.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      const d = 2.2;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 15;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf0f4ff, 0.55);
    fillLight.position.set(-3.5, 1.5, 2.5);
    scene.add(fillLight);

    const backRimLight = new THREE.DirectionalLight(0xfff5e6, 0.7);
    backRimLight.position.set(0, 2.5, -4.2);
    scene.add(backRimLight);

    // 5. OrbitControls (360° horizontal, limited vertical, limited zoom, no pan, smooth damping)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 0.8;
    controls.minPolarAngle = 0.32;
    controls.maxPolarAngle = Math.PI - 0.32;
    controls.minDistance = baseCamZ * 0.68;
    controls.maxDistance = baseCamZ * 1.65;
    controls.target.set(0, 0, 0);

    // 6. Contact Shadow Ground Plane below the agenda
    const shadowTex = createContactShadowTexture();
    const shadowPlaneGeo = new THREE.PlaneGeometry(W * 2.1, W * 1.45);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -H / 2 - 0.14, 0);
    scene.add(shadowPlane);

    // 7. Root Group for the composite 3D Agenda
    const agendaGroup = new THREE.Group();
    scene.add(agendaGroup);

    const geometries: THREE.BufferGeometry[] = [shadowPlaneGeo];
    const materials: THREE.Material[] = [shadowPlaneMat];
    const textures: THREE.Texture[] = [shadowTex];

    let isTransitioningCamera = false;
    let targetTheta = 0;
    let targetPhi = Math.PI / 2;
    let targetRadius = baseCamZ;
    let introTimer: number | null = null;

    const spherical = new THREE.Spherical();
    const offsetVec = new THREE.Vector3();

    const setCameraTargetAngles = (
      theta: number,
      phi: number,
      radius = baseCamZ
    ) => {
      offsetVec.copy(camera.position).sub(controls.target);
      spherical.setFromVector3(offsetVec);
      let deltaTheta = theta - spherical.theta;
      while (deltaTheta > Math.PI) deltaTheta -= Math.PI * 2;
      while (deltaTheta < -Math.PI) deltaTheta += Math.PI * 2;
      targetTheta = spherical.theta + deltaTheta;
      targetPhi = phi;
      targetRadius = radius;
      isTransitioningCamera = true;
      requestRender();
    };

    startPresetTransitionRef.current = (preset: CameraPreset) => {
      if (preset === 'front') {
        setCameraTargetAngles(0, Math.PI / 2, baseCamZ);
      } else if (preset === 'back') {
        setCameraTargetAngles(Math.PI, Math.PI / 2, baseCamZ);
      } else if (preset === 'spine') {
        setCameraTargetAngles(-Math.PI / 2, Math.PI / 2, baseCamZ);
      }
    };

    const handleControlsStart = () => {
      isTransitioningCamera = false;
      if (introTimer !== null) {
        window.clearTimeout(introTimer);
        introTimer = null;
      }
      if (autoRotateRef.current) {
        callbacksRef.current.onUserInteract();
      }
    };
    controls.addEventListener('start', handleControlsStart);

    // 8. Frame Pacing & Render Loop (Software WebGL safe, using performance.now() delta)
    let lastTimeMs = performance.now();
    let renderBusy = false;
    let renderDirty = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepFrame() {
      if (disposed) return;
      const nowMs = performance.now();
      const dt = Math.min(Math.max((nowMs - lastTimeMs) / 1000, 0.016), 0.15);
      lastTimeMs = nowMs;

      let needsAnotherFrame = false;

      if (isTransitioningCamera) {
        offsetVec.copy(camera.position).sub(controls.target);
        spherical.setFromVector3(offsetVec);

        const dampFactor = reducedMotionRef.current || isSoftwareGl ? 18 : 8.5;
        spherical.theta = THREE.MathUtils.damp(
          spherical.theta,
          targetTheta,
          dampFactor,
          dt
        );
        spherical.phi = THREE.MathUtils.damp(
          spherical.phi,
          targetPhi,
          dampFactor,
          dt
        );
        spherical.radius = THREE.MathUtils.damp(
          spherical.radius,
          targetRadius,
          dampFactor,
          dt
        );

        offsetVec.setFromSpherical(spherical);
        camera.position.copy(controls.target).add(offsetVec);
        camera.lookAt(controls.target);

        const doneTheta = Math.abs(spherical.theta - targetTheta) < 0.008;
        const donePhi = Math.abs(spherical.phi - targetPhi) < 0.008;
        const doneRad = Math.abs(spherical.radius - targetRadius) < 0.008;
        if (doneTheta && donePhi && doneRad) {
          spherical.theta = targetTheta;
          spherical.phi = targetPhi;
          spherical.radius = targetRadius;
          offsetVec.setFromSpherical(spherical);
          camera.position.copy(controls.target).add(offsetVec);
          camera.lookAt(controls.target);
          isTransitioningCamera = false;
          callbacksRef.current.onPresetComplete();
        } else {
          needsAnotherFrame = true;
        }
      } else if (
        autoRotateRef.current &&
        !reducedMotionRef.current &&
        !isSoftwareGl
      ) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 1.35;
        needsAnotherFrame = true;
      } else {
        controls.autoRotate = false;
      }

      const controlsChanged = controls.update();
      if (controlsChanged && !isSoftwareGl) {
        needsAnotherFrame = true;
      }

      renderer.render(scene, camera);

      const done = () => {
        renderBusy = false;
        if (renderDirty || needsAnotherFrame) {
          requestRender();
        }
      };

      if (isSoftwareGl) {
        afterDraw(done);
      } else {
        done();
      }
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      renderDirty = false;
      frameId = requestAnimationFrame(stepFrame);
    }

    requestRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);

    // 9. Build the 3D Agenda Model asynchronously once textures are ready
    getAgenda3DCanvases(agenda).then(
      ({ frontCanvas, backCanvas, spineCanvas }) => {
        if (disposed) return;

        const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

        const frontTex = new THREE.CanvasTexture(frontCanvas);
        frontTex.colorSpace = THREE.SRGBColorSpace;
        frontTex.anisotropy = maxAnisotropy;

        const backTex = new THREE.CanvasTexture(backCanvas);
        backTex.colorSpace = THREE.SRGBColorSpace;
        backTex.anisotropy = maxAnisotropy;

        const spineTex = new THREE.CanvasTexture(spineCanvas);
        spineTex.colorSpace = THREE.SRGBColorSpace;
        spineTex.anisotropy = maxAnisotropy;

        const paperCanvas = generatePaperEdgesCanvas();
        const paperTex = new THREE.CanvasTexture(paperCanvas);
        paperTex.colorSpace = THREE.SRGBColorSpace;
        paperTex.wrapS = THREE.RepeatWrapping;
        paperTex.wrapT = THREE.RepeatWrapping;
        paperTex.repeat.set(3, 3);
        paperTex.anisotropy = maxAnisotropy;

        textures.push(frontTex, backTex, spineTex, paperTex);

        // Materials with matte bookcloth finish so colors match the flat cover 1:1
        const frontMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: frontTex,
          roughness: 0.85,
          metalness: 0.0,
        });
        const backMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: backTex,
          roughness: 0.85,
          metalness: 0.0,
        });
        const spineMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: spineTex,
          roughness: 0.82,
          metalness: 0.0,
        });
        const endpaperMat = new THREE.MeshStandardMaterial({
          color: 0xf4efe4,
          roughness: 0.9,
          metalness: 0.0,
        });
        const boardEdgeMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(
            agenda.proceduralConfig?.spineColor ??
              agenda.customTextures?.derivedColor ??
              '#1E352F'
          ),
          roughness: 0.78,
          metalness: 0.02,
        });
        const paperBlockMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: paperTex,
          roughness: 0.88,
          metalness: 0.0,
        });

        materials.push(
          frontMat,
          backMat,
          spineMat,
          endpaperMat,
          boardEdgeMat,
          paperBlockMat
        );

        // PART 1: Front Cover Board (with slightly rounded outer corners)
        const coverShape = createCoverShape(W, H, cornerRadius);
        const boardExtrudeSettings: THREE.ExtrudeGeometryOptions = {
          steps: 1,
          depth: boardThick,
          bevelEnabled: true,
          bevelThickness: 0.004,
          bevelSize: 0.004,
          bevelSegments: 2,
        };

        const frontBoardGeo = new THREE.ExtrudeGeometry(
          coverShape,
          boardExtrudeSettings
        );
        frontBoardGeo.translate(0, 0, -boardThick / 2);
        normalizePlanarUVs(frontBoardGeo, W, H, false);
        geometries.push(frontBoardGeo);

        const frontCoverMesh = new THREE.Mesh(frontBoardGeo, [
          boardEdgeMat,
          boardEdgeMat,
        ]);
        frontCoverMesh.position.set(0, 0, T / 2);
        frontCoverMesh.castShadow = !isSoftwareGl;
        frontCoverMesh.receiveShadow = !isSoftwareGl;
        agendaGroup.add(frontCoverMesh);

        // Front Outer Artwork Plane flush on the front board face
        const frontArtGeo = new THREE.ShapeGeometry(coverShape, 12);
        normalizePlanarUVs(frontArtGeo, W, H, false);
        geometries.push(frontArtGeo);
        const frontArtMesh = new THREE.Mesh(frontArtGeo, frontMat);
        frontArtMesh.position.set(0, 0, T / 2 + boardThick / 2 + 0.005);
        agendaGroup.add(frontArtMesh);

        // Front Inner Endpaper (Guarda interior)
        const frontEndpaperMesh = new THREE.Mesh(frontArtGeo, endpaperMat);
        frontEndpaperMesh.rotation.y = Math.PI;
        frontEndpaperMesh.position.set(0, 0, T / 2 - boardThick / 2 - 0.005);
        agendaGroup.add(frontEndpaperMesh);

        // PART 2: Back Cover Board
        const backCoverMesh = new THREE.Mesh(frontBoardGeo, [
          boardEdgeMat,
          boardEdgeMat,
        ]);
        backCoverMesh.position.set(0, 0, -T / 2);
        backCoverMesh.castShadow = !isSoftwareGl;
        backCoverMesh.receiveShadow = !isSoftwareGl;
        agendaGroup.add(backCoverMesh);

        const backArtGeo = new THREE.ShapeGeometry(coverShape, 12);
        normalizePlanarUVs(backArtGeo, W, H, true);
        geometries.push(backArtGeo);
        const backArtMesh = new THREE.Mesh(backArtGeo, backMat);
        backArtMesh.rotation.y = Math.PI;
        backArtMesh.position.set(0, 0, -T / 2 - boardThick / 2 - 0.005);
        agendaGroup.add(backArtMesh);

        const backEndpaperMesh = new THREE.Mesh(frontArtGeo, endpaperMat);
        backEndpaperMesh.position.set(0, 0, -T / 2 + boardThick / 2 + 0.005);
        agendaGroup.add(backEndpaperMesh);

        // PART 3: Page Block (Bloque de hojas con textura de papel en el canto)
        const pageInset = 0.038;
        const pageW = W - pageInset;
        const pageH = H - pageInset * 2;
        const pageDepth = T - boardThick * 1.4;
        const pageShape = createCoverShape(pageW, pageH, cornerRadius * 0.85);
        const pageBlockGeo = new THREE.ExtrudeGeometry(pageShape, {
          steps: 1,
          depth: pageDepth,
          bevelEnabled: false,
        });
        pageBlockGeo.translate(-pageInset / 2, 0, -pageDepth / 2);
        geometries.push(pageBlockGeo);

        const pageBlockMesh = new THREE.Mesh(pageBlockGeo, paperBlockMat);
        pageBlockMesh.castShadow = !isSoftwareGl;
        pageBlockMesh.receiveShadow = !isSoftwareGl;
        agendaGroup.add(pageBlockMesh);

        // PART 4: Spine (Lomo con su propia textura)
        const spineTotalThickness = T + boardThick + 0.008;
        const spineGeo = new THREE.BoxGeometry(
          0.022,
          H + 0.008,
          spineTotalThickness
        );
        geometries.push(spineGeo);
        const spineMaterials = [
          boardEdgeMat,
          spineMat,
          boardEdgeMat,
          boardEdgeMat,
          boardEdgeMat,
          boardEdgeMat,
        ];
        const spineMesh = new THREE.Mesh(spineGeo, spineMaterials);
        spineMesh.position.set(-W / 2 - 0.002, 0, 0);
        spineMesh.castShadow = !isSoftwareGl;
        agendaGroup.add(spineMesh);

        // PART 5: Top & Bottom Cloth Headbands (Cabezadas) + Ribbon Bookmark
        const headbandMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(
            agenda.proceduralConfig?.accentColor ?? '#E5B869'
          ),
          roughness: 0.75,
          metalness: 0.05,
        });
        materials.push(headbandMat);

        const headbandGeo = new THREE.CylinderGeometry(
          0.012,
          0.012,
          pageDepth * 0.92,
          12
        );
        headbandGeo.rotateX(Math.PI / 2);
        geometries.push(headbandGeo);

        const topHeadband = new THREE.Mesh(headbandGeo, headbandMat);
        topHeadband.position.set(-W / 2 + 0.018, pageH / 2 + 0.004, 0);
        agendaGroup.add(topHeadband);

        const bottomHeadband = new THREE.Mesh(headbandGeo, headbandMat);
        bottomHeadband.position.set(-W / 2 + 0.018, -pageH / 2 - 0.004, 0);
        agendaGroup.add(bottomHeadband);

        const ribbonGeo = new THREE.BoxGeometry(0.055, 0.085, 0.006);
        geometries.push(ribbonGeo);
        const ribbonMesh = new THREE.Mesh(ribbonGeo, headbandMat);
        ribbonMesh.position.set(-W * 0.12, -H / 2 - 0.025, 0.01);
        ribbonMesh.rotation.z = 0.14;
        agendaGroup.add(ribbonMesh);

        // PART 6: Vertical Elastic Band (Elástico vertical, aligned at 85% width = +0.35*W)
        if (agenda.hasElastic) {
          const elasticHex =
            agenda.proceduralConfig?.elasticColor ??
            agenda.proceduralConfig?.accentColor ??
            '#1C1917';
          const elasticMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(elasticHex),
            roughness: 0.78,
            metalness: 0.02,
          });
          const eyeletMat = new THREE.MeshStandardMaterial({
            color: 0xd4af37,
            roughness: 0.35,
            metalness: 0.65,
          });
          materials.push(elasticMat, eyeletMat);

          const elasticX = W * 0.35; // 85% from left edge
          const elasticWidth = 0.088; // ~8.8 mm wide strap
          const elasticThick = 0.016;
          const frontZ = T / 2 + boardThick / 2 + 0.008;
          const backZ = -T / 2 - boardThick / 2 - 0.008;

          const frontStrapGeo = new THREE.BoxGeometry(
            elasticWidth,
            H + 0.022,
            elasticThick
          );
          geometries.push(frontStrapGeo);
          const frontStrap = new THREE.Mesh(frontStrapGeo, elasticMat);
          frontStrap.position.set(elasticX, 0, frontZ + elasticThick / 2);
          frontStrap.castShadow = !isSoftwareGl;
          agendaGroup.add(frontStrap);

          const capStrapGeo = new THREE.BoxGeometry(
            elasticWidth,
            elasticThick,
            T + boardThick + 0.028
          );
          geometries.push(capStrapGeo);

          const topStrap = new THREE.Mesh(capStrapGeo, elasticMat);
          topStrap.position.set(elasticX, H / 2 + 0.008, 0);
          agendaGroup.add(topStrap);

          const bottomStrap = new THREE.Mesh(capStrapGeo, elasticMat);
          bottomStrap.position.set(elasticX, -H / 2 - 0.008, 0);
          agendaGroup.add(bottomStrap);

          const backTabGeo = new THREE.BoxGeometry(
            elasticWidth,
            H * 0.22,
            elasticThick
          );
          geometries.push(backTabGeo);

          const topBackTab = new THREE.Mesh(backTabGeo, elasticMat);
          topBackTab.position.set(
            elasticX,
            H / 2 - H * 0.1,
            backZ - elasticThick / 2
          );
          agendaGroup.add(topBackTab);

          const bottomBackTab = new THREE.Mesh(backTabGeo, elasticMat);
          bottomBackTab.position.set(
            elasticX,
            -H / 2 + H * 0.1,
            backZ - elasticThick / 2
          );
          agendaGroup.add(bottomBackTab);

          const eyeletGeo = new THREE.CylinderGeometry(
            0.026,
            0.026,
            0.022,
            16
          );
          eyeletGeo.rotateX(Math.PI / 2);
          geometries.push(eyeletGeo);

          const topEyelet = new THREE.Mesh(eyeletGeo, eyeletMat);
          topEyelet.position.set(elasticX, H * 0.3, backZ - 0.006);
          agendaGroup.add(topEyelet);

          const bottomEyelet = new THREE.Mesh(eyeletGeo, eyeletMat);
          bottomEyelet.position.set(elasticX, -H * 0.3, backZ - 0.006);
          agendaGroup.add(bottomEyelet);
        }

        if (!isSoftwareGl) {
          renderer.compile(scene, camera);
        }

        // Render exact front frame first so crossfade from 2D flat cover has zero visual jump
        lastTimeMs = performance.now();
        renderer.render(scene, camera);
        callbacksRef.current.onReady();

        // Schedule brief presentation rotation right as crossfade reveals the 3D scene
        if (!reducedMotionRef.current) {
          introTimer = window.setTimeout(() => {
            if (!disposed) {
              setCameraTargetAngles(-0.52, Math.PI / 2 - 0.12, baseCamZ);
            }
          }, 260);
        }
      }
    );

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
          requestRender();
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      if (introTimer !== null) window.clearTimeout(introTimer);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', handleControlsStart);
      controls.removeEventListener('change', requestRender);
      controls.dispose();

      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
    };
  }, [agenda]);

  return (
    <div
      ref={mountRef}
      data-testid="agenda-3d-canvas-container"
      className="w-full h-full relative cursor-grab active:cursor-grabbing"
      aria-label={`Visor 3D interactivo de ${agenda.name}. Arrastrá para girar 360 grados.`}
    />
  );
};
