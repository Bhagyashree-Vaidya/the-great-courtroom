import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadAnya, makeAnya, addAnyaLights } from '../anyaModel';

/**
 * A small live 3D Anya for a thinker card. Each persona has a base pose plus a
 * gentle looping idle animation so the cards feel alive instead of stiff.
 * Pauses rendering while off screen (IntersectionObserver) to spare the GPU.
 */

// Base head/body pose + per-frame idle motion + a recognizable prop, chosen so
// each card is obviously different even in a still frame. Strong angles because
// the model has no facial morphs to differentiate expressions.
const PERSONA = {
  // Turned away over the shoulder, arms-crossed body twist: "prove it."
  contrarian: {
    base: { head: [-0.05, 0.75, 0.12], body: -0.5 },
    idle: (t, p) => { p.head.y = 0.75 + Math.sin(t * 0.8) * 0.12; },
    prop: 'cross',
  },
  // Head down, studying a little stack of blocks (rebuild from basics).
  first_principles: {
    base: { head: [0.45, -0.1, 0.05], body: 0.12 },
    idle: (t, p) => { p.head.x = 0.45 + Math.sin(t * 1.0) * 0.07; },
    prop: 'blocks',
  },
  // Gazing up and out at floating sparks of possibility.
  expansionist: {
    base: { head: [-0.4, 0.18, -0.05], body: 0.18 },
    idle: (t, p) => {
      p.head.y = 0.18 + Math.sin(t * 0.6) * 0.28;
      p.head.x = -0.4 + Math.cos(t * 0.9) * 0.06;
    },
    prop: 'sparks',
  },
  // Front and center, holding a mic out for the interview.
  outsider: {
    base: { head: [0.06, -0.12, 0], body: 0.04 },
    idle: (t, p) => { p.head.x = 0.06 + Math.abs(Math.sin(t * 1.4)) * 0.08; },
    prop: 'mic',
  },
  // Hard head tilt + a magnifying glass: stress-testing for cracks.
  skeptic: {
    base: { head: [0.1, -0.35, -0.38], body: 0.2 },
    idle: (t, p) => { p.head.z = -0.38 + Math.sin(t * 0.9) * 0.06; },
    prop: 'magnifier',
  },
};

function buildProp(kind) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x3b332b, roughness: 0.6 });
  if (kind === 'mic') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 16), dark);
    const foam = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0x7b6758, roughness: 0.9 })
    );
    foam.position.y = 0.34;
    g.add(handle, foam);
    g.position.set(0.6, -0.55, 1.2);
    g.rotation.z = -0.4;
  } else if (kind === 'magnifier') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.05, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0x7b6758, roughness: 0.6 })
    );
    const glass = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 28),
      new THREE.MeshStandardMaterial({ color: 0xbcd6e0, transparent: true, opacity: 0.4, roughness: 0.2 })
    );
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 12), dark);
    handle.position.set(0.2, -0.32, 0);
    handle.rotation.z = -0.8;
    g.add(ring, glass, handle);
    g.position.set(0.78, -0.05, 1.4);
  } else if (kind === 'blocks') {
    const colors = [0xc98e72, 0xb8c4b1, 0xd8b7b1];
    for (let i = 0; i < 3; i++) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.28, 0.28),
        new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.7 })
      );
      cube.position.set(-0.05 + (i % 2) * 0.1, -0.7 + i * 0.29, 1.3);
      cube.rotation.y = 0.4 + i * 0.2;
      g.add(cube);
    }
    g.position.set(0.7, 0, 0);
  } else if (kind === 'sparks') {
    const mat = new THREE.MeshStandardMaterial({ color: 0xc98e72, emissive: 0x7b6758, roughness: 0.5 });
    [[0.7, 1.3, 1.1, 0.09], [1.0, 0.9, 1.0, 0.06], [0.5, 0.95, 1.2, 0.05]].forEach(([x, y, z, r]) => {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(r), mat);
      s.position.set(x, y, z);
      g.add(s);
    });
  } else if (kind === 'cross') {
    // small "no / opposed" mark: two crossed bars
    const bar = () => new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xc98e72, roughness: 0.6 }));
    const a = bar(); a.rotation.z = 0.78;
    const b = bar(); b.rotation.z = -0.78;
    g.add(a, b);
    g.position.set(0.85, 0.7, 1.2);
  }
  return g;
}

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

        if (persona.prop) scene.add(buildProp(persona.prop));
        renderer.render(scene, camera); // one immediate frame
      })
      .catch(() => {});

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
