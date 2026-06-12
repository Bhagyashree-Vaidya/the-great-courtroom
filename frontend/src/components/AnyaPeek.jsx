import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Anya behind the password field (renders /anya.glb).
 * Her hands rest on the input's top edge and tap idly; her head follows the
 * pointer and the caret. While the field is focused she squints into a smirk
 * and tilts her head (scheming). Moods: shocked = head shake, happy = bounce.
 * Falls back to nothing on load failure (parent shows the SVG face instead).
 */
export default function AnyaPeek({ mood, lookTargetRef, typingRef, onLoadError }) {
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
    let handNode = null;
    let eyeNode = null;
    let disposed = false;
    let frameId = 0;
    let shockT = 0;
    let happyT = 0;
    let prevMood = 'neutral';
    let baseY = 0;
    let handBaseRot = 0;

    // Bottom edge of the visible frustum at the model plane (z≈0).
    const frustumHalfH = camera.position.z * Math.tan((camera.fov / 2) * (Math.PI / 180));

    const loader = new GLTFLoader();
    loader.load(
      '/anya.glb',
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 4.6 / size.y;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

        const group = new THREE.Group();
        group.add(model);
        scene.add(group);

        // Head, hair, and eyes are sibling nodes with different pivots.
        // Reparent them into one pivot group at the head's center so they
        // rotate together (THREE.Object3D.attach preserves world transforms).
        const headObj = gltf.scene.getObjectByName('headobject');
        const hairObj = gltf.scene.getObjectByName('hair');
        const eyeObj = gltf.scene.getObjectByName('eye');
        handNode = gltf.scene.getObjectByName('hand');
        eyeNode = eyeObj;
        handBaseRot = handNode ? handNode.rotation.x : 0;

        if (headObj) {
          group.updateMatrixWorld(true);
          const headCenter = new THREE.Box3()
            .setFromObject(headObj)
            .getCenter(new THREE.Vector3());
          const parent = headObj.parent;
          const pivot = new THREE.Group();
          parent.add(pivot);
          pivot.position.copy(parent.worldToLocal(headCenter.clone()));
          pivot.updateMatrixWorld(true);
          [headObj, hairObj, eyeObj].forEach((n) => n && pivot.attach(n));
          headNode = pivot;
        } else {
          headNode = gltf.scene;
        }

        // Place her so the HANDS sit right at the canvas bottom edge — the
        // input field overlaps that edge, so they read as resting on it.
        if (handNode) {
          group.updateMatrixWorld(true);
          const handBox = new THREE.Box3().setFromObject(handNode);
          const handY = (handBox.min.y + handBox.max.y) / 2;
          group.position.y = -frustumHalfH + 0.55 - handY;
        } else {
          group.position.y = -1.05;
        }

        model = group;
        baseY = group.position.y;

        if (import.meta.env.DEV) {
          window.__anya = { headNode, handNode, eyeNode, model, lookTargetRef, targetRot };
        }
      },
      undefined,
      () => {
        setFailed(true);
        onLoadError?.();
      }
    );

    const clock = new THREE.Clock();
    const targetRot = { x: 0, y: 0 };
    let smirk = 0; // 0..1 lerped typing intensity

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const m = moodRef.current;
      const typing = !!typingRef?.current;

      if (model) {
        const tgt = lookTargetRef.current;
        if (tgt && mountRef.current) {
          const r = mountRef.current.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height * 0.42;
          const nx = THREE.MathUtils.clamp((tgt.x - cx) / (window.innerWidth / 2), -1, 1);
          const ny = THREE.MathUtils.clamp((tgt.y - cy) / (window.innerHeight / 2), -1, 1);
          targetRot.y = nx * 0.55;
          targetRot.x = ny * 0.35;
        }

        if (m !== prevMood) {
          if (m === 'shocked') shockT = 0.55;
          if (m === 'happy') happyT = 1.0;
          prevMood = m;
        }

        const dt = clock.getDelta();

        // Smirk while typing: squinted eyes + sly head tilt.
        smirk += ((typing ? 1 : 0) - smirk) * 0.08;
        if (eyeNode) eyeNode.scale.y = 1 - smirk * 0.45;

        if (shockT > 0) {
          shockT = Math.max(0, shockT - dt);
          if (headNode) {
            headNode.rotation.y = Math.sin(t * 38) * 0.22 * (shockT / 0.55);
            headNode.rotation.x = 0;
          }
        } else if (headNode) {
          headNode.rotation.y += (targetRot.y - headNode.rotation.y) * 0.12;
          headNode.rotation.x += (targetRot.x - headNode.rotation.x) * 0.12;
        }
        if (headNode) headNode.rotation.z = smirk * 0.14;

        // Hands tap on the field: quicker while typing, lazy when idle.
        if (handNode) {
          const speed = typing ? 9 : 2.2;
          const amp = typing ? 0.1 : 0.05;
          handNode.rotation.x = handBaseRot + Math.abs(Math.sin(t * speed)) * amp;
        }

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
