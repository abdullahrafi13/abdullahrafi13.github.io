(function () {
  "use strict";

  var store = window.PortfolioStore;
  if (!store) return;

  var data = store.load();
  var editingIndex = -1;
  /** In-editor STL state (metadata only; binary stays in Firebase Storage). */
  var workStl = {
    current: null,
    pendingFile: null,
    removeRequested: false,
    busy: false,
  };

  var loginForm = document.getElementById("login-form");
  var recoverForm = document.getElementById("recover-form");
  var resetForm = document.getElementById("reset-form");
  var loginWrap = document.querySelector(".admin-login");
  var adminView = document.getElementById("admin-view");
  var resetCode = "";
  var loginInFlight = false;
  var recoverInFlight = false;
  var resetInFlight = false;

  function status(key, message, ok) {
    var el = document.querySelector('[data-status="' + key + '"]');
    if (!el) return;
    el.textContent = message || "";
    el.className = "admin-status " + (ok ? "ok" : message ? "err" : "");
  }

  function isSignedIn() {
    return !!(window.AdminAuth && window.AdminAuth.getUser());
  }

  function saveMessage(okRemote, err) {
    if (okRemote) return "Saved to Firestore. Refresh the public site to see it.";
    if (err) {
      var code = (err && err.code) || "";
      if (code === "permission-denied" || /permission/i.test(String(err.message || ""))) {
        return "Saved locally. Firestore permission denied — check Firestore rules for signed-in admin write access.";
      }
      if (code === "firestore/timeout" || /timed out/i.test(String(err.message || ""))) {
        return "Saved locally. Cloud save timed out — check your connection and try again.";
      }
      return "Saved locally. Cloud sync failed: " + ((err && err.message) || "unknown error");
    }
    return "Saved locally (Firestore unavailable).";
  }

  function persist() {
    if (!isSignedIn()) return Promise.resolve({ local: false, remote: false });
    if (typeof store.saveEverywhere === "function") {
      return store.saveEverywhere(data);
    }
    store.save(data);
    return Promise.resolve({ local: true, remote: false });
  }

  function persistWithStatus(statusKey, okFallbackMessage) {
    return persist().then(function (result) {
      var remote = !!(result && result.remote);
      var message = remote
        ? saveMessage(true)
        : result && result.error
          ? saveMessage(false, result.error)
          : okFallbackMessage || saveMessage(false);
      status(statusKey, message, remote || !!(result && result.local));
      return result;
    });
  }

  function hydrateAdminData() {
    if (typeof store.loadPreferringRemote !== "function") {
      fillAll();
      renderWorks();
      return Promise.resolve();
    }
    return store.loadPreferringRemote().then(function (result) {
      if (result && result.data) data = result.data;
      fillAll();
      renderWorks();
    });
  }

  function setBusy(btn, loading, idleLabel, busyLabel) {
    if (!btn) return;
    btn.disabled = !!loading;
    btn.classList.toggle("is-loading", !!loading);
    if (loading) {
      btn.innerHTML = '<span class="admin-spinner" aria-hidden="true"></span>' + busyLabel;
    } else {
      btn.textContent = idleLabel;
    }
  }

  function showAuthPanel(name) {
    if (loginWrap) loginWrap.classList.remove("hidden");
    if (adminView) adminView.classList.add("hidden");
    if (loginForm) loginForm.classList.toggle("hidden", name !== "login");
    if (recoverForm) recoverForm.classList.toggle("hidden", name !== "recover");
    if (resetForm) resetForm.classList.toggle("hidden", name !== "reset");
  }

  function passwordIssue(pw) {
    if (!pw || pw.length < 8) return "Use at least 8 characters.";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Include letters and numbers.";
    return "";
  }

  function readFileAsImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve("");
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1400;
          var w = img.width;
          var h = img.height;
          if (w > max) {
            h = Math.round((h * max) / w);
            w = max;
          }
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        };
        img.onerror = function () {
          resolve(String(reader.result || ""));
        };
        img.src = String(reader.result || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function showAdmin() {
    if (loginWrap) loginWrap.classList.add("hidden");
    adminView.classList.remove("hidden");
    hydrateAdminData();
  }

  function fillAll() {
    document.getElementById("site-logo").value = data.site.logo || "";
    document.getElementById("site-title").value = data.site.title || "";
    document.getElementById("site-name").value = data.site.personName || "";
    document.getElementById("hero-kicker").value = data.hero.kicker || "";
    document.getElementById("hero-line1").value = data.hero.titleLine1 || "";
    document.getElementById("hero-line2").value = data.hero.titleLine2 || "";
    document.getElementById("hero-sub").value = data.hero.subStatic || "";
    document.getElementById("hero-typed-phrase").value = data.hero.typedPhrase || "";
    document.getElementById("hero-before").value = data.hero.introBefore || "";
    document.getElementById("hero-after").value = data.hero.introAfter || "";

    document.getElementById("about-photo").value = data.about.photo || "";
    document.getElementById("about-photo-alt").value = data.about.photoAlt || "";
    document.getElementById("about-lead").value = data.about.lead || "";
    renderHighlights();
    updateThumb("about-photo-preview", data.about.photo);

    document.getElementById("skills-heading-input").value = data.skills.heading || "";
    document.getElementById("skills-sub-input").value = data.skills.sub || "";
    renderSkills();

    document.getElementById("contact-intro").value = data.contact.intro || "";
    document.getElementById("contact-email").value = data.contact.email || "";
    document.getElementById("contact-linkedin").value = data.contact.linkedinUrl || "";
    document.getElementById("contact-linkedin-label").value = data.contact.linkedinLabel || "";
    document.getElementById("contact-wa").value = data.contact.whatsappDigits || "";
    document.getElementById("contact-wa-display").value = data.contact.whatsappDisplay || "";
  }

  function updateThumb(id, src) {
    var img = document.getElementById(id);
    if (!img) return;
    if (src) {
      img.src = src;
      img.classList.remove("hidden");
    } else {
      img.removeAttribute("src");
      img.classList.add("hidden");
    }
  }

  function renderHighlights() {
    var root = document.getElementById("highlights-list");
    root.innerHTML = "";
    (data.about.highlights || []).forEach(function (text, i) {
      var row = document.createElement("div");
      row.className = "repeat-row";
      var input = document.createElement("input");
      input.type = "text";
      input.value = text;
      input.addEventListener("input", function () {
        data.about.highlights[i] = input.value;
      });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger btn-small";
      del.textContent = "Remove";
      del.addEventListener("click", function () {
        data.about.highlights.splice(i, 1);
        renderHighlights();
      });
      row.appendChild(input);
      row.appendChild(del);
      root.appendChild(row);
    });
  }

  function renderSkills() {
    var root = document.getElementById("skills-rows");
    root.innerHTML = "";
    (data.skills.items || []).forEach(function (skill, i) {
      var row = document.createElement("div");
      row.className = "skill-row";
      var name = document.createElement("input");
      name.type = "text";
      name.value = skill.name || "";
      name.placeholder = "Skill name";
      name.addEventListener("input", function () {
        data.skills.items[i].name = name.value;
      });
      var pct = document.createElement("input");
      pct.type = "number";
      pct.min = "0";
      pct.max = "100";
      pct.value = skill.percent || 0;
      pct.addEventListener("input", function () {
        data.skills.items[i].percent = Number(pct.value) || 0;
      });
      var optLabel = document.createElement("label");
      var opt = document.createElement("input");
      opt.type = "checkbox";
      opt.checked = !!skill.optional;
      opt.addEventListener("change", function () {
        data.skills.items[i].optional = opt.checked;
      });
      optLabel.appendChild(opt);
      optLabel.appendChild(document.createTextNode(" Optional"));
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger btn-small";
      del.textContent = "Remove";
      del.addEventListener("click", function () {
        data.skills.items.splice(i, 1);
        renderSkills();
      });
      row.appendChild(name);
      row.appendChild(pct);
      row.appendChild(optLabel);
      row.appendChild(del);
      root.appendChild(row);
    });
  }

  function renderWorks() {
    var root = document.getElementById("work-list");
    root.innerHTML = "";
    (data.projects || []).forEach(function (project, i) {
      var item = document.createElement("article");
      item.className = "work-item glass";
      var img = document.createElement("img");
      img.src = project.image || "";
      img.alt = "";
      var info = document.createElement("div");
      var h3 = document.createElement("h3");
      h3.textContent = project.title || "Untitled";
      var p = document.createElement("p");
      p.textContent = project.cardDesc || "";
      info.appendChild(h3);
      info.appendChild(p);
      var actions = document.createElement("div");
      actions.className = "work-item-actions";
      function btn(label, cls, fn) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn btn-small " + cls;
        b.textContent = label;
        b.addEventListener("click", fn);
        return b;
      }
      actions.appendChild(
        btn("Edit", "btn-primary", function () {
          openWorkEditor(i);
        })
      );
      actions.appendChild(
        btn("Up", "btn-outline", function () {
          if (i === 0) return;
          var tmp = data.projects[i - 1];
          data.projects[i - 1] = data.projects[i];
          data.projects[i] = tmp;
          persistWithStatus("works", "Order updated.");
          renderWorks();
        })
      );
      actions.appendChild(
        btn("Down", "btn-outline", function () {
          if (i >= data.projects.length - 1) return;
          var tmp = data.projects[i + 1];
          data.projects[i + 1] = data.projects[i];
          data.projects[i] = tmp;
          persistWithStatus("works", "Order updated.");
          renderWorks();
        })
      );
      actions.appendChild(
        btn("Delete", "btn-danger", function () {
          if (!confirm("Delete “" + (project.title || "this work") + "”?")) return;
          var removed = data.projects[i];
          data.projects.splice(i, 1);
          persistWithStatus("works", "Work deleted.").then(function () {
            renderWorks();
            var path = removed && removed.stlModel && removed.stlModel.storagePath;
            if (path) {
              waitForStorage(1500).then(function (api) {
                if (api && typeof api.deleteStl === "function") {
                  api.deleteStl(path).catch(function () {});
                }
              });
            }
          });
        })
      );
      item.appendChild(img);
      item.appendChild(info);
      item.appendChild(actions);
      root.appendChild(item);
    });
  }

  function emptyWork() {
    return {
      id: "",
      title: "",
      cardDesc: "",
      tools: "",
      meta: "",
      image: "",
      imageAlt: "",
      overview: "",
      features: [],
      software: "",
      galleryHeading: "Supporting imagery",
      galleryLead: "",
      gallery: [],
      liveUrl: "",
      sourceUrl: "",
    };
  }

  function setStlStatus(message, ok) {
    var el = document.getElementById("work-stl-status");
    if (!el) return;
    el.textContent = message || "";
    el.className = "admin-status " + (ok ? "ok" : message ? "err" : "");
  }

  function setStlProgress(visible, percent, label) {
    var wrap = document.getElementById("work-stl-progress-wrap");
    var bar = document.getElementById("work-stl-progress-bar");
    var fill = document.getElementById("work-stl-progress-fill");
    var labelEl = document.getElementById("work-stl-progress-label");
    if (!wrap) return;
    wrap.classList.toggle("hidden", !visible);
    var pct = Math.max(0, Math.min(100, Number(percent) || 0));
    if (bar) bar.setAttribute("aria-valuenow", String(pct));
    if (fill) fill.style.width = pct + "%";
    if (labelEl) labelEl.textContent = label || (pct + "%");
  }

  function formatStlSize(bytes) {
    if (window.PortfolioStorage && typeof window.PortfolioStorage.formatBytes === "function") {
      return window.PortfolioStorage.formatBytes(bytes);
    }
    var n = Number(bytes) || 0;
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  function resetWorkStlState(existingModel) {
    workStl.current = existingModel && existingModel.downloadURL ? store.clone(existingModel) : null;
    workStl.pendingFile = null;
    workStl.removeRequested = false;
    workStl.busy = false;
    var fileInput = document.getElementById("work-stl-file");
    if (fileInput) fileInput.value = "";
    setStlProgress(false, 0, "");
    setStlStatus("", true);
    renderWorkStlUi();
  }

  function renderWorkStlUi() {
    var currentBox = document.getElementById("work-stl-current");
    var nameEl = document.getElementById("work-stl-name");
    var metaEl = document.getElementById("work-stl-meta");
    var pendingEl = document.getElementById("work-stl-pending");
    var removeBtn = document.getElementById("work-stl-remove");
    var fileInput = document.getElementById("work-stl-file");
    var hasCurrent = !!(workStl.current && workStl.current.downloadURL && !workStl.removeRequested);

    if (currentBox) currentBox.classList.toggle("hidden", !hasCurrent);
    if (hasCurrent) {
      if (nameEl) nameEl.textContent = workStl.current.name || "model.stl";
      if (metaEl) {
        var bits = [];
        if (workStl.current.size) bits.push(formatStlSize(workStl.current.size));
        if (workStl.current.uploadedAt) bits.push("uploaded " + String(workStl.current.uploadedAt).slice(0, 10));
        metaEl.textContent = bits.length ? bits.join(" · ") : "Stored in Firebase Storage";
      }
    }

    if (pendingEl) {
      if (workStl.pendingFile) {
        pendingEl.textContent =
          "Selected for upload on Save: " +
          workStl.pendingFile.name +
          " (" +
          formatStlSize(workStl.pendingFile.size) +
          ")";
      } else if (workStl.removeRequested && workStl.current) {
        pendingEl.textContent = "STL will be removed when you save this work.";
      } else {
        pendingEl.textContent = "";
      }
    }

    if (removeBtn) {
      removeBtn.disabled = workStl.busy || (!hasCurrent && !workStl.pendingFile && !workStl.removeRequested);
    }
    if (fileInput) fileInput.disabled = !!workStl.busy;
  }

  function waitForStorage(timeoutMs) {
    if (window.PortfolioStorage && typeof window.PortfolioStorage.uploadStl === "function") {
      return Promise.resolve(window.PortfolioStorage);
    }
    return new Promise(function (resolve) {
      var done = false;
      function finish(value) {
        if (done) return;
        done = true;
        resolve(value || null);
      }
      window.addEventListener(
        "portfolio-storage-ready",
        function () {
          finish(window.PortfolioStorage || null);
        },
        { once: true }
      );
      window.setTimeout(function () {
        finish(window.PortfolioStorage || null);
      }, typeof timeoutMs === "number" ? timeoutMs : 4000);
    });
  }

  /**
   * Resolve final stlModel for a project being saved.
   * Uploads pending file, deletes removed/replaced Storage objects when safe.
   */
  function resolveStlForSave(projectId, previousModel) {
    return waitForStorage().then(function (api) {
      var prev = previousModel && previousModel.downloadURL ? previousModel : null;
      var oldPath = prev && prev.storagePath ? prev.storagePath : "";

      if (workStl.removeRequested && !workStl.pendingFile) {
        if (!oldPath || !api) {
          return { stlModel: null, cleanupError: null };
        }
        return api
          .deleteStl(oldPath)
          .then(function () {
            return { stlModel: null, cleanupError: null };
          })
          .catch(function (err) {
            return { stlModel: null, cleanupError: err };
          });
      }

      if (!workStl.pendingFile) {
        return { stlModel: prev, cleanupError: null };
      }

      if (!api || typeof api.uploadStl !== "function") {
        var missing = new Error("Firebase Storage is not ready. Refresh and try again.");
        missing.code = "storage/not-ready";
        return Promise.reject(missing);
      }

      setStlProgress(true, 0, "Uploading STL… 0%");
      return api
        .uploadStl(projectId, workStl.pendingFile, function (pct) {
          setStlProgress(true, pct, "Uploading STL… " + pct + "%");
        })
        .then(function (meta) {
          setStlProgress(true, 100, "Upload complete");
          if (oldPath && oldPath !== meta.storagePath) {
            return api.deleteStl(oldPath).then(
              function () {
                return { stlModel: meta, cleanupError: null };
              },
              function (err) {
                return { stlModel: meta, cleanupError: err };
              }
            );
          }
          return { stlModel: meta, cleanupError: null };
        })
        .catch(function (err) {
          setStlProgress(false, 0, "");
          throw err;
        });
    });
  }

  function showList() {
    document.getElementById("works-list-view").classList.remove("hidden");
    document.getElementById("work-editor-view").classList.add("hidden");
    editingIndex = -1;
  }

  function openWorkEditor(index) {
    editingIndex = index;
    var project = index < 0 ? emptyWork() : store.clone(data.projects[index]);
    document.getElementById("works-list-view").classList.add("hidden");
    document.getElementById("work-editor-view").classList.remove("hidden");
    document.getElementById("work-editor-title").textContent = index < 0 ? "Add work" : "Edit work";
    document.getElementById("work-id").value = project.id || "";
    document.getElementById("work-title").value = project.title || "";
    document.getElementById("work-card-desc").value = project.cardDesc || "";
    document.getElementById("work-tools").value = project.tools || "";
    document.getElementById("work-meta").value = project.meta || "";
    document.getElementById("work-image").value = project.image || "";
    document.getElementById("work-image-alt").value = project.imageAlt || "";
    document.getElementById("work-overview").value = project.overview || "";
    document.getElementById("work-features").value = (project.features || []).join("\n");
    document.getElementById("work-software").value = project.software || "";
    document.getElementById("work-live").value = project.liveUrl || "";
    document.getElementById("work-source").value = project.sourceUrl || "";
    document.getElementById("work-gallery-heading").value = project.galleryHeading || "";
    document.getElementById("work-gallery-lead").value = project.galleryLead || "";
    document.getElementById("work-image-file").value = "";
    updateThumb("work-image-preview", project.image);
    renderGallery(project.gallery || []);
    resetWorkStlState(project.stlModel || null);
    status("work-editor", "", true);
  }

  function renderGallery(items) {
    var root = document.getElementById("gallery-list");
    root.innerHTML = "";
    items.forEach(function (item, i) {
      var card = document.createElement("div");
      card.className = "gallery-card glass";
      card.innerHTML =
        '<div class="form-row"><label>Image path / URL</label><input class="g-src" type="text" /></div>' +
        '<div class="form-row"><label>Upload</label><input class="g-file" type="file" accept="image/*" /></div>' +
        '<img class="preview-thumb g-preview hidden" alt="" />' +
        '<div class="form-row"><label>Alt text</label><input class="g-alt" type="text" /></div>' +
        '<div class="form-row"><label>Caption</label><textarea class="g-cap" rows="2"></textarea></div>';
      var src = card.querySelector(".g-src");
      var alt = card.querySelector(".g-alt");
      var cap = card.querySelector(".g-cap");
      var file = card.querySelector(".g-file");
      var preview = card.querySelector(".g-preview");
      src.value = item.src || "";
      alt.value = item.alt || "";
      cap.value = item.caption || "";
      if (item.src) {
        preview.src = item.src;
        preview.classList.remove("hidden");
      }
      src.addEventListener("input", function () {
        items[i].src = src.value;
        if (src.value) {
          preview.src = src.value;
          preview.classList.remove("hidden");
        }
      });
      alt.addEventListener("input", function () {
        items[i].alt = alt.value;
      });
      cap.addEventListener("input", function () {
        items[i].caption = cap.value;
      });
      file.addEventListener("change", function () {
        readFileAsImage(file.files[0]).then(function (url) {
          items[i].src = url;
          src.value = url.indexOf("data:") === 0 ? "(uploaded image)" : url;
          preview.src = url;
          preview.classList.remove("hidden");
        });
      });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger btn-small";
      del.textContent = "Remove image";
      del.addEventListener("click", function () {
        items.splice(i, 1);
        renderGallery(items);
      });
      card.appendChild(del);
      card._item = item;
      root.appendChild(card);
    });
    root._items = items;
  }

  function collectGallery() {
    var root = document.getElementById("gallery-list");
    return (root._items || []).map(function (item) {
      return {
        src: item.src === "(uploaded image)" ? item.src : item.src,
        alt: item.alt || "",
        caption: item.caption || "",
      };
    }).filter(function (item) {
      return item.src && item.src !== "(uploaded image)";
    });
  }

  function setFormStatus(id, message, ok) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || "";
    el.className = "admin-status " + (ok ? "ok" : message ? "err" : "");
  }

  function clearResetParams() {
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    }
  }

  function waitForAuth(done) {
    if (window.AdminAuth) {
      done(window.AdminAuth);
      return;
    }
    window.addEventListener(
      "admin-auth-ready",
      function () {
        done(window.AdminAuth);
      },
      { once: true }
    );
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (loginInFlight) return;
    var email = document.getElementById("admin-email").value.trim();
    var password = document.getElementById("admin-password").value;
    var btn = document.getElementById("login-submit");
    setFormStatus("login-status", "", true);
    if (!window.AdminAuth || typeof window.AdminAuth.login !== "function") {
      setFormStatus("login-status", "Authentication failed to load. Refresh the page and try again.", false);
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormStatus("login-status", "Enter a valid email address.", false);
      return;
    }
    loginInFlight = true;
    setBusy(btn, true, "Enter admin", "Signing in…");
    window.AdminAuth.login(email, password)
      .then(function () {
        showAdmin();
      })
      .catch(function (err) {
        setFormStatus("login-status", (err && err.message) || "Sign-in failed. Check your email and password.", false);
      })
      .then(function () {
        loginInFlight = false;
        setBusy(btn, false, "Enter admin", "Signing in…");
      });
  });

  document.getElementById("forgot-open").addEventListener("click", function () {
    var loginEmail = document.getElementById("admin-email").value.trim();
    if (loginEmail) document.getElementById("recover-email").value = loginEmail;
    setFormStatus("recover-status", "", true);
    showAuthPanel("recover");
  });

  document.getElementById("recover-back").addEventListener("click", function () {
    showAuthPanel("login");
  });

  recoverForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (recoverInFlight) return;
    var email = document.getElementById("recover-email").value.trim();
    var btn = document.getElementById("recover-submit");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormStatus("recover-status", "Enter a valid email address.", false);
      return;
    }
    recoverInFlight = true;
    setBusy(btn, true, "Send Reset Link", "Sending…");
    window.AdminAuth.sendReset(email)
      .then(function () {
        setFormStatus(
          "recover-status",
          "If that email is registered, a password reset link has been sent. Check your inbox and spam folder.",
          true
        );
      })
      .catch(function (err) {
        setFormStatus("recover-status", (err && err.message) || "Could not send the reset email.", false);
      })
      .then(function () {
        recoverInFlight = false;
        setBusy(btn, false, "Send Reset Link", "Sending…");
      });
  });

  document.getElementById("reset-back").addEventListener("click", function () {
    resetCode = "";
    clearResetParams();
    showAuthPanel("login");
  });

  resetForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (resetInFlight) return;
    var pw = document.getElementById("reset-password").value;
    var pw2 = document.getElementById("reset-password-2").value;
    var btn = document.getElementById("reset-submit");
    var issue = passwordIssue(pw);
    if (issue) {
      setFormStatus("reset-status", issue, false);
      return;
    }
    if (pw !== pw2) {
      setFormStatus("reset-status", "Passwords do not match.", false);
      return;
    }
    if (!resetCode) {
      setFormStatus("reset-status", "This reset link is invalid or has already been used. Request a new one.", false);
      return;
    }
    resetInFlight = true;
    setBusy(btn, true, "Save new password", "Saving…");
    window.AdminAuth.confirmReset(resetCode, pw)
      .then(function () {
        resetCode = "";
        clearResetParams();
        showAuthPanel("login");
        setFormStatus("login-status", "Password updated. Sign in with your new password.", true);
        document.getElementById("admin-password").value = "";
      })
      .catch(function (err) {
        setFormStatus("reset-status", (err && err.message) || "Could not update the password.", false);
      })
      .then(function () {
        resetInFlight = false;
        setBusy(btn, false, "Save new password", "Saving…");
      });
  });

  document.getElementById("logout-btn").addEventListener("click", function () {
    var auth = window.AdminAuth;
    if (!auth || typeof auth.logout !== "function") {
      location.reload();
      return;
    }
    auth.logout().then(
      function () {
        location.reload();
      },
      function () {
        location.reload();
      }
    );
  });

  document.querySelectorAll(".admin-nav button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".admin-nav button").forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      var id = btn.getAttribute("data-panel");
      document.querySelectorAll(".admin-panel").forEach(function (panel) {
        panel.classList.toggle("is-active", panel.id === "panel-" + id);
      });
    });
  });

  document.getElementById("form-hero").addEventListener("submit", function (e) {
    e.preventDefault();
    data.site.logo = document.getElementById("site-logo").value.trim();
    data.site.title = document.getElementById("site-title").value.trim();
    data.site.personName = document.getElementById("site-name").value.trim();
    data.hero.kicker = document.getElementById("hero-kicker").value.trim();
    data.hero.titleLine1 = document.getElementById("hero-line1").value.trim();
    data.hero.titleLine2 = document.getElementById("hero-line2").value.trim();
    data.hero.subStatic = document.getElementById("hero-sub").value.trim();
    data.hero.typedPhrase = document.getElementById("hero-typed-phrase").value.trim();
    data.hero.introBefore = document.getElementById("hero-before").value.trim();
    data.hero.introAfter = document.getElementById("hero-after").value.trim();
    persistWithStatus("hero");
  });

  document.getElementById("add-highlight").addEventListener("click", function () {
    data.about.highlights = data.about.highlights || [];
    data.about.highlights.push("");
    renderHighlights();
  });

  document.getElementById("about-photo-file").addEventListener("change", function (e) {
    var file = e.target.files[0];
    readFileAsImage(file).then(function (url) {
      data.about.photo = url;
      document.getElementById("about-photo").value = url.indexOf("data:") === 0 ? "(uploaded image)" : url;
      updateThumb("about-photo-preview", url);
    });
  });

  document.getElementById("form-about").addEventListener("submit", function (e) {
    e.preventDefault();
    var photoVal = document.getElementById("about-photo").value.trim();
    if (photoVal && photoVal !== "(uploaded image)") data.about.photo = photoVal;
    data.about.photoAlt = document.getElementById("about-photo-alt").value.trim();
    data.about.lead = document.getElementById("about-lead").value.trim();
    persistWithStatus("about", "Saved.");
  });

  document.getElementById("add-skill").addEventListener("click", function () {
    data.skills.items = data.skills.items || [];
    data.skills.items.push({ name: "", percent: 70, optional: false });
    renderSkills();
  });

  document.getElementById("form-skills").addEventListener("submit", function (e) {
    e.preventDefault();
    data.skills.heading = document.getElementById("skills-heading-input").value.trim();
    data.skills.sub = document.getElementById("skills-sub-input").value.trim();
    persistWithStatus("skills", "Saved.");
  });

  document.getElementById("add-work").addEventListener("click", function () {
    openWorkEditor(-1);
  });
  document.getElementById("work-back").addEventListener("click", showList);

  document.getElementById("work-image-file").addEventListener("change", function (e) {
    readFileAsImage(e.target.files[0]).then(function (url) {
      document.getElementById("work-image").value = url.indexOf("data:") === 0 ? "(uploaded image)" : url;
      document.getElementById("work-image").dataset.upload = url;
      updateThumb("work-image-preview", url);
    });
  });

  document.getElementById("add-gallery").addEventListener("click", function () {
    var root = document.getElementById("gallery-list");
    var items = root._items || [];
    items.push({ src: "", alt: "", caption: "" });
    renderGallery(items);
  });

  document.getElementById("work-stl-file").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    waitForStorage(1500).then(function (api) {
      try {
        if (api && typeof api.validateStlFile === "function") {
          api.validateStlFile(file);
        } else if (!/\.stl$/i.test(file.name || "")) {
          throw new Error("Only .stl files are allowed.");
        }
        workStl.pendingFile = file;
        workStl.removeRequested = false;
        setStlStatus("STL selected. It will upload when you save this work.", true);
        renderWorkStlUi();
      } catch (err) {
        workStl.pendingFile = null;
        e.target.value = "";
        setStlStatus((err && err.message) || "Invalid STL file.", false);
        renderWorkStlUi();
      }
    });
  });

  document.getElementById("work-stl-remove").addEventListener("click", function () {
    if (workStl.busy) return;
    workStl.pendingFile = null;
    var fileInput = document.getElementById("work-stl-file");
    if (fileInput) fileInput.value = "";
    if (workStl.current && workStl.current.downloadURL) {
      workStl.removeRequested = true;
      setStlStatus("STL marked for removal. Save the work to confirm.", true);
    } else {
      workStl.removeRequested = false;
      setStlStatus("No STL attached.", true);
    }
    renderWorkStlUi();
  });

  document.getElementById("form-work").addEventListener("submit", function (e) {
    e.preventDefault();
    if (workStl.busy) return;
    var title = document.getElementById("work-title").value.trim();
    if (!title) {
      status("work-editor", "Title is required.", false);
      return;
    }
    var imageField = document.getElementById("work-image");
    var image = imageField.dataset.upload || imageField.value.trim();
    if (image === "(uploaded image)") image = imageField.dataset.upload || "";
    var existing = editingIndex >= 0 ? data.projects[editingIndex] : null;
    var others = data.projects.filter(function (_, i) {
      return i !== editingIndex;
    });
    var id = (existing && existing.id) || store.uniqueId(title, others);
    var previousStl = (existing && existing.stlModel) || workStl.current || null;
    var project = {
      id: id,
      title: title,
      cardDesc: document.getElementById("work-card-desc").value.trim(),
      tools: document.getElementById("work-tools").value.trim(),
      meta: document.getElementById("work-meta").value.trim(),
      image: image,
      imageAlt: document.getElementById("work-image-alt").value.trim(),
      overview: document.getElementById("work-overview").value.trim(),
      features: document
        .getElementById("work-features")
        .value.split("\n")
        .map(function (line) {
          return line.trim();
        })
        .filter(Boolean),
      software: document.getElementById("work-software").value.trim(),
      galleryHeading: document.getElementById("work-gallery-heading").value.trim(),
      galleryLead: document.getElementById("work-gallery-lead").value.trim(),
      gallery: collectGallery(),
      liveUrl: document.getElementById("work-live").value.trim(),
      sourceUrl: document.getElementById("work-source").value.trim(),
    };

    var saveBtn = document.getElementById("work-save-btn");
    workStl.busy = true;
    renderWorkStlUi();
    setBusy(saveBtn, true, "Save work", "Saving…");
    status("work-editor", workStl.pendingFile ? "Uploading STL and saving…" : "Saving…", true);

    resolveStlForSave(id, previousStl)
      .then(function (result) {
        var uploadedNew = !!(result && result.stlModel && workStl.pendingFile);
        var uploadedPath = uploadedNew && result.stlModel ? result.stlModel.storagePath : "";
        if (result && result.stlModel) {
          project.stlModel = result.stlModel;
        }
        if (editingIndex < 0) data.projects.unshift(project);
        else data.projects[editingIndex] = project;
        delete imageField.dataset.upload;

        return persistWithStatus(
          "work-editor",
          result && result.stlModel
            ? "Work saved with STL model."
            : workStl.removeRequested
              ? "Work saved. STL removed."
              : "Work saved. It now shows on the homepage."
        ).then(function (persistResult) {
          if (persistResult && persistResult.remote === false && uploadedNew && uploadedPath) {
            status(
              "work-editor",
              "STL uploaded, but saving portfolio to Firestore failed. Cleaning up the uploaded file. Fix the cloud save error and try again.",
              false
            );
            return waitForStorage(1000).then(function (api) {
              if (api && typeof api.deleteStl === "function") {
                return api.deleteStl(uploadedPath).catch(function () {});
              }
            }).then(function () {
              if (previousStl && previousStl.downloadURL && !workStl.removeRequested) {
                project.stlModel = previousStl;
              } else {
                delete project.stlModel;
              }
              if (editingIndex < 0) data.projects[0] = project;
              else data.projects[editingIndex] = project;
              store.save(data);
              workStl.busy = false;
              setBusy(saveBtn, false, "Save work", "Saving…");
              setStlProgress(false, 0, "");
              resetWorkStlState(project.stlModel || null);
              renderWorks();
            });
          }

          if (result && result.cleanupError) {
            setStlStatus(
              "Saved, but old STL cleanup failed: " +
                ((result.cleanupError && result.cleanupError.message) || "unknown error"),
              false
            );
          } else if (project.stlModel) {
            setStlStatus("STL attached: " + (project.stlModel.name || "model.stl"), true);
          } else {
            setStlStatus("", true);
          }

          workStl.busy = false;
          setBusy(saveBtn, false, "Save work", "Saving…");
          setStlProgress(false, 0, "");
          resetWorkStlState(project.stlModel || null);
          renderWorks();
          setTimeout(showList, 600);
        });
      })
      .catch(function (err) {
        workStl.busy = false;
        setBusy(saveBtn, false, "Save work", "Saving…");
        setStlProgress(false, 0, "");
        renderWorkStlUi();
        var msg =
          (window.PortfolioStorage && window.PortfolioStorage.mapError
            ? window.PortfolioStorage.mapError(err)
            : null) ||
          (err && err.message) ||
          "Could not save STL / work.";
        setStlStatus(msg, false);
        status("work-editor", msg, false);
      });
  });

  document.getElementById("form-contact").addEventListener("submit", function (e) {
    e.preventDefault();
    data.contact.intro = document.getElementById("contact-intro").value.trim();
    data.contact.email = document.getElementById("contact-email").value.trim();
    data.contact.linkedinUrl = document.getElementById("contact-linkedin").value.trim();
    data.contact.linkedinLabel = document.getElementById("contact-linkedin-label").value.trim();
    data.contact.whatsappDigits = document.getElementById("contact-wa").value.replace(/\D/g, "");
    data.contact.whatsappDisplay = document.getElementById("contact-wa-display").value.trim();
    persistWithStatus("contact", "Saved.");
  });

  document.getElementById("export-json").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "portfolio-content.json";
    a.click();
    URL.revokeObjectURL(a.href);
    status("settings", "Backup downloaded.", true);
  });

  document.getElementById("import-json-btn").addEventListener("click", function () {
    document.getElementById("import-json").click();
  });

  document.getElementById("import-json").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        if (!parsed || !Array.isArray(parsed.projects)) throw new Error("Invalid file");
        data = parsed;
        persistWithStatus("settings", "Imported. Content updated.").then(function () {
          fillAll();
          renderWorks();
        });
      } catch (err) {
        status("settings", "Could not import that file.", false);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("form-password").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!isSignedIn()) return;
    var a = document.getElementById("new-password").value;
    var b = document.getElementById("new-password-2").value;
    var issue = passwordIssue(a);
    if (issue) {
      status("settings", issue, false);
      return;
    }
    if (a !== b) {
      status("settings", "Passwords do not match.", false);
      return;
    }
    window.AdminAuth.changePassword(a)
      .then(function () {
        document.getElementById("form-password").reset();
        status("settings", "Password updated for your Firebase admin account.", true);
      })
      .catch(function (err) {
        status("settings", (err && err.message) || "Could not change the password.", false);
      });
  });

  document.getElementById("reset-content").addEventListener("click", function () {
    if (!isSignedIn()) return;
    if (!confirm("Reset all content to the original portfolio? This cannot be undone unless you exported a backup.")) {
      return;
    }
    data = store.reset();
    persistWithStatus("settings", "Content reset to original.").then(function () {
      fillAll();
      renderWorks();
      showList();
    });
  });

  waitForAuth(function (auth) {
    if (!auth || !auth.isConfigured()) {
      showAuthPanel("login");
      setFormStatus(
        "login-status",
        "Authentication is not configured yet. Add your Firebase values in js/firebase-config.js.",
        false
      );
      return;
    }
    if (auth.initError) {
      showAuthPanel("login");
      setFormStatus(
        "login-status",
        "Firebase failed to start. Check js/firebase-config.js and the browser console.",
        false
      );
      return;
    }

    var params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "resetPassword" && params.get("oobCode")) {
      resetCode = params.get("oobCode");
      showAuthPanel("reset");
      setBusy(document.getElementById("reset-submit"), true, "Save new password", "Checking link…");
      auth
        .verifyReset(resetCode)
        .then(function () {
          setFormStatus("reset-status", "Link verified. Choose a new password.", true);
        })
        .catch(function (err) {
          resetCode = "";
          showAuthPanel("login");
          setFormStatus("login-status", (err && err.message) || "This reset link is invalid or has expired.", false);
          clearResetParams();
        })
        .then(function () {
          setBusy(document.getElementById("reset-submit"), false, "Save new password", "Checking link…");
        });
      return;
    }

    auth.onUser(function (user) {
      if (user) {
        showAdmin();
        return;
      }
      if (resetCode) return;
      if (recoverForm && !recoverForm.classList.contains("hidden")) return;
      if (resetForm && !resetForm.classList.contains("hidden")) return;
      showAuthPanel("login");
    });
  });
})();
