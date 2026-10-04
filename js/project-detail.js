(function () {
  "use strict";

  var store = window.PortfolioStore;
  var params = new URLSearchParams(window.location.search);
  var id = params.get("id");

  var empty = document.getElementById("detail-empty");
  var content = document.getElementById("detail-content");
  var yearEl = document.getElementById("year");
  if (yearEl && !yearEl.textContent) yearEl.textContent = String(new Date().getFullYear());

  function showEmpty() {
    if (empty) empty.classList.remove("hidden");
    if (content) content.classList.add("hidden");
  }

  function findProject(portfolio, projectId) {
    if (!portfolio || !Array.isArray(portfolio.projects) || !projectId) return null;
    for (var i = 0; i < portfolio.projects.length; i++) {
      if (portfolio.projects[i].id === projectId) return portfolio.projects[i];
    }
    return null;
  }

  function renderDetail(project, personName) {
    if (!project) {
      showEmpty();
      return;
    }

    if (empty) empty.classList.add("hidden");
    if (content) content.classList.remove("hidden");

    document.getElementById("detail-title").textContent = project.title || "";
    document.getElementById("detail-meta").textContent = project.meta || "";
    var img = document.getElementById("detail-image");
    img.src = project.image || "";
    img.alt = project.imageAlt || project.title || "";
    document.getElementById("detail-overview").textContent = project.overview || "";

    var ul = document.getElementById("detail-features");
    ul.innerHTML = "";
    (project.features || []).forEach(function (f) {
      var li = document.createElement("li");
      li.textContent = f;
      ul.appendChild(li);
    });

    document.getElementById("detail-software").textContent = project.software || "";
    document.title = (project.title || "Project") + " | " + (personName || "Md Abdullah Al Hasan Rafi");

    var gallerySection = document.getElementById("detail-gallery-section");
    var galleryRoot = document.getElementById("detail-gallery");
    var galleryHeadingEl = document.getElementById("detail-gallery-heading");
    var galleryLeadEl = document.getElementById("detail-gallery-lead");
    if (gallerySection && galleryRoot) {
      galleryRoot.innerHTML = "";
      if (project.gallery && project.gallery.length) {
        gallerySection.classList.remove("hidden");
        if (galleryHeadingEl) {
          galleryHeadingEl.textContent = project.galleryHeading || "Supporting imagery";
        }
        if (galleryLeadEl) {
          galleryLeadEl.textContent =
            project.galleryLead || "Additional views and details from this project.";
          galleryLeadEl.classList.remove("hidden");
        }
        project.gallery.forEach(function (item) {
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
  }

  if (!store || !id) {
    showEmpty();
    return;
  }

  var localPortfolio = store.load();
  var localProject = findProject(localPortfolio, id);
  if (localProject) {
    renderDetail(localProject, localPortfolio.site && localPortfolio.site.personName);
  }

  if (typeof store.loadPreferringRemote === "function") {
    store.loadPreferringRemote().then(function (result) {
      var portfolio = (result && result.data) || localPortfolio;
      var project = findProject(portfolio, id);
      if (project) {
        renderDetail(project, portfolio.site && portfolio.site.personName);
      } else if (!localProject) {
        showEmpty();
      }
    });
  } else if (!localProject) {
    showEmpty();
  }
})();
