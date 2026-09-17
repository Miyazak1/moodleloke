import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useI18n } from '../i18n/useI18n';

type NewtonSample = {
  position: number;
  velocity: number;
};

type NewtonSecondLawCanvasProps = {
  force: number;
  mass: number;
  isPlaying: boolean;
  resetSignal: number;
  onSample?: (sample: NewtonSample) => void;
};

function createTextSprite(text: string, color = '#e5e7eb', width = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '800 34px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, 48);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(width / 220, 0.44, 1);
  return sprite;
}

function updateTextSprite(sprite: THREE.Sprite, text: string, color = '#e5e7eb', width = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (context) {
    context.font = '800 34px Arial';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, 48);
  }
  const material = sprite.material as THREE.SpriteMaterial;
  material.map?.dispose();
  material.map = new THREE.CanvasTexture(canvas);
  material.needsUpdate = true;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Sprite) {
      child.geometry?.dispose();
      const material = child.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material?.dispose();
    }
  });
}

export default function NewtonSecondLawCanvas({ force, mass, isPlaying, resetSignal, onSample }: NewtonSecondLawCanvasProps) {
  const { t } = useI18n();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const forceRef = useRef(force);
  const massRef = useRef(mass);
  const isPlayingRef = useRef(isPlaying);
  const onSampleRef = useRef(onSample);
  const bodyRef = useRef<THREE.Group | null>(null);
  const forceArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const accelerationArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const velocityArrowRef = useRef<THREE.ArrowHelper | null>(null);
  const forceLabelRef = useRef<THREE.Sprite | null>(null);
  const accelerationLabelRef = useRef<THREE.Sprite | null>(null);
  const massLabelRef = useRef<THREE.Sprite | null>(null);
  const trailLineRef = useRef<THREE.Line | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const positionRef = useRef(-3.2);
  const velocityRef = useRef(0);
  const trailRef = useRef<THREE.Vector3[]>([]);

  useEffect(() => {
    forceRef.current = force;
  }, [force]);

  useEffect(() => {
    massRef.current = mass;
    if (massLabelRef.current) updateTextSprite(massLabelRef.current, `${mass.toFixed(1)} kg`, '#475569', 256);
  }, [mass]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020204);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(7.8, 5.2, 7.4);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.domElement.dataset.testid = 'newton-three-canvas';
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.82;
    controls.target.set(0, 0.15, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.86));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db7ff, 0.9);
    rim.position.set(-5, 5, -4);
    scene.add(rim);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 8.4),
      new THREE.MeshStandardMaterial({ color: 0xb8bec9, roughness: 0.72, metalness: 0.02 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    const grid = new THREE.GridHelper(14, 28, 0x252d97, 0xe6edf7);
    grid.position.y = 0.012;
    scene.add(grid);

    const centerLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-6.6, 0.035, 0), new THREE.Vector3(6.6, 0.035, 0)]),
      new THREE.LineBasicMaterial({ color: 0x3031a3, transparent: true, opacity: 0.82 })
    );
    scene.add(centerLine);

    const body = new THREE.Group();
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.48, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x1d2bd8, roughness: 0.48 })
    );
    block.castShadow = true;
    block.position.y = 0.24;
    body.add(block);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.08, 0.52),
      new THREE.MeshStandardMaterial({ color: 0x2434cf, roughness: 0.55 })
    );
    base.position.set(0.18, 0.04, 0);
    base.castShadow = true;
    body.add(base);
    scene.add(body);
    bodyRef.current = body;

    const forceArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.54, 0.28, 0), 1.2, 0xef4444, 0.24, 0.13);
    const accelerationArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.52, 0.76, -0.18), 0.9, 0x22c55e, 0.2, 0.11);
    const velocityArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-0.42, 0.16, 0.24), 0.55, 0x3b82f6, 0.16, 0.08);
    body.add(forceArrow);
    body.add(accelerationArrow);
    body.add(velocityArrow);
    forceArrowRef.current = forceArrow;
    accelerationArrowRef.current = accelerationArrow;
    velocityArrowRef.current = velocityArrow;

    const forceLabel = createTextSprite('F', '#ef4444', 128);
    forceLabel.position.set(1.28, 0.52, 0.02);
    body.add(forceLabel);
    forceLabelRef.current = forceLabel;

    const accelerationLabel = createTextSprite('a', '#22c55e', 128);
    accelerationLabel.position.set(1.0, 0.96, -0.2);
    body.add(accelerationLabel);
    accelerationLabelRef.current = accelerationLabel;

    const massLabel = createTextSprite(`${massRef.current.toFixed(1)} kg`, '#475569', 256);
    massLabel.position.set(0, 1.05, 0);
    scene.add(massLabel);
    massLabelRef.current = massLabel;

    const trailLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(positionRef.current, 0.05, 0)]),
      new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.78 })
    );
    scene.add(trailLine);
    trailLineRef.current = trailLine;

    const resize = () => {
      const width = mount.clientWidth || 720;
      const height = mount.clientHeight || 520;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let raf = 0;
    let last = performance.now();
    let frame = 0;

    const updateLabels = () => {
      const acceleration = forceRef.current / massRef.current;
      const forceLength = Math.max(0.45, Math.min(1.8, forceRef.current / 10));
      const accelerationLength = Math.max(0.38, Math.min(1.6, acceleration / 4));
      const velocityLength = Math.max(0.28, Math.min(1.4, Math.abs(velocityRef.current) / 2.5));
      forceArrowRef.current?.setLength(forceLength, 0.24, 0.13);
      accelerationArrowRef.current?.setLength(accelerationLength, 0.2, 0.11);
      velocityArrowRef.current?.setLength(velocityLength, 0.16, 0.08);

      const currentMassLabel = massLabelRef.current;
      if (currentMassLabel) {
        currentMassLabel.position.set(positionRef.current, 1.1, 0);
      }
    };

    const animate = (time: number) => {
      const dt = Math.min(0.045, (time - last) / 1000);
      last = time;
      const acceleration = forceRef.current / massRef.current;
      if (isPlayingRef.current) {
        velocityRef.current += acceleration * dt * 0.42;
        positionRef.current += velocityRef.current * dt * 0.72;
        if (positionRef.current > 5.4) {
          positionRef.current = -4.7;
          velocityRef.current = 0;
          trailRef.current = [];
        }
      }

      const bodyObject = bodyRef.current;
      if (bodyObject) bodyObject.position.x = positionRef.current;
      updateLabels();

      trailRef.current.push(new THREE.Vector3(positionRef.current, 0.06, 0));
      if (trailRef.current.length > 90) trailRef.current.shift();
      if (trailLineRef.current) {
        trailLineRef.current.geometry.dispose();
        trailLineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(trailRef.current);
      }

      frame += 1;
      if (frame % 8 === 0) {
        onSampleRef.current?.({ position: positionRef.current, velocity: velocityRef.current });
      }
      controls.update();
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };
    raf = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse(disposeObject);
      sceneRef.current = null;
      bodyRef.current = null;
      forceArrowRef.current = null;
      accelerationArrowRef.current = null;
      velocityArrowRef.current = null;
      trailLineRef.current = null;
      forceLabelRef.current = null;
      accelerationLabelRef.current = null;
      massLabelRef.current = null;
    };
  }, []);

  useEffect(() => {
    positionRef.current = -3.2;
    velocityRef.current = 0;
    trailRef.current = [];
    onSampleRef.current?.({ position: positionRef.current, velocity: velocityRef.current });
  }, [resetSignal]);

  return (
    <div className="newton-canvas-wrap" data-testid="newton-three-panel">
      <div ref={mountRef} className="newton-canvas" aria-label={t('common.newtonCanvasAria', '牛顿第二定律 3D 模拟画布')} />
      <span className="newton-canvas-hint">{t('common.newtonCanvasHint', '拖动旋转 / 滚轮缩放')}</span>
    </div>
  );
}
