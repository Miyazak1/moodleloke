import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useI18n } from '../i18n/useI18n';

type SolidMode = 'cube' | 'cuboid' | 'cylinder' | 'cone' | 'sphere' | 'prism';

type SolidParams = {
  side: number;
  width: number;
  depth: number;
  height: number;
  radius: number;
};

function createTextSprite(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    context.font = '700 34px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 64, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(0.42, 0.21, 1);
  return sprite;
}

function createTriangularPrismGeometry(base: number, triangleHeight: number, length: number) {
  const x = base / 2;
  const y = triangleHeight;
  const z = length / 2;
  const vertices = new Float32Array([
    -x, 0, -z, x, 0, -z, 0, y, -z,
    -x, 0, z, 0, y, z, x, 0, z,
    -x, 0, -z, -x, 0, z, x, 0, z, x, 0, -z,
    x, 0, -z, x, 0, z, 0, y, z, 0, y, -z,
    0, y, -z, 0, y, z, -x, 0, z, -x, 0, -z
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildSolidGeometry(mode: SolidMode, params: SolidParams) {
  if (mode === 'cube') return new THREE.BoxGeometry(params.side, params.side, params.side);
  if (mode === 'cuboid') return new THREE.BoxGeometry(params.width, params.height, params.depth);
  if (mode === 'cylinder') return new THREE.CylinderGeometry(params.radius, params.radius, params.height, 64);
  if (mode === 'cone') return new THREE.ConeGeometry(params.radius, params.height, 64);
  if (mode === 'sphere') return new THREE.SphereGeometry(params.radius, 64, 32);
  return createTriangularPrismGeometry(params.width, params.depth, params.height);
}

function solidBounds(mode: SolidMode, params: SolidParams) {
  if (mode === 'cube') return { width: params.side, height: params.side, depth: params.side };
  if (mode === 'cuboid') return { width: params.width, height: params.height, depth: params.depth };
  if (mode === 'cylinder' || mode === 'cone') return { width: params.radius * 2, height: params.height, depth: params.radius * 2 };
  if (mode === 'sphere') return { width: params.radius * 2, height: params.radius * 2, depth: params.radius * 2 };
  return { width: params.width, height: params.depth, depth: params.height };
}

function createAxis(end: THREE.Vector3, material: THREE.LineDashedMaterial, label: string, color: string) {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), end]);
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  group.add(line);

  const sprite = createTextSprite(label, color);
  sprite.position.copy(end.clone().multiplyScalar(1.06));
  group.add(sprite);
  return group;
}

function disposeSceneObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineSegments || child instanceof THREE.Sprite) {
      child.geometry?.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    }
  });
}

export default function SolidGeometryCanvas({ mode, params, resetSignal }: { mode: SolidMode; params: SolidParams; resetSignal: number }) {
  const { t } = useI18n();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const solidGroupRef = useRef<THREE.Group | null>(null);
  const axisGroupRef = useRef<THREE.Group | null>(null);
  const groundRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f9fd);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(6.2, 4.8, 7.2);
    camera.lookAt(0, 0.55, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.dataset.testid = 'solid-three-canvas';
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 5;
    controls.maxDistance = 13;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.target.set(0, 0.45, 0);
    controls.update();
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 1.28));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(5, 7, 6);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xdbeafe, 1.1);
    rimLight.position.set(-4, 4, -5);
    scene.add(rimLight);

    const plane = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 96),
      new THREE.MeshBasicMaterial({ color: 0xdfe5ee, transparent: true, opacity: 0.48, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1.55;
    scene.add(plane);
    groundRef.current = plane;

    const axisGroup = new THREE.Group();
    scene.add(axisGroup);
    axisGroupRef.current = axisGroup;

    const resize = () => {
      const width = mount.clientWidth || 640;
      const height = mount.clientHeight || 420;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let raf = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse(disposeSceneObject);
      sceneRef.current = null;
      controlsRef.current = null;
      cameraRef.current = null;
      solidGroupRef.current = null;
      axisGroupRef.current = null;
      groundRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!scene) return;
    if (solidGroupRef.current) {
      scene.remove(solidGroupRef.current);
      disposeSceneObject(solidGroupRef.current);
    }

    const geometry = buildSolidGeometry(mode, params);
    geometry.center();
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0x7fadff,
        roughness: 0.68,
        metalness: 0.02,
        transparent: true,
        opacity: mode === 'sphere' ? 0.34 : 0.48,
        side: THREE.DoubleSide
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const helperEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 12),
      new THREE.LineDashedMaterial({ color: 0x6b88ba, dashSize: 0.13, gapSize: 0.09, transparent: true, opacity: 0.44 })
    );
    helperEdges.computeLineDistances();

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 12),
      new THREE.LineBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.94 })
    );

    group.add(mesh);
    group.add(helperEdges);
    group.add(edges);
    scene.add(group);
    solidGroupRef.current = group;

    const bounds = solidBounds(mode, params);
    const maxSize = Math.max(bounds.width, bounds.height, bounds.depth);
    const ground = groundRef.current;
    if (ground) {
      ground.position.y = -bounds.height / 2 - 0.04;
      ground.scale.setScalar(Math.max(1, maxSize / 4.2));
    }

    const axisGroup = axisGroupRef.current;
    if (axisGroup) {
      axisGroup.children.forEach(disposeSceneObject);
      axisGroup.clear();
      const axisLength = Math.max(3.8, maxSize * 0.82);
      const axisMaterial = {
        x: new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.7 }),
        y: new THREE.LineDashedMaterial({ color: 0x10b981, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.7 }),
        z: new THREE.LineDashedMaterial({ color: 0x3b82f6, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.7 })
      };
      axisGroup.add(createAxis(new THREE.Vector3(-axisLength * 0.58, 0, 0), axisMaterial.x, 'x', '#ef4444'));
      axisGroup.add(createAxis(new THREE.Vector3(0, axisLength, 0), axisMaterial.y, 'y', '#10b981'));
      axisGroup.add(createAxis(new THREE.Vector3(0, 0, axisLength * 0.72), axisMaterial.z, 'z', '#315dff'));
    }

    if (camera && controls) {
      const distance = Math.max(6.2, maxSize * 2.25);
      camera.position.set(distance * 0.72, distance * 0.55, distance * 0.82);
      controls.minDistance = Math.max(3.2, maxSize * 1.1);
      controls.maxDistance = Math.max(9, maxSize * 3.5);
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [mode, params]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const bounds = solidBounds(mode, params);
    const distance = Math.max(6.2, Math.max(bounds.width, bounds.height, bounds.depth) * 2.25);
    controls.object.position.set(distance * 0.72, distance * 0.55, distance * 0.82);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [mode, params, resetSignal]);

  return (
    <div className="special-solid-canvas-wrap" data-testid="solid-three-panel">
      <div ref={mountRef} className="special-solid-canvas" aria-label={t('common.solidCanvasAria', '立体几何 3D 画布')} />
      <span className="special-solid-canvas-label">{t('common.solidCanvasLabel', '3D 视图')}</span>
      <span className="special-solid-drag-hint">{t('common.solidCanvasHint', '拖动旋转 / 滚轮或双指缩放')}</span>
    </div>
  );
}
