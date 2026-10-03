(function () {
  "use strict";

  var store = window.PortfolioStore;
  if (!store) return;

  var data = store.load();

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value == null ? "" : String(value);
  }

  function setHref(selector, href) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.setAttribute("href", href);
    });
  }

  function waLink(digits) {
    return "https://wa.me/" + String(digits || "").replace(/\D/g, "");
  }

  function mailto(email, subject) {
    var href = "mailto:" + email;
    if (subject) href += "?subject=" + encodeURIComponent(subject);
    return href;
  }

  function applySiteChrome() {
    var site = data.site || {};
    var contact = data.contact || {};
    var logo = document.querySelector(".logo");
    if (logo) {
      logo.innerHTML = "";
      logo.appendChild(document.createTextNode(site.logo || "WT"));
      var dot = document.createElement("span");
      dot.className = "logo-dot";
      dot.textContent = ".";
      logo.appendChild(dot);
    }
    if (site.title && !document.body.classList.contains("page-detail")) {
      document.title = site.title;
    }
    var name = site.personName || "Walliuzzaman Talha";
    document.querySelectorAll(".footer-copy").forEach(function (el) {
      var year = el.querySelector("#year");
      el.innerHTML = "";
      el.appendChild(document.createTextNode("© "));
      var span = document.createElement("span");
      span.id = "year";
      span.textContent = year ? year.textContent : String(new Date().getFullYear());
      el.appendChild(span);
      el.appendChild(document.createTextNode(" " + name + " · "));
      var admin = document.createElement("a");
      admin.className = "admin-link";
      admin.href = "admin.html";
      admin.textContent = "Admin";
      el.appendChild(admin);
    });

    if (contact.email) {
      setHref('a[href^="mailto:"]', mailto(contact.email));
      var hire = document.querySelector(".contact-actions a.btn-primary");
      if (hire) hire.setAttribute("href", mailto(contact.email, "Project inquiry"));
    }
    if (contact.linkedinUrl) {
      document.querySelectorAll('a[href*="linkedin.com"]').forEach(function (a) {
        a.setAttribute("href", contact.linkedinUrl);
      });
    }
    if (contact.whatsappDigits) {
      setHref('a[href*="wa.me"]', waLink(contact.whatsappDigits));
    }
  }

  function applyHero() {
    if (!$("hero")) return;
    var hero = data.hero || {};
    var kicker = document.querySelector(".hero-kicker");
    if (kicker) {
      kicker.innerHTML = "";
      var dot = document.createElement("span");
      dot.className = "hero-kicker-dot";
      kicker.appendChild(dot);
      kicker.appendChild(document.createTextNode(" " + (hero.kicker || "")));
    }
    setText("hero-title-line", hero.titleLine1 || "");
    setText("hero-title-gradient", hero.titleLine2 || "");
    var subStatic = document.querySelector(".hero-sub-static");
    if (subStatic) subStatic.textContent = (hero.subStatic || "") + " ";
    var typed = $("hero-typed");
    if (typed) typed.setAttribute("data-phrase", hero.typedPhrase || "");
    var intro = document.querySelector(".hero-intro");
    if (intro) {
      intro.innerHTML = "";
      intro.appendChild(document.createTextNode((hero.introBefore || "Hi, I'm") + " "));
      var strong = document.createElement("strong");
      strong.textContent = (data.site && data.site.personName) || "Walliuzzaman Talha";
      intro.appendChild(strong);
      var after = hero.introAfter || "";
      if (after && after.charAt(0) !== "," && after.charAt(0) !== "." && after.charAt(0) !== " ") {
        after = " " + after;
      }
      intro.appendChild(document.createTextNode(after));
    }
  }

  function applyAbout() {
    if (!$("about")) return;
    var about = data.about || {};
    var photo = document.querySelector(".about-photo");
    if (photo) {
      photo.src = about.photo || "assets/profile.png";
      photo.alt = about.photoAlt || (data.site && data.site.personName) || "";
    }
    var lead = document.querySelector(".about-lead");
    if (lead) lead.textContent = about.lead || "";
    var list = document.querySelector(".about-highlights");
    if (list) {
      list.innerHTML = "";
      (about.highlights || []).forEach(function (item) {
        var li = document.createElement("li");
        var icon = document.createElement("span");
        icon.className = "highlight-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "◇";
        li.appendChild(icon);
        li.appendChild(document.createTextNode(" " + item));
        list.appendChild(li);
      });
    }
  }

  function applySkills() {
    var list = document.querySelector(".skills-list");
    if (!list) return;
    var skills = data.skills || {};
    setText("skills-heading", skills.heading || "Skills");
    var sub = document.querySelector(".skills .section-sub");
    if (sub) sub.textContent = skills.sub || "";
    list.innerHTML = "";
    (skills.items || []).forEach(function (skill) {
      var pct = Math.max(0, Math.min(100, Number(skill.percent) || 0));
      var li = document.createElement("li");
      li.className = "skill-card glass reveal" + (skill.optional ? " skill-optional" : "");
      var head = document.createElement("div");
      head.className = "skill-head";
      var name = document.createElement("span");
      name.className = "skill-name";
      name.textContent = skill.name || "";
      head.appendChild(name);
      if (skill.optional) {
        var badge = document.createElement("span");
        badge.className = "skill-badge";
        badge.textContent = "Optional";
        head.appendChild(badge);
      }
      var pctEl = document.createElement("span");
      pctEl.className = "skill-pct";
      pctEl.textContent = "0%";
      head.appendChild(pctEl);
      var bar = document.createElement("div");
      bar.className = "skill-bar";
      bar.setAttribute("role", "presentation");
      var fill = document.createElement("span");
      fill.className = "skill-fill";
      fill.setAttribute("data-width", String(pct));
      fill.style.setProperty("--w", pct + "%");
      bar.appendChild(fill);
      li.appendChild(head);
      li.appendChild(bar);
      list.appendChild(li);
    });
  }

  function detailHref(project) {
    return "project-detail.html?id=" + encodeURIComponent(project.id);
  }

  function applyProjects() {
    var grid = $("projects-grid");
    if (!grid) return;
    var section = data.projectsSection || {};
    setText("projects-heading", section.heading || "Selected Projects");
    var sub = document.querySelector(".projects .section-sub");
    if (sub) sub.textContent = section.sub || "";
    grid.innerHTML = "";
    (data.projects || []).forEach(function (project) {
      var href = detailHref(project);
      var live = project.liveUrl || href;
      var source = project.sourceUrl || "#contact";
      var article = document.createElement("article");
      article.className = "project-card glass reveal reveal-scale";

      var media = document.createElement("a");
      media.className = "project-card-media";
      media.href = href;
      var wrap = document.createElement("div");
      wrap.className = "project-image-wrap";
      var img = document.createElement("img");
      img.src = project.image || "";
      img.alt = project.imageAlt || project.title || "";
      img.width = 800;
      img.height = 600;
      img.loading = "lazy";
      wrap.appendChild(img);
      media.appendChild(wrap);
      var overlay = document.createElement("div");
      overlay.className = "project-card-overlay";
      overlay.setAttribute("aria-hidden", "true");
      var ovSpan = document.createElement("span");
      ovSpan.textContent = "Preview";
      overlay.appendChild(ovSpan);
      media.appendChild(overlay);

      var body = document.createElement("div");
      body.className = "project-body";
      var h3 = document.createElement("h3");
      h3.className = "project-title";
      h3.textContent = project.title || "Untitled work";
      var desc = document.createElement("p");
      desc.className = "project-desc";
      desc.textContent = project.cardDesc || "";
      var tools = document.createElement("p");
      tools.className = "project-tools";
      var label = document.createElement("span");
      label.className = "label";
      label.textContent = "Tools:";
      tools.appendChild(label);
      tools.appendChild(document.createTextNode(" " + (project.tools || "")));

      var actions = document.createElement("div");
      actions.className = "project-card-actions";
      function actionBtn(cls, text, url, extra) {
        var a = document.createElement("a");
        a.className = "btn btn-project " + cls + " btn-ripple";
        a.href = url;
        a.textContent = text;
        if (extra) extra(a);
        return a;
      }
      actions.appendChild(actionBtn("btn-project--primary", "View details", href));
      actions.appendChild(
        actionBtn("btn-project--ghost", "View live", live, function (a) {
          if (live.indexOf("http") === 0) {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
          } else {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
          }
        })
      );
      actions.appendChild(
        actionBtn("btn-project--ghost", "Source code", source, function (a) {
          a.title = "CAD files / collaboration — reach out";
        })
      );

      body.appendChild(h3);
      body.appendChild(desc);
      body.appendChild(tools);
      body.appendChild(actions);
      article.appendChild(media);
      article.appendChild(body);
      grid.appendChild(article);
    });
  }

  function applyContact() {
    if (!$("contact")) return;
    var contact = data.contact || {};
    var intro = document.querySelector(".contact-intro");
    if (intro) intro.textContent = contact.intro || "";
    var info = document.querySelector(".contact-info");
    if (!info) return;
    var paragraphs = info.querySelectorAll("p");
    if (paragraphs[0]) {
      paragraphs[0].innerHTML = "";
      var s0 = document.createElement("strong");
      s0.textContent = "Email";
      paragraphs[0].appendChild(s0);
      paragraphs[0].appendChild(document.createElement("br"));
      var a0 = document.createElement("a");
      a0.href = mailto(contact.email);
      a0.textContent = contact.email || "";
      paragraphs[0].appendChild(a0);
    }
    if (paragraphs[1]) {
      paragraphs[1].innerHTML = "";
      var s1 = document.createElement("strong");
      s1.textContent = "LinkedIn";
      paragraphs[1].appendChild(s1);
      paragraphs[1].appendChild(document.createElement("br"));
      var a1 = document.createElement("a");
      a1.href = contact.linkedinUrl || "#";
      a1.target = "_blank";
      a1.rel = "noopener noreferrer";
      a1.textContent = contact.linkedinLabel || "LinkedIn";
      paragraphs[1].appendChild(a1);
    }
    if (paragraphs[2]) {
      paragraphs[2].innerHTML = "";
      var s2 = document.createElement("strong");
      s2.textContent = "WhatsApp";
      paragraphs[2].appendChild(s2);
      paragraphs[2].appendChild(document.createElement("br"));
      var a2 = document.createElement("a");
      a2.href = waLink(contact.whatsappDigits);
      a2.target = "_blank";
      a2.rel = "noopener noreferrer";
      a2.textContent = contact.whatsappDisplay || "";
      paragraphs[2].appendChild(a2);
    }
  }

  applySiteChrome();
  applyHero();
  applyAbout();
  applySkills();
  applyProjects();
  applyContact();
})();
