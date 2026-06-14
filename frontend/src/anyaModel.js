import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Loads /anya.glb once and hands out clones. The model has no skinned meshes
 * (skins: 0), so a plain scene clone is safe and shares geometry/material
 * references, keeping memory low across the five thinker cards + login.
 *
 * IMPORTANT: never dispose() the geometries/materials of a clone — they are
 * shared with the cached source and every other clone, so disposing one blanks
 * the rest. Only dispose renderers and uniquely-created props.
 */
let loadPromise = null;

export function loadAnya() {
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      new GLTFLoader().load('/anya.glb', (gltf) => resolve(gltf.scene), undefined, reject);
    });
  }
  return loadPromise;
}

/**
 * Clone the model and reparent head + hair + eyes into one pivot group at the
 * head's center, so head rotation keeps the hair and eyes attached.
 * Returns { group, pivot (head), hand, eye }.
 */
export function makeAnya(source) {
  const root = source.clone(true);

  const group = new THREE.Group();
  group.add(root);

  const headObj = root.getObjectByName('headobject');
  const hairObj = root.getObjectByName('hair');
  const eye = root.getObjectByName('eye');
  const hand = root.getObjectByName('hand');

  let pivot = null;
  if (headObj) {
    group.updateMatrixWorld(true);
    const headCenter = new THREE.Box3().setFromObject(headObj).getCenter(new THREE.Vector3());
    const parent = headObj.parent;
    pivot = new THREE.Group();
    parent.add(pivot);
    pivot.position.copy(parent.worldToLocal(headCenter.clone()));
    pivot.updateMatrixWorld(true);
    [headObj, hairObj, eye].forEach((n) => n && pivot.attach(n));
  }

  return { group, pivot, hand, eye };
}

/** Standard 3-point-ish warm lighting for an Anya scene. */
export function addAnyaLights(scene) {
  scene.add(new THREE.AmbientLight(0xfff7ec, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(1.5, 2.5, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xd8b7b1, 0.5);
  fill.position.set(-2, 0.5, 2);
  scene.add(fill);
}
