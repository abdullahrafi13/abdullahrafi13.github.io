(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var nav = document.getElementById("site-nav");
  var toggle = document.querySelector(".nav-toggle");
  var yearEl = document.getElementById("year");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function closeNav() {
    if (!nav || !toggle || !header) return;
    nav.classList.remove("is-open");
    header.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && nav && header) {
    toggle.addEventListener("click", function () {
      var open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      header.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var id = anchor.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        closeNav();
      }
    });
  });

  /* Sticky header shadow */
  if (header) {
    var scrollTicking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (scrollTicking) return;
        scrollTicking = true;
        requestAnimationFrame(function () {
          header.classList.toggle("is-scrolled", window.scrollY > 24);
          scrollTicking = false;
        });
      },
      { passive: true }
    );
  }

  /* Active nav section highlight */
  var navAnchors = document.querySelectorAll(".nav-anchor[data-section]");
  var sectionIds = ["hero", "about", "skills", "projects", "contact"];

  function setActiveNav(sectionId) {
    navAnchors.forEach(function (a) {
      a.classList.toggle("is-active", a.getAttribute("data-section") === sectionId);
    });
  }

  function updateNavFromScroll() {
    if (!navAnchors.length) return;
    var offset = (header && header.offsetHeight) || 72;
    var y = window.scrollY + offset + 32;
    var current = "hero";
    for (var i = sectionIds.length - 1; i >= 0; i--) {
      var sec = document.getElementById(sectionIds[i]);
      if (sec && sec.offsetTop <= y) {
        current = sectionIds[i];
        break;
      }
    }
    setActiveNav(current);
  }

  window.addEventListener("scroll", updateNavFromScroll, { passive: true });
  window.addEventListener("resize", updateNavFromScroll, { passive: true });
  updateNavFromScroll();

  /* Hero typing (subtitle) */
  var typedEl = document.getElementById("hero-typed");
  var phrase =
    (typedEl && typedEl.getAttribute("data-phrase")) || "precision engineering models.";
  if (typedEl) {
    if (reducedMotion) {
      typedEl.textContent = phrase;
    } else {
      typedEl.textContent = "";
      var i = 0;
      function typeStep() {
        if (i <= phrase.length) {
          typedEl.textContent = phrase.slice(0, i);
          i++;
          window.setTimeout(typeStep, i < 12 ? 42 : 28);
        }
      }
      window.setTimeout(typeStep, 400);
    }
  }

  /* Button ripple */
  if (!reducedMotion) {
    document.addEventListener(
      "click",
      function (e) {
        var btn = e.target.closest(".btn-ripple");
        if (!btn) return;
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var burst = document.createElement("span");
        burst.className = "btn-ripple-burst";
        burst.style.left = x + "px";
        burst.style.top = y + "px";
        btn.appendChild(burst);
        burst.addEventListener("animationend", function () {
          burst.remove();
        });
      },
      true
    );
  }

  /* Scroll reveal */
  if (!reducedMotion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            if (entry.target.classList.contains("skill-card")) {
              var fill = entry.target.querySelector(".skill-fill");
              var pct = entry.target.querySelector(".skill-pct");
              if (fill) {
                requestAnimationFrame(function () {
                  fill.classList.add("is-animated");
                });
              }
              if (pct && fill) {
                var w = parseInt(fill.getAttribute("data-width"), 10) || 0;
                var start = null;
                function tick(t) {
                  if (start === null) start = t;
                  var p = Math.min((t - start) / 900, 1);
                  var eased = 1 - Math.pow(1 - p, 3);
                  pct.textContent = Math.round(w * eased) + "%";
                  if (p < 1) requestAnimationFrame(tick);
                }
                requestAnimationFrame(tick);
              }
            }
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    document.querySelectorAll(".reveal").forEach(function (el) {
      // Add staggered delay for sibling reveals if not already set
      var parent = el.parentElement;
      if (parent && parent.classList.contains("stagger-children")) {
        var index = Array.from(parent.children).indexOf(el);
        el.style.transitionDelay = (index * 0.1) + "s";
      }
      io.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
    document.querySelectorAll(".skill-fill").forEach(function (f) {
      f.classList.add("is-animated");
    });
    document.querySelectorAll(".skill-pct").forEach(function (p) {
      var card = p.closest(".skill-card");
      var fill = card && card.querySelector(".skill-fill");
      if (fill) {
        p.textContent = (parseInt(fill.getAttribute("data-width"), 10) || 0) + "%";
      }
    });
  }

  /* Contact form — EmailJS */
  var form = document.getElementById("contact-form");
  var statusEl = document.getElementById("form-status");
  if (form && statusEl) {
    var submitBtn = form.querySelector('button[type="submit"]');
    var defaultBtnText = submitBtn ? submitBtn.textContent : "Send Message";
    var emailJsInitialized = false;

    function setStatus(message, type) {
      statusEl.textContent = message || "";
      statusEl.className = "form-status";
      if (type === "success") statusEl.classList.add("success");
      if (type === "error") statusEl.classList.add("error");
    }

    function setLoading(loading) {
      if (!submitBtn) return;
      submitBtn.disabled = loading;
      submitBtn.setAttribute("aria-busy", loading ? "true" : "false");
      submitBtn.textContent = loading ? "Sending…" : defaultBtnText;
    }

    function configReady(cfg) {
      return (
        cfg &&
        cfg.publicKey &&
        cfg.serviceId &&
        cfg.templateId &&
        cfg.publicKey.indexOf("YOUR_PUBLIC_KEY") === -1 &&
        cfg.serviceId.indexOf("YOUR_SERVICE_ID") === -1 &&
        cfg.templateId.indexOf("YOUR_TEMPLATE_ID") === -1
      );
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus("", null);

      var name = document.getElementById("cf-name");
      var email = document.getElementById("cf-email");
      var message = document.getElementById("cf-message");
      if (!name || !email || !message) return;

      if (!name.value.trim()) {
        setStatus("Please enter your name.", "error");
        return;
      }
      if (!email.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
        setStatus("Please enter a valid email.", "error");
        return;
      }
      if (!message.value.trim()) {
        setStatus("Please enter a message.", "error");
        return;
      }

      var cfg = typeof window !== "undefined" ? window.EMAILJS_CONFIG : null;
      if (!configReady(cfg)) {
        setStatus(
          "Email is not configured yet. Open js/emailjs-config.js and set your Public Key, Service ID, and Template ID.",
          "error"
        );
        return;
      }

      if (typeof emailjs === "undefined" || typeof emailjs.init !== "function") {
        setStatus("EmailJS failed to load. Check your internet connection or the script URL in index.html.", "error");
        return;
      }

      if (!emailJsInitialized) {
        emailjs.init({ publicKey: cfg.publicKey });
        emailJsInitialized = true;
      }

      setLoading(true);

      emailjs
        .sendForm(cfg.serviceId, cfg.templateId, form)
        .then(function () {
          setStatus("Message sent successfully. I’ll get back to you soon!", "success");
          form.reset();
        })
        .catch(function (err) {
          var msg =
            (err && err.text) ||
            (err && err.message) ||
            "Something went wrong. Please try again or use email / WhatsApp above.";
          setStatus(msg, "error");
        })
        .finally(function () {
          setLoading(false);
        });
    });
  }
})();
