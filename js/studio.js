// Studio: render Cak Darjo (dan nanti adegan video) dengan kamera yang bisa diatur dari luar.
import * as THREE from 'three';
import { makeCakDarjo, buatAkuarium } from './world.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#fff8ec');
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
scene.add(new THREE.HemisphereLight('#ffffff', '#b9a789', 1.4));
const sun = new THREE.DirectionalLight('#fff4dc', 2.0);
sun.position.set(3, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
scene.add(sun);
const lantai = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 6), new THREE.MeshLambertMaterial({ color: '#8fcb63' }));
lantai.position.y = -0.06; lantai.receiveShadow = true; scene.add(lantai);

const darjo = makeCakDarjo();
scene.add(darjo);

const view = { az: 0, el: 8, dist: 6, ty: 1.25, t: 0 };
function render() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const a = view.az * Math.PI / 180, e = view.el * Math.PI / 180;
  camera.position.set(Math.sin(a) * Math.cos(e) * view.dist, view.ty + Math.sin(e) * view.dist, Math.cos(a) * Math.cos(e) * view.dist);
  camera.lookAt(0, view.ty, 0);
  if (darjo.userData.tick) darjo.userData.tick(view.t);
  renderer.render(scene, camera);
}
const solo = buatAkuarium(); solo.group.visible = false; solo.group.scale.setScalar(2.2); solo.group.position.y = 1.0; scene.add(solo.group);
window.studio = {
  akuarium(on) { solo.group.visible = on; darjo.visible = !on; solo.tick(view.t); render(); },
  set(v) { Object.assign(view, v); if (v.bg === 'transparan') scene.background = null; else if (v.bg) { scene.background = scene.background || new THREE.Color(); scene.background.set(v.bg); } lantai.visible = v.lantai !== false; render(); },
  ekspresi(m) { darjo.userData.ekspresi(m); render(); },
  lambai(on) { const arm = darjo.children.find(c => c.isGroup && c.position.x > 0.3 && c.position.y > 1.1); if (arm) { arm.rotation.set(on ? 0 : -0.95, 0, on ? 2.5 : -0.55); } render(); },
  render,
};
addEventListener('resize', render);
render();
window.studioSiap = true;
