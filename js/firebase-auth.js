import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  browserSessionPersistence,
  confirmPasswordReset,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  verifyPasswordResetCode,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

var cfg = window.FIREBASE_CONFIG || {};
var PLACEHOLDER = /^YOUR_|placeholder/i;
var AUTH_TIMEOUT_MS = 20000;

function isFilled(value) {
  return typeof value === "string" && value.trim() !== "" && !PLACEHOLDER.test(value.trim());
}

function isConfigured() {
  return (
    isFilled(cfg.apiKey) &&
    isFilled(cfg.authDomain) &&
    isFilled(cfg.projectId) &&
    isFilled(cfg.appId) &&
    isFilled(cfg.allowedAdminEmail)
  );
}

function allowedEmail() {
  return String(cfg.allowedAdminEmail || "")
    .trim()
    .toLowerCase();
}

function continueUrl() {
  return new URL("admin.html", window.location.href).href.split("?")[0].split("#")[0];
}

function isAllowedUser(user) {
  if (!user || !user.email) return false;
  return user.email.trim().toLowerCase() === allowedEmail();
}

function withTimeout(promise, label) {
  var settled = false;
  var timeout = new Promise(function (_, reject) {
    window.setTimeout(function () {
      if (settled) return;
      var err = new Error(label || "The request timed out. Check your connection and Firebase Authorized domains, then try again.");
      err.code = "admin/timeout";
      reject(err);
    }, AUTH_TIMEOUT_MS);
  });
  return Promise.race([
    Promise.resolve(promise).then(function (value) {
      settled = true;
      return value;
    }),
    timeout,
  ]);
}

var auth = null;
var currentUser = null;
var initError = null;

if (isConfigured()) {
  try {
    var appConfig = {
      apiKey: cfg.apiKey.trim(),
      authDomain: cfg.authDomain.trim(),
      projectId: cfg.projectId.trim(),
      storageBucket: (cfg.storageBucket || "").trim(),
      messagingSenderId: (cfg.messagingSenderId || "").trim(),
      appId: cfg.appId.trim(),
    };
    var app = getApps().length ? getApp() : initializeApp(appConfig);
    try {
      auth = initializeAuth(app, { persistence: browserSessionPersistence });
    } catch (persistErr) {
      auth = getAuth(app);
    }
  } catch (err) {
    initError = err;
    auth = null;
  }
}

function notConfigured() {
  var error = new Error("not-configured");
  error.code = "admin/not-configured";
  return Promise.reject(error);
}

function mapError(err) {
  var code = (err && err.code) || "";
  if (code === "admin/not-configured") {
    return "Authentication is not configured yet. Add your Firebase values in js/firebase-config.js.";
  }
  if (code === "admin/timeout") {
    return err.message || "The request timed out. Try again.";
  }
  if (code === "admin/unauthorized") {
    return "This account is not authorized to use the admin panel.";
  }
  if (code === "auth/invalid-email" || code === "auth/missing-email") return "Enter a valid email address.";
  if (code === "auth/weak-password") return "Use at least 8 characters for your password.";
  if (code === "auth/expired-action-code") return "This reset link has expired. Request a new one.";
  if (code === "auth/invalid-action-code") {
    return "This reset link is invalid or has already been used. Request a new one.";
  }
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  if (code === "auth/network-request-failed") return "Could not reach Firebase. Check your connection.";
  if (code === "auth/operation-not-allowed") {
    return "Email/Password sign-in is disabled in the Firebase Console.";
  }
  if (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri") {
    return "Add this site’s domain to Firebase Authentication → Settings → Authorized domains.";
  }
  if (code === "auth/requires-recent-login") {
    return "For security, sign in again before changing your password.";
  }
  if (
    code === "auth/invalid-credential" ||
    code === "auth/user-not-found" ||
    code === "auth/wrong-password" ||
    code === "auth/user-disabled"
  ) {
    return "Sign-in failed. Check your email and password.";
  }
  return (err && err.message) || "Something went wrong. Please try again.";
}

function fail(err) {
  var mapped = new Error(mapError(err));
  mapped.code = (err && err.code) || "auth/unknown";
  return mapped;
}

function login(email, password) {
  if (!auth) return notConfigured();
  return withTimeout(signInWithEmailAndPassword(auth, email, password), "Sign-in timed out. Try again.")
    .then(function (cred) {
      if (!isAllowedUser(cred.user)) {
        return signOut(auth).then(function () {
          var denied = new Error("unauthorized");
          denied.code = "admin/unauthorized";
          throw denied;
        });
      }
      currentUser = cred.user;
      return cred.user;
    })
    .catch(function (err) {
      currentUser = null;
      throw fail(err);
    });
}

function logout() {
  currentUser = null;
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

function sendReset(email) {
  if (!auth) return notConfigured();
  var settings = {
    url: continueUrl(),
    handleCodeInApp: false,
  };
  return withTimeout(sendPasswordResetEmail(auth, email, settings), "Sending the reset email timed out. Try again.").catch(
    function (err) {
      var code = (err && err.code) || "";
      if (code === "auth/invalid-email" || code === "auth/missing-email") throw fail(err);
      if (code === "auth/too-many-requests" || code === "auth/network-request-failed") throw fail(err);
      if (code === "admin/timeout") throw fail(err);
      if (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri") throw fail(err);
    }
  );
}

function verifyReset(oobCode) {
  if (!auth) return notConfigured();
  return withTimeout(verifyPasswordResetCode(auth, oobCode), "Checking the reset link timed out. Try again.").catch(
    function (err) {
      throw fail(err);
    }
  );
}

function confirmReset(oobCode, newPassword) {
  if (!auth) return notConfigured();
  return withTimeout(confirmPasswordReset(auth, oobCode, newPassword), "Saving the new password timed out. Try again.").catch(
    function (err) {
      throw fail(err);
    }
  );
}

function changePassword(newPassword) {
  if (!auth) return notConfigured();
  var user = auth.currentUser;
  if (!user) {
    var missing = new Error("You need to be signed in to change your password.");
    missing.code = "auth/requires-recent-login";
    return Promise.reject(fail(missing));
  }
  return withTimeout(updatePassword(user, newPassword), "Updating the password timed out. Try again.").catch(function (
    err
  ) {
    throw fail(err);
  });
}

function onUser(callback) {
  if (!auth) {
    callback(null);
    return function () {};
  }
  return onAuthStateChanged(auth, function (user) {
    if (user && !isAllowedUser(user)) {
      currentUser = null;
      signOut(auth).catch(function () {});
      callback(null);
      return;
    }
    currentUser = user || null;
    callback(currentUser);
  });
}

window.AdminAuth = {
  isConfigured: isConfigured,
  continueUrl: continueUrl,
  allowedEmail: allowedEmail,
  getUser: function () {
    return currentUser;
  },
  login: login,
  logout: logout,
  sendReset: sendReset,
  verifyReset: verifyReset,
  confirmReset: confirmReset,
  changePassword: changePassword,
  onUser: onUser,
  mapError: mapError,
  initError: initError,
};

window.dispatchEvent(new Event("admin-auth-ready"));
