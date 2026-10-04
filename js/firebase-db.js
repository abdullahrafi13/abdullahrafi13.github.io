import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

var cfg = window.FIREBASE_CONFIG || {};
var PLACEHOLDER = /^YOUR_|placeholder/i;
var COLLECTION = "portfolio";
var DOC_ID = "main";
var FETCH_TIMEOUT_MS = 12000;
var SAVE_TIMEOUT_MS = 20000;

function isFilled(value) {
  return typeof value === "string" && value.trim() !== "" && !PLACEHOLDER.test(value.trim());
}

function isConfigured() {
  return isFilled(cfg.apiKey) && isFilled(cfg.authDomain) && isFilled(cfg.projectId) && isFilled(cfg.appId);
}

function withTimeout(promise, ms, label) {
  var settled = false;
  var timeout = new Promise(function (_, reject) {
    window.setTimeout(function () {
      if (settled) return;
      var err = new Error(label || "The request timed out.");
      err.code = "firestore/timeout";
      reject(err);
    }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).then(function (value) {
      settled = true;
      return value;
    }),
    timeout,
  ]);
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

function stripUndefined(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  var out = {};
  Object.keys(value).forEach(function (key) {
    var next = stripUndefined(value[key]);
    if (next !== undefined) out[key] = next;
  });
  return out;
}

function normalizeContent(raw) {
  if (!raw || typeof raw !== "object") return null;
  var content = {
    site: raw.site || {},
    hero: raw.hero || {},
    about: raw.about || {},
    skills: raw.skills || {},
    projectsSection: raw.projectsSection || {},
    contact: raw.contact || {},
    projects: Array.isArray(raw.projects) ? raw.projects : [],
  };
  return content;
}

var db = null;
var initError = null;

if (isConfigured()) {
  try {
    db = getFirestore(getOrInitApp());
  } catch (err) {
    initError = err;
    db = null;
  }
}

function portfolioRef() {
  return doc(db, COLLECTION, DOC_ID);
}

function fetchContent() {
  if (!db) {
    return Promise.resolve(null);
  }
  return withTimeout(getDoc(portfolioRef()), FETCH_TIMEOUT_MS, "Loading portfolio from Firestore timed out.")
    .then(function (snap) {
      if (!snap.exists()) return null;
      return normalizeContent(snap.data());
    })
    .catch(function (err) {
      console.warn("[PortfolioFirestore] fetch failed:", err);
      throw err;
    });
}

function saveContent(data) {
  if (!db) {
    var missing = new Error("Firestore is not configured.");
    missing.code = "firestore/not-configured";
    return Promise.reject(missing);
  }
  var payload = stripUndefined(normalizeContent(data));
  if (!payload) {
    var invalid = new Error("Invalid portfolio content.");
    invalid.code = "firestore/invalid-data";
    return Promise.reject(invalid);
  }
  payload.updatedAt = serverTimestamp();
  return withTimeout(setDoc(portfolioRef(), payload), SAVE_TIMEOUT_MS, "Saving portfolio to Firestore timed out.");
}

window.PortfolioFirestore = {
  isConfigured: isConfigured,
  initError: initError,
  collection: COLLECTION,
  docId: DOC_ID,
  fetchContent: fetchContent,
  saveContent: saveContent,
};

window.dispatchEvent(new Event("portfolio-firestore-ready"));
