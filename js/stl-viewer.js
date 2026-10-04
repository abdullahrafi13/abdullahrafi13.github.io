import * as THREE from "https://unpkg.com/three@0.170.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.170.0/examples/jsm/controls/OrbitControls.js";
import { STLLoader } from "https://unpkg.com/three@0.170.0/examples/jsm/loaders/STLLoader.js";

var activeViewer = null;

function disposeViewer(viewer) {
  if (!viewer) return;
  window.removeEventListener("resize", viewer.onResize);
  if (viewer.raf) cancelAnimationFrame(viewer.raf);
  if (viewer.controls) viewer.controls.dispose();
  if (viewer.renderer) {
    viewer.renderer.dispose();
    if (viewer.renderer.domElement && viewer.renderer.domElement.parentNode) {
      viewer.renderer.domElement.parentNode.removeChild(viewer.renderer.domElement);
    }
  }
  if (viewer.geometry) viewer.geometry.dispose();
  if (viewer.material) viewer.material.dispose();
}

function setText(el, text) {
  if (el) el.textContent = text || "";
}

function mountStlViewer(options) {
  var opts = options || {};
  var root = opts.root || document.getElementById("stl-viewer-canvas");
  var url = opts.url;
  var statusEl = opts.statusEl || document.getElementById("stl-viewer-status");
  var progressEl = opts.progressEl || document.getElementById("stl-viewer-progress");
  var hintEl = opts.hintEl || document.getElementById("stl-viewer-hint");

  if (!root || !url) return null;

  disposeViewer(activeViewer);
  activeViewer = null;
  root.innerHTML = "";
  setText(statusEl, "Loading 3D model…");
  setText(progressEl, "");
  if (hintEl) hintEl.classList.add("hidden");

  var width = root.clientWidth || 640;
  var height = Math.max(280, Math.round(width * 0.62));

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0f14);

  var camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 5000);
  camera.position.set(2.5, 1.8, 3.2);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.rotateSpeed = 0.85;
  controls.minDistance = 0.2;
  controls.maxDistance = 2000;

  var hemi = new THREE.HemisphereLight(0xdde6ff, 0x222833, 1.05);
  scene.add(hemi);
  var key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(4, 8, 5);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0x9eb6ff, 0.45);
  fill.position.set(-5, 2, -3);
  scene.add(fill);
  var rim = new THREE.DirectionalLight(0xffc9a3, 0.35);
  rim.position.set(0, 4, -6);
  scene.add(rim);

  var grid = new THREE.GridHelper(10, 20, 0x3a4254, 0x232833);
  grid.material.opacity = 0.45;
  grid.material.transparent = true;
  scene.add(grid);

  var viewer = {
    scene: scene,
    camera: camera,
    renderer: renderer,
    controls: controls,
    geometry: null,
    material: null,
    mesh: null,
    raf: 0,
    fitDistance: 4,
    defaultTarget: new THREE.Vector3(0, 0, 0),
    defaultPosition: camera.position.clone(),
    onResize: null,
  };

  function fitCameraToObject(mesh) {
    var box = new THREE.Box3().setFromObject(mesh);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    mesh.position.sub(center);

    box.setFromObject(mesh);
    size = box.getSize(new THREE.Vector3());
    center = box.getCenter(new THREE.Vector3());

    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    var fov = (camera.fov * Math.PI) / 180;
    var distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.55;
    distance = Math.max(distance, maxDim * 1.2);

    var direction = new THREE.Vector3(1.15, 0.75, 1.35).normalize();
    camera.position.copy(direction.multiplyScalar(distance));
    camera.near = Math.max(distance / 200, 0.01);
    camera.far = distance * 50;
    camera.updateProjectionMatrix();

    controls.target.set(0, Math.max(size.y * 0.05, 0), 0);
    controls.update();

    grid.scale.setScalar(Math.max(maxDim / 4, 0.5));
    grid.position.y = box.min.y;

    viewer.fitDistance = distance;
    viewer.defaultTarget.copy(controls.target);
    viewer.defaultPosition.copy(camera.position);
  }

  function animate() {
    viewer.raf = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  viewer.onResize = function () {
    var w = root.clientWidth || width;
    var h = Math.max(280, Math.round(w * 0.62));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener("resize", viewer.onResize);

  var loader = new STLLoader();
  loader.load(
    url,
    function (geometry) {
      geometry.computeVertexNormals();
      geometry.center();

      var material = new THREE.MeshStandardMaterial({
        color: 0xb7c0cc,
        metalness: 0.35,
        roughness: 0.42,
        flatShading: false,
      });
      var mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      viewer.geometry = geometry;
      viewer.material = material;
      viewer.mesh = mesh;
      fitCameraToObject(mesh);

      setText(statusEl, "");
      setText(progressEl, "");
      if (hintEl) {
        hintEl.textContent = "Drag to rotate · Scroll to zoom · Right-drag / two-finger to pan";
        hintEl.classList.remove("hidden");
      }
      animate();
    },
    function (event) {
      if (!event || !event.total) {
        setText(progressEl, "Downloading model…");
        return;
      }
      var pct = Math.round((event.loaded / event.total) * 100);
      setText(progressEl, pct + "%");
      setText(statusEl, "Loading 3D model…");
    },
    function () {
      setText(statusEl, "Could not load the 3D model. Check the file URL or try again later.");
      setText(progressEl, "");
      if (hintEl) hintEl.classList.add("hidden");
      disposeViewer(viewer);
      activeViewer = null;
    }
  );

  activeViewer = viewer;
  return {
    resetView: function () {
      if (!viewer.camera || !viewer.controls) return;
      viewer.camera.position.copy(viewer.defaultPosition);
      viewer.controls.target.copy(viewer.defaultTarget);
      viewer.controls.update();
    },
    toggleFullscreen: function () {
      var shell = root.closest(".stl-viewer-shell") || root;
      if (!document.fullscreenElement) {
        if (shell.requestFullscreen) shell.requestFullscreen().catch(function () {});
      } else if (document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      }
    },
    dispose: function () {
      disposeViewer(viewer);
      if (activeViewer === viewer) activeViewer = null;
    },
  };
}

window.StlViewer = {
  mount: mountStlViewer,
  disposeActive: function () {
    disposeViewer(activeViewer);
    activeViewer = null;
  },
};

window.dispatchEvent(new Event("stl-viewer-ready"));
