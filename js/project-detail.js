(function () {
  "use strict";

  var store = window.PortfolioStore;
  var params = new URLSearchParams(window.location.search);
  var id = params.get("id");
  var data = store && id ? store.getProjectById(id) : null;

  var empty = document.getElementById("detail-empty");
  var content = document.getElementById("detail-content");
  var yearEl = document.getElementById("year");
  if (yearEl && !yearEl.textContent) yearEl.textContent = String(new Date().getFullYear());

  if (!data) {
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");
  if (content) content.classList.remove("hidden");

  document.getElementById("detail-title").textContent = data.title || "";
  document.getElementById("detail-meta").textContent = data.meta || "";
  var img = document.getElementById("detail-image");
  img.src = data.image || "";
  img.alt = data.imageAlt || data.title || "";
  document.getElementById("detail-overview").textContent = data.overview || "";

  var ul = document.getElementById("detail-features");
  ul.innerHTML = "";
  (data.features || []).forEach(function (f) {
    var li = document.createElement("li");
    li.textContent = f;
    ul.appendChild(li);
  });

  document.getElementById("detail-software").textContent = data.software || "";
  var person = (store.load().site && store.load().site.personName) || "Walliuzzaman Talha";
  document.title = (data.title || "Project") + " | " + person;

  var gallerySection = document.getElementById("detail-gallery-section");
  var galleryRoot = document.getElementById("detail-gallery");
  var galleryHeadingEl = document.getElementById("detail-gallery-heading");
  var galleryLeadEl = document.getElementById("detail-gallery-lead");
  if (gallerySection && galleryRoot) {
    galleryRoot.innerHTML = "";
    if (data.gallery && data.gallery.length) {
      gallerySection.classList.remove("hidden");
      if (galleryHeadingEl) {
        galleryHeadingEl.textContent = data.galleryHeading || "Supporting imagery";
      }
      if (galleryLeadEl) {
        galleryLeadEl.textContent =
          data.galleryLead || "Additional views and details from this project.";
        galleryLeadEl.classList.remove("hidden");
      }
      data.gallery.forEach(function (item) {
        var fig = document.createElement("figure");
        fig.className = "detail-gallery-item glass reveal";
        var im = document.createElement("img");
        im.src = item.src;
        im.alt = item.alt || "";
        im.width = 900;
        im.height = 600;
        im.loading = "lazy";
        fig.appendChild(im);
        if (item.caption) {
          var cap = document.createElement("figcaption");
          cap.textContent = item.caption;
          fig.appendChild(cap);
        }
        galleryRoot.appendChild(fig);
      });
    } else {
      gallerySection.classList.add("hidden");
      if (galleryLeadEl) {
        galleryLeadEl.textContent = "";
        galleryLeadEl.classList.add("hidden");
      }
    }
  }

  function runReveals() {
    if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -5% 0px" }
      );
      document.querySelectorAll(".detail-article .reveal").forEach(function (el) {
        io.observe(el);
      });
    } else {
      document.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(runReveals);
  });
})();
