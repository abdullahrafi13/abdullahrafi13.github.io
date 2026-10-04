import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

var cfg = window.FIREBASE_CONFIG || {};
var PLACEHOLDER = /^YOUR_|placeholder/i;

/** Easy-to-change STL size limit (bytes). Default: 50 MB. */
var STL_MAX_BYTES = 50 * 1024 * 1024;

function isFilled(value) {
  return typeof value === "string" && value.trim() !== "" && !PLACEHOLDER.test(value.trim());
}

function isConfigured() {
  return (
    isFilled(cfg.apiKey) &&
    isFilled(cfg.authDomain) &&
    isFilled(cfg.projectId) &&
    isFilled(cfg.appId) &&
    isFilled(cfg.storageBucket)
  );
}

function buildAppConfig() {
  return {
    apiKey: cfg.apiKey.trim(),
    authDomain: cfg.authDomain.trim(),
    projectId: cfg.projectId.trim(),
    storageBucket: (cfg.storageBucket || "").trim(),
    messagingSenderId: (cfg.messagingSenderId || "").trim(),
    appId: cfg.appId.trim(),
  };
}

function getOrInitApp() {
  if (getApps().length) return getApp();
  return initializeApp(buildAppConfig());
}

var storage = null;
var initError = null;

if (isConfigured()) {
  try {
    storage = getStorage(getOrInitApp());
  } catch (err) {
    initError = err;
    storage = null;
  }
}

function storagePathForProject(projectId) {
  var safeId = String(projectId || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return "portfolio/projects/" + (safeId || "untitled") + "/model.stl";
}

function formatBytes(bytes) {
  var n = Number(bytes) || 0;
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function validateStlFile(file) {
  if (!file) {
    var missing = new Error("No STL file selected.");
    missing.code = "stl/no-file";
    throw missing;
  }
  var name = String(file.name || "");
  var lower = name.toLowerCase();
  if (!lower.endsWith(".stl")) {
    var extErr = new Error("Only .stl files are allowed.");
    extErr.code = "stl/invalid-extension";
    throw extErr;
  }
  var type = String(file.type || "").toLowerCase();
  var allowedTypes = [
    "",
    "application/sla",
    "application/vnd.ms-pki.stl",
    "application/octet-stream",
    "model/stl",
    "model/x.stl-ascii",
    "model/x.stl-binary",
    "text/plain",
  ];
  if (type && allowedTypes.indexOf(type) === -1) {
    var typeErr = new Error("That file type is not accepted as an STL model.");
    typeErr.code = "stl/invalid-type";
    throw typeErr;
  }
  if (file.size > STL_MAX_BYTES) {
    var sizeErr = new Error(
      "STL file is too large (" +
        formatBytes(file.size) +
        "). Maximum allowed size is " +
        formatBytes(STL_MAX_BYTES) +
        "."
    );
    sizeErr.code = "stl/too-large";
    throw sizeErr;
  }
  return true;
}

function mapStorageError(err) {
  var code = (err && err.code) || "";
  if (code === "storage/unauthorized" || code === "storage/unauthenticated") {
    return "Not authorized to upload or delete STL files. Sign in as the admin account.";
  }
  if (code === "storage/canceled") return "Upload canceled.";
  if (code === "storage/retry-limit-exceeded") return "Upload failed after several retries. Check your connection.";
  if (code === "storage/object-not-found") return "STL file not found in Storage.";
  if (code === "stl/too-large" || code === "stl/invalid-extension" || code === "stl/invalid-type" || code === "stl/no-file") {
    return err.message;
  }
  return (err && err.message) || "Storage operation failed.";
}

function uploadStl(projectId, file, onProgress) {
  if (!storage) {
    var missing = new Error("Firebase Storage is not configured.");
    missing.code = "storage/not-configured";
    return Promise.reject(missing);
  }
  try {
    validateStlFile(file);
  } catch (err) {
    return Promise.reject(err);
  }

  var path = storagePathForProject(projectId);
  var objectRef = ref(storage, path);
  var metadata = {
    contentType: file.type || "model/stl",
    customMetadata: {
      originalName: String(file.name || "model.stl").slice(0, 180),
      projectId: String(projectId || ""),
    },
  };

  return new Promise(function (resolve, reject) {
    var task = uploadBytesResumable(objectRef, file, metadata);
    task.on(
      "state_changed",
      function (snapshot) {
        if (typeof onProgress === "function" && snapshot.totalBytes) {
          var pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(pct, snapshot.bytesTransferred, snapshot.totalBytes);
        }
      },
      function (err) {
        var mapped = new Error(mapStorageError(err));
        mapped.code = (err && err.code) || "storage/upload-failed";
        reject(mapped);
      },
      function () {
        getDownloadURL(task.snapshot.ref)
          .then(function (downloadURL) {
            resolve({
              name: file.name || "model.stl",
              storagePath: path,
              downloadURL: downloadURL,
              size: file.size || 0,
              contentType: metadata.contentType,
              uploadedAt: new Date().toISOString(),
            });
          })
          .catch(function (err) {
            var mapped = new Error(mapStorageError(err));
            mapped.code = (err && err.code) || "storage/url-failed";
            reject(mapped);
          });
      }
    );
  });
}

function deleteStl(storagePath) {
  if (!storagePath) return Promise.resolve();
  if (!storage) {
    var missing = new Error("Firebase Storage is not configured.");
    missing.code = "storage/not-configured";
    return Promise.reject(missing);
  }
  var objectRef = ref(storage, storagePath);
  return deleteObject(objectRef).catch(function (err) {
    if (err && err.code === "storage/object-not-found") return;
    var mapped = new Error(mapStorageError(err));
    mapped.code = (err && err.code) || "storage/delete-failed";
    throw mapped;
  });
}

window.PortfolioStorage = {
  isConfigured: isConfigured,
  initError: initError,
  STL_MAX_BYTES: STL_MAX_BYTES,
  formatBytes: formatBytes,
  validateStlFile: validateStlFile,
  storagePathForProject: storagePathForProject,
  uploadStl: uploadStl,
  deleteStl: deleteStl,
  mapError: mapStorageError,
};

window.dispatchEvent(new Event("portfolio-storage-ready"));
