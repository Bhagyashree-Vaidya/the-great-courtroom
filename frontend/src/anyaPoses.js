import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Renders Anya in five persona poses to PNG data URLs using one offscreen
 * renderer. Pose = node rotations on head/hand/eye + body turn + optional
 * mic prop (built from primitives for The Outsider).
 */

const POSES = {
  // "What if everyone is wrong?" — turned away, chin up, side-eye.
  contrarian: {
    head: { x: -0.12, y: 0.85, z: 0.05 },
    body: { y: -0.35 },
    eyeScaleY: 0.7,
  },
  // Thinking pose — head down and tilted, hand raised toward chin.
  first_principles: {
    head: { x: 0.32, y: -0.25, z: 0.2 },
    hand: { x: -1.1 },
    body: { y: 0.15 },
    eyeScaleY: 0.8,
  },
  // Searching pose — hand up like a visor, gazing into the distance.
  expansionist: {
    head: { x: -0.25, y: 0.55, z: 0 },
    hand: { x: -2.4 },
    body: { y: 0.25 },
    eyeScaleY: 1,
  },
  // Interview pose — holding a mic out front.
  outsider: {
    head: { x: 0.08, y: -0.2, z: 0 },
    hand: { x: -1.5 },
    body: { y: 0.1 },
    eyeScaleY: 1,
    mic: true,
  },
  // Squinting, head tilted: "prove it."
  skeptic: {
    head: { x: 0.1, y: -0.45, z: -0.22 },
    body: { y: 0.2 },
    eyeScaleY: 0.45,
  },
};

let cached = null;

export function generatePoseImages() {
  if (cached) return cached;
  cached = new Promise((resolve, reject) => {
    const W = 420;
    const H = 360;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(2);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
    camera.position.set(0, 0.5, 5.4);

    scene.add(new THREE.AmbientLight(0xfff7ec, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(1.5, 2.5, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8b7b1, 0.5);
    fill.position.set(-2, 0.5, 2);
    scene.add(fill);

    new GLTFLoader().load(
      '/anya.glb',
      (gltf) => {
        try {
          const inner = gltf.scene;
          const box = new THREE.Box3().setFromObject(inner);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const scale = 4.0 / size.y;
          inner.scale.setScalar(scale);
          inner.position.set(-center.x * scale, -center.y * scale - 0.9, -center.z * scale);

          const group = new THREE.Group();
          group.add(inner);
          scene.add(group);

          // Reparent head + hair + eyes into one pivot at the head's center
          // so they rotate together (the nodes have different pivots).
          const headObj = inner.getObjectByName('headobject');
          const hairObj = inner.getObjectByName('hair');
          const eye = inner.getObjectByName('eye');
          const hand = inner.getObjectByName('hand');

          let head = null;
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
            [headObj, hairObj, eye].forEach((n) => n && pivot.attach(n));
            head = pivot;
          }

          const base = {
            head: head ? head.rotation.clone() : null,
            hand: hand ? hand.rotation.clone() : null,
            eyeScaleY: eye ? eye.scale.y : 1,
            group: group.rotation.clone(),
          };

          // Simple mic prop: dark handle + foam ball, floating by her face.
          const mic = new THREE.Group();
          const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.055, 0.55, 16),
            new THREE.MeshStandardMaterial({ color: 0x3b332b, roughness: 0.6 })
          );
          const foam = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 20, 16),
            new THREE.MeshStandardMaterial({ color: 0x7b6758, roughness: 0.9 })
          );
          foam.position.y = 0.32;
          mic.add(handle, foam);
          mic.position.set(0.55, -0.55, 0.8);
          mic.rotation.z = -0.35;
          mic.visible = false;
          scene.add(mic);

          const images = {};
          for (const [name, pose] of Object.entries(POSES)) {
            // reset
            if (head && base.head) head.rotation.copy(base.head);
            if (hand && base.hand) hand.rotation.copy(base.hand);
            if (eye) eye.scale.y = base.eyeScaleY;
            group.rotation.copy(base.group);
            mic.visible = false;

            // apply
            if (head && pose.head) {
              head.rotation.x += pose.head.x || 0;
              head.rotation.y += pose.head.y || 0;
              head.rotation.z += pose.head.z || 0;
            }
            if (hand && pose.hand) {
              hand.rotation.x += pose.hand.x || 0;
            }
            if (pose.body) group.rotation.y = pose.body.y || 0;
            if (eye && pose.eyeScaleY != null) eye.scale.y *= pose.eyeScaleY;
            if (pose.mic) mic.visible = true;

            renderer.render(scene, camera);
            images[name] = renderer.domElement.toDataURL('image/png');
          }

          // cleanup
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

          resolve(images);
        } catch (e) {
          reject(e);
        }
      },
      undefined,
      reject
    );
  });
  return cached;
}
