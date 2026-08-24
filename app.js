(() => {
  "use strict";

  const data = window.PLAN_DATA;
  if (!data) {
    document.body.innerHTML = '<main class="empty-state"><b>تعذر تحميل البيانات</b><span>تأكد من وجود ملف data.js بجوار الصفحة.</span></main>';
    return;
  }

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const main = $("main");
  const hero = $("#home");
  const plan = $("#plan-content");
  if (main && hero && plan) main.insertBefore(plan, hero.nextElementSibling);
  const arabicNumber = new Intl.NumberFormat("ar-SA");
  const formatNumber = (value) => arabicNumber.format(value);
  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const normalize = (value = "") =>
    String(value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[ـ\s]+/g, " ")
      .trim();

  const slideSearch = new Map(
    data.slides.map((slide) => [
      slide.number,
      normalize(`${slide.title} ${slide.contextTitle || ""} ${slide.section} ${slide.searchText}`),
    ]),
  );

  const pageParams = new URLSearchParams(location.search);

  const state = {
    query: pageParams.get("q") || "",
    section: pageParams.get("section") || "all",
    programGroup: "all",
    printOpen: [],
  };

  function setLinks() {
    const assignments = [
      ["navPdfLink", "#plan-content"],
      ["indexPdfLink", "#plan-content"],
      ["heroPptxLink", "#programs"],
    ];
    assignments.forEach(([id, href]) => {
      const link = document.getElementById(id);
      if (link) link.href = href;
    });
    $("#heroVision").textContent = "خطة مدرسية تفاعلية للبحث والتصفح المباشر.";
    $("#heroSlideCount").textContent = formatNumber(data.stats.slides);
  }

  function renderHeroStats() {
    const values = [
      [data.stats.tables, "جدول"],
      [data.stats.cells, "خلية"],
      [data.stats.programs, "برنامج"],
    ];
    $("#heroStats").innerHTML = values
      .map(
        ([value, label]) =>
          `<div class="mini-stat"><b>${formatNumber(value)}</b><span>${label}</span></div>`,
      )
      .join("");
  }

  function renderStats() {
    const stats = [
      [data.stats.slides, "قسماً منظماً", "#dff2f1"],
      [data.stats.programs, "برنامجاً تنفيذياً", "#f8edcf"],
      [data.stats.tables, "جدولاً منظماً", "#e3edf8"],
      [data.stats.cells, "خلية بيانات", "#e8f5e2"],
      [data.stats.pictures, "صور ومرفقات", "#f4e7e8"],
    ];
    $("#statsGrid").innerHTML = stats
      .map(
        ([value, label, accent]) => `
          <article class="stat-card reveal" style="--stat-accent:${accent}">
            <b>${formatNumber(value)}</b>
            <span>${label}</span>
          </article>`,
      )
      .join("");
  }

  function renderSectionPath() {
    $("#sectionPath").innerHTML = data.sections
      .map(
        (section, index) => `
          <a class="path-item" href="#slide-${section.start}">
            <b>${String(index + 1).padStart(2, "0")}</b>
            <strong>${escapeHtml(section.name)}</strong>
            <span>الشرائح ${formatNumber(section.start)}–${formatNumber(section.end)}</span>
          </a>`,
      )
      .join("");
  }

  function renderPrograms() {
    const groups = ["all", ...new Set(data.programs.map((program) => program.group))];
    $("#programFilters").innerHTML = groups
      .map(
        (group) => `
          <button class="program-filter ${group === state.programGroup ? "active" : ""}" type="button" data-group="${escapeHtml(group)}">
            ${group === "all" ? "جميع البرامج" : escapeHtml(group)}
          </button>`,
      )
      .join("");

    const visible = data.programs.filter(
      (program) => state.programGroup === "all" || program.group === state.programGroup,
    );
    $("#programGrid").innerHTML = visible
      .map(
        (program) => `
          <article class="program-card" style="--program-color:${program.color}">
            <b>${String(program.number).padStart(2, "0")}</b>
            <div><strong>${escapeHtml(program.name)}</strong><span>${escapeHtml(program.group)}</span></div>
          </article>`,
      )
      .join("");

    $$(".program-filter").forEach((button) => {
      button.addEventListener("click", () => {
        state.programGroup = button.dataset.group;
        renderPrograms();
      });
    });
  }

  function tableHtml(table) {
    const columnLabels = Array.from({ length: table.columns }, (_, index) => `العمود ${formatNumber(index + 1)}`);
    table.data.slice(0, 2).forEach((row) => {
      row.forEach((cell) => {
        const label = cell.text.replaceAll("\n", " ").trim();
        if (!label) return;
        for (let offset = 0; offset < cell.colSpan; offset += 1) {
          const column = cell.column + offset;
          if (column < columnLabels.length && columnLabels[column].startsWith("العمود")) {
            columnLabels[column] = label;
          }
        }
      });
    });
    const rows = table.data
      .map((row, rowIndex) => {
        const cells = row
          .map((cell) => {
            const tag = cell.header ? "th" : "td";
            const span = `${cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ""}${cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ""}`;
            const label = columnLabels[cell.column] || `العمود ${formatNumber(cell.column + 1)}`;
            const cellClass = cell.colSpan > 1 ? ' class="wide-cell"' : "";
            return `<${tag}${span}${cellClass} data-label="${escapeHtml(label)}">${escapeHtml(cell.text).replaceAll("\n", "<br>")}</${tag}>`;
          })
          .join("");
        return `<tr data-row="${rowIndex + 1}">${cells}</tr>`;
      })
      .join("");
    const densityClass = table.columns > 14 ? "table-wide table-ultra" : table.columns > 6 ? "table-wide" : "";
    return `
      <article class="table-card">
        <div class="table-caption">
          <span>الجدول ${formatNumber(table.number)}</span>
          <span>${formatNumber(table.rows)} صف × ${formatNumber(table.columns)} عمود · ${formatNumber(table.cellCount)} خلية</span>
        </div>
        <div class="table-scroll" aria-label="جدول كامل دون تمرير أفقي">
          <table class="data-table ${densityClass}" style="--columns:${table.columns}"><tbody>${rows}</tbody></table>
        </div>
      </article>`;
  }

  function pictureHtml(picture, slideNumber) {
    return `
      <button class="media-button open-image" type="button" data-src="${escapeHtml(picture.src)}" data-caption="${escapeHtml(`${picture.role} — الشريحة ${slideNumber}`)}">
        <img src="${escapeHtml(picture.src)}" alt="${escapeHtml(picture.alt)}" loading="lazy" />
        <span>${escapeHtml(picture.role)}</span>
      </button>`;
  }

  function slideHtml(slide) {
    const context = [slide.contextTitle, slide.section]
      .filter((value, index, values) => value && values.indexOf(value) === index)
      .join(" · ");
    const textBlocks = slide.texts.length
      ? `<div class="text-blocks">${slide.texts
          .map((block) => `<p class="text-block">${escapeHtml(block.text)}</p>`)
          .join("")}</div>`
      : "";
    const tables = slide.tables.length
      ? `<div class="table-stack">${slide.tables.map(tableHtml).join("")}</div>`
      : "";
    const pictures = slide.pictures.length
      ? `<div class="media-grid">${slide.pictures
          .map((picture) => pictureHtml(picture, slide.number))
          .join("")}</div>`
      : "";
    const tableBadge = slide.tables.length
      ? `<span title="عدد الجداول">${formatNumber(slide.tables.length)} جدول</span>`
      : "";
    const pictureBadge = slide.pictures.length
      ? `<span title="عدد الصور">${formatNumber(slide.pictures.length)} صورة</span>`
      : "";
    return `
      <details class="slide-card" id="slide-${slide.number}" data-slide="${slide.number}" data-section="${escapeHtml(slide.section)}">
        <summary>
          <span class="slide-number">${String(slide.number).padStart(2, "0")}</span>
          <span class="slide-title"><strong>${escapeHtml(slide.title)}</strong><span>${escapeHtml(context)}</span></span>
          <span class="summary-meta">${tableBadge}${pictureBadge}<i aria-hidden="true">⌄</i></span>
        </summary>
        <div class="slide-body">
          <div class="slide-actions">
            <button class="slide-action copy-slide" type="button" data-slide="${slide.number}">نسخ الرابط</button>
            <button class="slide-action print-slide" type="button" data-slide="${slide.number}">طباعة</button>
          </div>
          ${textBlocks}${tables}${pictures}
        </div>
      </details>`;
  }

  function renderSlides() {
    $("#slidesList").innerHTML = data.slides.map(slideHtml).join("");
    attachSlideActions();
    attachImageActions();
    openHashSlide();
    applyFilters();
  }

  function renderFiltersAndIndex() {
    const select = $("#sectionFilter");
    select.innerHTML = '<option value="all">جميع الأقسام</option>' + data.sections
      .map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`)
      .join("");
    if ([...select.options].some((option) => option.value === state.section)) {
      select.value = state.section;
    } else {
      state.section = "all";
    }

    $("#planIndex").innerHTML = data.slides
      .map(
        (slide) => `
          <a class="index-link" href="#slide-${slide.number}" data-index-slide="${slide.number}">
            <b>${String(slide.number).padStart(2, "0")}</b>
            <span>${escapeHtml(slide.title)}</span>
            <small>${slide.tables.length ? formatNumber(slide.tables.length) : ""}</small>
          </a>`,
      )
      .join("");

    $$(".index-link").forEach((link) => {
      link.addEventListener("click", () => {
        const card = document.getElementById(`slide-${link.dataset.indexSlide}`);
        if (card) card.open = true;
      });
    });
  }

  function applyFilters() {
    const query = normalize(state.query);
    let visibleCount = 0;
    data.slides.forEach((slide) => {
      const sectionMatch = state.section === "all" || slide.section === state.section;
      const queryMatch = !query || slideSearch.get(slide.number).includes(query);
      const visible = sectionMatch && queryMatch;
      const card = document.getElementById(`slide-${slide.number}`);
      const index = $(`[data-index-slide="${slide.number}"]`);
      if (card) {
        card.hidden = !visible;
        if (query && visible) card.open = true;
      }
      if (index) index.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    $("#resultsCount").textContent = `${formatNumber(visibleCount)} قسماً`;
    $("#indexCount").textContent = formatNumber(visibleCount);
    $("#activeQuery").textContent = state.query ? `نتائج البحث عن «${state.query}»` : "";

    let empty = $("#slidesList .empty-state");
    if (!visibleCount && !empty) {
      empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<b>لا توجد نتائج مطابقة</b><span>جرّب كلمة أقصر أو اختر جميع الأقسام.</span>";
      $("#slidesList").append(empty);
    } else if (visibleCount && empty) {
      empty.remove();
    }
  }

  function attachSlideActions() {
    $$(".copy-slide").forEach((button) => {
      button.addEventListener("click", async () => {
        const url = `${location.href.split("#")[0]}#slide-${button.dataset.slide}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          const input = document.createElement("textarea");
          input.value = url;
          document.body.append(input);
          input.select();
          document.execCommand("copy");
          input.remove();
        }
        showToast("تم نسخ رابط الشريحة");
      });
    });

    $$(".print-slide").forEach((button) => {
      button.addEventListener("click", () => {
        const target = document.getElementById(`slide-${button.dataset.slide}`);
        $$(".slide-card").forEach((card) => {
          card.dataset.printHidden = card.hidden ? "1" : "0";
          card.hidden = card !== target;
        });
        target.open = true;
        window.print();
        $$(".slide-card").forEach((card) => {
          card.hidden = card.dataset.printHidden === "1";
          delete card.dataset.printHidden;
        });
      });
    });
  }

  function renderDownloads() {
    const files = [
      ["79", "استعراض جميع البيانات", "انتقل إلى محتوى الخطة الكامل والمنظم.", "#plan-content", "#d7842e", "فتح المحتوى"],
      ["27", "البرامج التنفيذية", "تصفح البرامج مصنفة حسب مجالات التنفيذ.", "#programs", "#15989b", "عرض البرامج"],
      ["⌁", "طباعة الصفحة", "اطبع الخطة أو احفظها من المتصفح عند الحاجة.", "#", "#a83442", "بدء الطباعة", "print"],
      ["QR", "خطابات التكليف", "فتح الرابط المضمّن في باركود فريق التخطيط.", data.links.assignments, "#083b5c", "فتح الرابط"],
    ];
    $("#downloadGrid").innerHTML = files
      .map(
        ([icon, title, description, href, color, label, action]) => `
          <article class="download-card">
            <span class="file-icon" style="--file-color:${color}">${icon}</span>
            <strong>${escapeHtml(title)}</strong>
            <p>${escapeHtml(description)}</p>
            <a href="${escapeHtml(href)}" ${action ? `data-action="${action}"` : ""} ${href.startsWith("http") ? 'target="_blank" rel="noopener"' : ""}>${escapeHtml(label)} <span>←</span></a>
          </article>`,
      )
      .join("");
    $('[data-action="print"]')?.addEventListener("click", (event) => {
      event.preventDefault();
      window.print();
    });
  }

  function renderGallery() {
    const assets = data.slides.flatMap((slide) =>
      slide.pictures.map((picture) => ({ ...picture, slideNumber: slide.number })),
    );
    $("#galleryCount").textContent = `${formatNumber(assets.length)} صور من العرض المصدر`;
    $("#assetGallery").innerHTML = assets
      .map(
        (picture) => `
          <button class="gallery-item open-image" type="button" data-src="${escapeHtml(picture.src)}" data-caption="${escapeHtml(`${picture.role} — الشريحة ${picture.slideNumber}`)}">
            <img src="${escapeHtml(picture.src)}" alt="${escapeHtml(picture.alt)}" loading="lazy" />
            <span>${escapeHtml(picture.role)} · الشريحة ${formatNumber(picture.slideNumber)}</span>
          </button>`,
      )
      .join("");
    $("#galleryCount").textContent = `${formatNumber(assets.length)} صور من العرض المصدر`;
    attachImageActions();
  }

  function attachImageActions() {
    $$(".open-image").forEach((button) => {
      if (button.dataset.bound === "1") return;
      button.dataset.bound = "1";
      button.addEventListener("click", () => {
        $("#dialogImage").src = button.dataset.src;
        $("#dialogImage").alt = button.dataset.caption;
        $("#dialogCaption").textContent = button.dataset.caption;
        $("#imageDialog").showModal();
      });
    });
  }

  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function openHashSlide() {
    const match = location.hash.match(/^#slide-(\d+)$/);
    if (!match) return;
    const card = document.getElementById(`slide-${match[1]}`);
    if (!card) return;
    card.open = true;
    requestAnimationFrame(() => card.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function setupInteractions() {
    const search = $("#planSearch");
    const sectionFilter = $("#sectionFilter");
    search.value = state.query;
    sectionFilter.value = state.section;
    search.addEventListener("input", () => {
      state.query = search.value.trim();
      applyFilters();
    });
    sectionFilter.addEventListener("change", () => {
      state.section = sectionFilter.value;
      applyFilters();
    });

    $("#expandAll").addEventListener("click", () => {
      $$(".slide-card:not([hidden])").forEach((card) => { card.open = true; });
    });
    $("#collapseAll").addEventListener("click", () => {
      $$(".slide-card").forEach((card) => { card.open = false; });
    });
    $("#printPlan").addEventListener("click", () => window.print());
    $("#floatingPrint").addEventListener("click", () => window.print());

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.focus();
      }
      if (event.key === "Escape" && $("#imageDialog").open) $("#imageDialog").close();
    });

    $("#dialogClose").addEventListener("click", () => $("#imageDialog").close());
    $("#imageDialog").addEventListener("click", (event) => {
      if (event.target === $("#imageDialog")) $("#imageDialog").close();
    });

    const menuToggle = $("#menuToggle");
    menuToggle.addEventListener("click", () => {
      const open = document.body.classList.toggle("nav-open");
      menuToggle.setAttribute("aria-expanded", String(open));
    });
    $$("#mainNav a").forEach((link) => {
      link.addEventListener("click", () => {
        document.body.classList.remove("nav-open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });

    const savedTheme = localStorage.getItem("plan-theme");
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    $("#themeToggle").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("plan-theme", next);
    });

    window.addEventListener("hashchange", openHashSlide);
    window.addEventListener("scroll", onScroll, { passive: true });

    window.addEventListener("beforeprint", () => {
      state.printOpen = $$(".slide-card").map((card) => card.open);
      $$(".slide-card:not([hidden])").forEach((card) => { card.open = true; });
    });
    window.addEventListener("afterprint", () => {
      $$(".slide-card").forEach((card, index) => { card.open = state.printOpen[index]; });
    });
  }

  function onScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    const value = max > 0 ? (scrollY / max) * 100 : 0;
    $("#scrollProgress").style.width = `${value}%`;
    $("#siteHeader").classList.toggle("scrolled", scrollY > 28);
  }

  function setupObservers() {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    $$(".reveal").forEach((element) => revealObserver.observe(element));

    const sections = ["overview", "programs", "plan-content", "resources"];
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          $$(".main-nav a").forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      },
      { rootMargin: "-30% 0px -60%", threshold: 0 },
    );
    sections.forEach((id) => {
      const section = document.getElementById(id);
      if (section) navObserver.observe(section);
    });
  }

  setLinks();
  renderHeroStats();
  renderStats();
  renderSectionPath();
  renderPrograms();
  renderFiltersAndIndex();
  renderSlides();
  renderDownloads();
  renderGallery();
  setupInteractions();
  setupObservers();
  onScroll();

  if (pageParams.get("view") === "plan") {
    document.body.classList.add("plan-preview");
    scrollTo(0, 0);
  }

})();
