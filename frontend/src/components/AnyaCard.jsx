import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadAnya, makeAnya, addAnyaLights } from '../anyaModel';

/**
 * A small live 3D Anya for a thinker card. Each persona has a base pose plus a
 * gentle looping idle animation so the cards feel alive instead of stiff.
 * Pauses rendering while off screen (IntersectionObserver) to spare the GPU.
 */

// Base head/body pose + per-frame idle motion for each persona.
const PERSONA = {
  contrarian: {
    base: { head: [-0.06, 0.45, 0.05], body: -0.18, squint: 0.25 },
    idle: (t, p) => { p.head.y = 0.45 + Math.sin(t * 0.8) * 0.3; },     // skeptical "no" sweep
  },
  first_principles: {
    base: { head: [0.26, -0.12, 0.12], body: 0.1, squint: 0.18 },
    idle: (t, p) => { p.head.x = 0.26 + Math.sin(t * 1.1) * 0.1; },     // thoughtful nod
  },
  expansionist: {
    base: { head: [-0.16, 0.0, 0.0], body: 0.08, squint: 0 },
    idle: (t, p) => {                                                    // scanning the horizon
      p.head.y = Math.sin(t * 0.6) * 0.5;
      p.head.x = -0.16 + Math.cos(t * 0.9) * 0.08;
    },
  },
  outsider: {
    base: { head: [0.05, -0.18, 0], body: 0.06, squint: 0, mic: true },
    idle: (t, p) => { p.head.x = 0.05 + Math.abs(Math.sin(t * 1.4)) * 0.09; }, // attentive bob
  },
  skeptic: {
    base: { head: [0.06, -0.22, -0.18], body: 0.14, squint: 0.5 },
    idle: (t, p) => { p.head.z = -0.18 + Math.sin(t * 0.9) * 0.07; },   // unconvinced sway
  },
};

export default function AnyaCard({ poseKey }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const persona = PERSONA[poseKey] || PERSONA.contrarian;
    let disposed = false;
    let frameId = 0;
    let onScreen = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.5, 5.2);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    // Force the canvas to FILL the slot via inline style, then drive the
    // drawing buffer off the laid-out size (updateStyle=false so three never
    // overwrites these). This sidesteps the "measured 0/transient width in a
    // flex+Suspense slot" race that left earlier canvases mis-sized.
    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    const sizeToMount = () => {
      const r = mount.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(sizeToMount);
    ro.observe(mount);
    sizeToMount();

    addAnyaLights(scene);

    let pivot = null;
    let eye = null;
    let group = null;
    let baseY = 0;
    const headPose = { x: 0, y: 0, z: 0 };
    const clock = new THREE.Clock();

    loadAnya()
      .then((source) => {
        if (disposed) return;
        const anya = makeAnya(source);
        group = anya.group;
        pivot = anya.pivot;
        eye = anya.eye;

        scene.add(group);
        group.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = 4.4 / size.y;
        group.scale.setScalar(scale);
        // Center horizontally; sink so head + shoulders fill the slot.
        group.position.set(-center.x * scale, -center.y * scale - 1.05, -center.z * scale);
        baseY = group.position.y;

        if (eye) eye.scale.y = 1 - (persona.base.squint || 0) * 0.5;

        if (persona.base.mic) addMic(scene);
        renderer.render(scene, camera); // one immediate frame
      })
      .catch(() => {});

    function addMic(scn) {
      const mic = new THREE.Group();
      const handle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, 0.6, 16),
        new THREE.MeshStandardMaterial({ color: 0x3b332b, roughness: 0.6 })
      );
      const foam = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 20, 16),
        new THREE.MeshStandardMaterial({ color: 0x7b6758, roughness: 0.9 })
      );
      foam.position.y = 0.34;
      mic.add(handle, foam);
      mic.position.set(0.6, -0.5, 1.0);
      mic.rotation.z = -0.4;
      scn.add(mic);
    }

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (!onScreen) return;
      const t = clock.getElapsedTime();
      if (group && pivot) {
        const b = persona.base;
        headPose.x = b.head[0];
        headPose.y = b.head[1];
        headPose.z = b.head[2];
        persona.idle(t, headPose);
        pivot.rotation.set(headPose.x, headPose.y, headPose.z);
        group.rotation.y = (b.body || 0) + Math.sin(t * 0.7) * 0.02;
        group.position.y = baseY + Math.sin(t * 1.6) * 0.02; // breathing
      }
      renderer.render(scene, camera);
    };
    animate();

    const io = new IntersectionObserver(
      ([e]) => { onScreen = e.isIntersecting; },
      { threshold: 0.01 }
    );
    io.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      ro.disconnect();
      io.disconnect();
      renderer.dispose(); // do NOT dispose shared model geometry/materials
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [poseKey]);

  return <div className="thinker-pose" ref={mountRef} aria-hidden="true" />;
}
