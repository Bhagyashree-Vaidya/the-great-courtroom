import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Anya peeking over the password field (renders /anya.glb).
 * Her head turns to follow the pointer, and follows the caret while typing.
 * Moods: neutral (idle bob), shocked (head shake), happy (bounce).
 * Falls back to nothing on load failure (parent shows the SVG face instead).
 */
export default function AnyaPeek({ mood, lookTargetRef, onLoadError }) {
  const mountRef = useRef(null);
  const moodRef = useRef(mood);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 5.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfff7ec, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.5, 2.5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8b7b1, 0.5);
    fill.position.set(-2, 0.5, 2);
    scene.add(fill);

    let model = null;
    let headNode = null;
    let disposed = false;
    let frameId = 0;
    let shockT = 0; // shake timer
    let happyT = 0; // bounce timer
    let prevMood = 'neutral';
    let baseY = 0;

    const loader = new GLTFLoader();
    loader.load(
      '/anya.glb',
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;

        // Center and scale so she fits the frame, peeking from the bottom.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        // Zoom on head + hands; her lower body gets cropped by the canvas
        // bottom, which hides behind the opaque password input ("peeking").
        const scale = 4.6 / size.y;
        model.scale.setScalar(scale);
        model.position.set(
          -center.x * scale,
          -center.y * scale - 1.05,
          -center.z * scale
        );

        const group = new THREE.Group();
        group.add(model);
        scene.add(group);
        model = group;
        baseY = group.position.y;

        // The head is its own node in this model — rotate it to track.
        headNode = gltf.scene.getObjectByName('headobject') || gltf.scene;
        if (import.meta.env.DEV) window.__anya = { headNode, model, gltfScene: gltf.scene, lookTargetRef, targetRot };
      },
      undefined,
      () => {
        setFailed(true);
        onLoadError?.();
      }
    );

    const clock = new THREE.Clock();
    const targetRot = { x: 0, y: 0 };

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const m = moodRef.current;

      if (model) {
        // Pointer / caret target -> desired head rotation.
        const tgt = lookTargetRef.current;
        if (tgt && mountRef.current) {
          const r = mountRef.current.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height * 0.42; // approx her eye line
          const nx = THREE.MathUtils.clamp((tgt.x - cx) / (window.innerWidth / 2), -1, 1);
          const ny = THREE.MathUtils.clamp((tgt.y - cy) / (window.innerHeight / 2), -1, 1);
          targetRot.y = nx * 0.55;
          targetRot.x = ny * 0.35;
        }

        // Mood transitions
        if (m !== prevMood) {
          if (m === 'shocked') shockT = 0.55;
          if (m === 'happy') happyT = 1.0;
          prevMood = m;
        }

        const dt = clock.getDelta();

        if (shockT > 0) {
          // quick "no-no" head shake
          shockT = Math.max(0, shockT - dt);
          headNode.rotation.y = Math.sin(t * 38) * 0.22 * (shockT / 0.55);
          headNode.rotation.x = 0;
        } else if (headNode) {
          headNode.rotation.y += (targetRot.y - headNode.rotation.y) * 0.12;
          headNode.rotation.x += (targetRot.x - headNode.rotation.x) * 0.12;
        }

        // Idle bob + happy bounce
        let bounce = 0;
        if (happyT > 0) {
          happyT = Math.max(0, happyT - dt);
          bounce = Math.abs(Math.sin((1 - happyT) * Math.PI * 3)) * 0.18 * happyT;
        }
        model.position.y = baseY + Math.sin(t * 1.8) * 0.02 + bounce;
        model.rotation.y = Math.sin(t * 0.7) * 0.03;
      }

      renderer.render(scene, camera);
    };
    animate();
    if (import.meta.env.DEV) window.__anyaTick = animate;

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((mm) => {
            Object.values(mm).forEach((v) => v?.isTexture && v.dispose());
            mm.dispose();
          });
        }
      });
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed) return null;

  return <div className="anya-peek" ref={mountRef} aria-hidden="true" />;
}
