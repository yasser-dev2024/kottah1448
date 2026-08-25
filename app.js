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
    printSnapshot: [],
    printMode: "all",
    singlePrintSlide: null,
    previousTitle: "",
    dirty: false,
    saved: {
      edits: {},
      addedRows: {},
      evidence: {},
      updatedAt: null,
    },
  };

  const databaseName = "kottah1448-operational-plan";
  const databaseStore = "documents";
  const databaseKey = "main-plan";
  const fallbackStorageKey = "kottah1448-plan-state";
  const evidencePattern = /شواهد|الشاهد|الأدلة|ادلة|المرفقات|وسائل التحقق/;

  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  function normalizeSavedState(value) {
    return {
      edits: value?.edits && typeof value.edits === "object" ? value.edits : {},
      addedRows: value?.addedRows && typeof value.addedRows === "object" ? value.addedRows : {},
      evidence: value?.evidence && typeof value.evidence === "object" ? value.evidence : {},
      updatedAt: value?.updatedAt || null,
    };
  }

  function openPlanDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB غير متاح"));
        return;
      }
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(databaseStore)) {
          request.result.createObjectStore(databaseStore);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadSavedState() {
    try {
      const database = await openPlanDatabase();
      const value = await new Promise((resolve, reject) => {
        const transaction = database.transaction(databaseStore, "readonly");
        const request = transaction.objectStore(databaseStore).get(databaseKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return normalizeSavedState(value);
    } catch {
      try {
        return normalizeSavedState(JSON.parse(localStorage.getItem(fallbackStorageKey) || "null"));
      } catch {
        return normalizeSavedState(null);
      }
    }
  }

  async function writeSavedState(value) {
    try {
      const database = await openPlanDatabase();
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(databaseStore, "readwrite");
        transaction.objectStore(databaseStore).put(value, databaseKey);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    } catch (error) {
      localStorage.setItem(fallbackStorageKey, JSON.stringify(value));
      if (error) console.warn("تم استخدام الحفظ المحلي البديل.");
    }
  }

  function savedText(key, fallback = "") {
    return owns(state.saved.edits, key) ? state.saved.edits[key] : fallback;
  }

  function editableHtml(key, value, className = "editable-field", label = "خانة قابلة للتعديل") {
    return `<div class="${className}" contenteditable="true" role="textbox" aria-label="${escapeHtml(label)}" spellcheck="true" data-edit-key="${key}">${escapeHtml(savedText(key, value)).replaceAll("\n", "<br>")}</div>`;
  }

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
            <div>
              <strong class="editable-inline" contenteditable="true" role="textbox" spellcheck="true" data-edit-key="program-${program.number}-name">${escapeHtml(savedText(`program-${program.number}-name`, program.name))}</strong>
              <span class="editable-inline" contenteditable="true" role="textbox" spellcheck="true" data-edit-key="program-${program.number}-group">${escapeHtml(savedText(`program-${program.number}-group`, program.group))}</span>
            </div>
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

  function attachmentHtml(evidenceKey, attachment) {
    const image = attachment.type?.startsWith("image/");
    const preview = image
      ? `<img src="${escapeHtml(attachment.dataUrl)}" alt="${escapeHtml(attachment.name)}" loading="lazy" />`
      : `<span class="evidence-file-icon">PDF</span><small>${escapeHtml(attachment.name)}</small>`;
    return `
      <div class="evidence-item">
        <button class="evidence-preview${image ? "" : " evidence-file"}" type="button" data-open-evidence="${escapeHtml(evidenceKey)}" data-evidence-id="${escapeHtml(attachment.id)}" aria-label="فتح ${escapeHtml(attachment.name)}">
          ${preview}
        </button>
        <button class="evidence-remove" type="button" data-remove-evidence="${escapeHtml(evidenceKey)}" data-evidence-id="${escapeHtml(attachment.id)}" aria-label="حذف ${escapeHtml(attachment.name)}">×</button>
      </div>`;
  }

  function evidenceZoneHtml(evidenceKey) {
    const attachments = state.saved.evidence[evidenceKey] || [];
    return `
      <div class="evidence-zone" data-evidence-key="${escapeHtml(evidenceKey)}">
        <div class="evidence-items">
          ${attachments.length ? attachments.map((attachment) => attachmentHtml(evidenceKey, attachment)).join("") : '<span class="evidence-empty">لا توجد شواهد مرفقة</span>'}
        </div>
        <label class="evidence-add">
          <input type="file" accept="image/*,application/pdf" multiple data-evidence-upload="${escapeHtml(evidenceKey)}" />
          <span>＋ إدراج شاهد من الجهاز</span>
        </label>
      </div>`;
  }

  function addedRowHtml(tableKey, rowId, columns, columnLabels, evidenceColumns) {
    const cells = Array.from({ length: columns }, (_, column) => {
      const key = `${tableKey}-added-${rowId}-col-${column}`;
      const label = columnLabels[column] || `العمود ${formatNumber(column + 1)}`;
      const upload = evidenceColumns.includes(column) ? evidenceZoneHtml(key) : "";
      const remove = column === 0
        ? `<button class="remove-added-row" type="button" data-remove-row="${escapeHtml(rowId)}" data-table-key="${escapeHtml(tableKey)}">حذف الصف</button>`
        : "";
      return `<td data-label="${escapeHtml(label)}"${upload ? ' class="evidence-cell"' : ""}>${editableHtml(key, "", "editable-cell-content", `خانة ${label}`)}${upload}${remove}</td>`;
    }).join("");
    return `<tr class="added-row" data-added-row="${escapeHtml(rowId)}" data-table-key="${escapeHtml(tableKey)}">${cells}</tr>`;
  }

  function tableHtml(table, slideNumber, tableIndex) {
    const tableKey = `slide-${slideNumber}-table-${tableIndex + 1}`;
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
    const evidenceColumns = columnLabels
      .map((label, index) => evidencePattern.test(label) ? index : -1)
      .filter((index) => index >= 0);
    const rows = table.data
      .map((row, rowIndex) => {
        const cells = row
          .map((cell) => {
            const tag = cell.header ? "th" : "td";
            const span = `${cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : ""}${cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : ""}`;
            const label = columnLabels[cell.column] || `العمود ${formatNumber(cell.column + 1)}`;
            const key = `${tableKey}-row-${rowIndex + 1}-col-${cell.column}`;
            const isEvidenceCell = tag === "td" && evidenceColumns.some((column) => column >= cell.column && column < cell.column + cell.colSpan);
            const classes = [cell.colSpan > 1 ? "wide-cell" : "", isEvidenceCell ? "evidence-cell" : ""].filter(Boolean);
            const cellClass = classes.length ? ` class="${classes.join(" ")}"` : "";
            return `<${tag}${span}${cellClass} data-label="${escapeHtml(label)}">${editableHtml(key, cell.text, "editable-cell-content", `خانة ${label}`)}${isEvidenceCell ? evidenceZoneHtml(key) : ""}</${tag}>`;
          })
          .join("");
        return `<tr data-row="${rowIndex + 1}">${cells}</tr>`;
      })
      .join("");
    const addedRows = (state.saved.addedRows[tableKey] || [])
      .map((rowId) => addedRowHtml(tableKey, rowId, table.columns, columnLabels, evidenceColumns))
      .join("");
    const densityClass = table.columns > 14 ? "table-wide table-ultra" : table.columns > 6 ? "table-wide" : "";
    return `
      <article class="table-card" data-table-card="${tableKey}">
        <div class="table-caption">
          <span>الجدول ${formatNumber(table.number)}</span>
          <span>${formatNumber(table.rows)} صف × ${formatNumber(table.columns)} عمود · ${formatNumber(table.cellCount)} خلية</span>
          <button class="table-add-row" type="button" data-add-row="${tableKey}">＋ إضافة صف</button>
        </div>
        <div class="table-scroll" aria-label="جدول كامل دون تمرير أفقي">
          <table class="data-table ${densityClass}" style="--columns:${table.columns}" data-table-key="${tableKey}" data-columns="${table.columns}" data-column-labels="${encodeURIComponent(JSON.stringify(columnLabels))}" data-evidence-columns="${evidenceColumns.join(",")}"><tbody>${rows}${addedRows}</tbody></table>
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
          .map((block, index) => editableHtml(`slide-${slide.number}-text-${index + 1}`, block.text, "text-block editable-field", "نص قابل للتعديل"))
          .join("")}</div>`
      : "";
    const tables = slide.tables.length
      ? `<div class="table-stack">${slide.tables.map((table, index) => tableHtml(table, slide.number, index)).join("")}</div>`
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
          <span class="slide-title">
            <strong class="editable-inline" contenteditable="true" role="textbox" spellcheck="true" data-edit-key="slide-${slide.number}-title">${escapeHtml(savedText(`slide-${slide.number}-title`, slide.title))}</strong>
            <span class="editable-inline" contenteditable="true" role="textbox" spellcheck="true" data-edit-key="slide-${slide.number}-context">${escapeHtml(savedText(`slide-${slide.number}-context`, context))}</span>
          </span>
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
            <span>${escapeHtml(savedText(`slide-${slide.number}-title`, slide.title))}</span>
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
        beginPrint("single", button.dataset.slide);
      });
    });
  }

  function renderDownloads() {
    const files = [
      ["79", "استعراض جميع البيانات", "انتقل إلى محتوى الخطة الكامل والمنظم.", "#plan-content", "#d7842e", "فتح المحتوى"],
      ["27", "البرامج التنفيذية", "تصفح البرامج مصنفة حسب مجالات التنفيذ.", "#programs", "#15989b", "عرض البرامج"],
      ["PDF", "تنزيل الخطة كاملة", "نزّل جميع الأقسام والتعديلات والشواهد في ملف PDF منسق.", "#", "#a83442", "تنزيل PDF", "print"],
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
      exportPdf();
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

  function refreshEvidenceZone(evidenceKey) {
    const zone = $$(".evidence-zone").find((element) => element.dataset.evidenceKey === evidenceKey);
    if (!zone) return;
    const attachments = state.saved.evidence[evidenceKey] || [];
    $(".evidence-items", zone).innerHTML = attachments.length
      ? attachments.map((attachment) => attachmentHtml(evidenceKey, attachment)).join("")
      : '<span class="evidence-empty">لا توجد شواهد مرفقة</span>';
  }

  function findEvidence(evidenceKey, attachmentId) {
    return (state.saved.evidence[evidenceKey] || []).find((attachment) => attachment.id === attachmentId);
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function createIdentifier() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function markDirty() {
    state.dirty = true;
    document.body.classList.add("has-unsaved-changes");
    $("#saveStatus").textContent = "توجد تغييرات غير محفوظة";
  }

  function editableValue(element) {
    return (element.innerText || element.textContent || "")
      .replaceAll("\r", "")
      .replaceAll("\u00a0", " ");
  }

  function collectEdits() {
    $$('[data-edit-key][data-edit-dirty="1"]').forEach((element) => {
      state.saved.edits[element.dataset.editKey] = editableValue(element);
      delete element.dataset.editDirty;
    });
  }

  function updateSavedTitles() {
    data.slides.forEach((slide) => {
      const linkTitle = $(`[data-index-slide="${slide.number}"] span`);
      if (linkTitle) linkTitle.textContent = savedText(`slide-${slide.number}-title`, slide.title);
    });
  }

  async function savePlan(showMessage = true) {
    const button = $("#savePlan");
    const previousLabel = button.textContent;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "جارٍ الحفظ…";
    $("#saveStatus").textContent = "جارٍ حفظ التعديلات والشواهد…";
    try {
      collectEdits();
      state.saved.updatedAt = new Date().toISOString();
      await writeSavedState(state.saved);
      state.dirty = false;
      document.body.classList.remove("has-unsaved-changes");
      const savedTime = new Intl.DateTimeFormat("ar-SA", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(state.saved.updatedAt));
      $("#saveStatus").textContent = `تم الحفظ محلياً · ${savedTime}`;
      updateSavedTitles();
      if (showMessage) showToast("تم حفظ جميع التعديلات والشواهد");
      return true;
    } catch (error) {
      console.error(error);
      $("#saveStatus").textContent = "تعذر الحفظ؛ تأكد من مساحة التخزين في المتصفح";
      showToast("تعذر الحفظ في هذا المتصفح");
      return false;
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = previousLabel;
    }
  }

  function beginPrint(mode = "all", slideNumber = null) {
    state.printMode = mode;
    state.singlePrintSlide = slideNumber ? String(slideNumber) : null;
    state.previousTitle = document.title;
    document.title = mode === "single"
      ? `الخطة التشغيلية 1448 - القسم ${slideNumber}`
      : "الخطة التشغيلية 1448 - كاملة";
    window.print();
  }

  async function exportPdf() {
    const saved = await savePlan(false);
    if (!saved) return;
    showToast("اختر «حفظ بصيغة PDF» لتنزيل الخطة كاملة");
    beginPrint("all");
  }

  function setupEditor() {
    if (state.saved.updatedAt) {
      const savedTime = new Intl.DateTimeFormat("ar-SA", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(state.saved.updatedAt));
      $("#saveStatus").textContent = `تم استعادة آخر حفظ · ${savedTime}`;
    }

    $("#savePlan").addEventListener("click", () => savePlan());
    $("#downloadPdf").addEventListener("click", exportPdf);

    document.addEventListener("input", (event) => {
      const editable = event.target.closest('[contenteditable="true"]');
      if (!editable) return;
      editable.dataset.editDirty = "1";
      state.saved.edits[editable.dataset.editKey] = editableValue(editable);
      markDirty();
    });

    document.addEventListener("paste", (event) => {
      const editable = event.target.closest('[contenteditable="true"]');
      if (!editable) return;
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") || "";
      document.execCommand("insertText", false, text);
    });

    document.addEventListener("click", async (event) => {
      const editable = event.target.closest('[contenteditable="true"]');
      if (editable?.closest("summary")) {
        event.preventDefault();
        event.stopPropagation();
        editable.focus();
      }

      const addRowButton = event.target.closest("[data-add-row]");
      if (addRowButton) {
        const tableKey = addRowButton.dataset.addRow;
        const table = $$(".data-table").find((element) => element.dataset.tableKey === tableKey);
        if (!table) return;
        const rowId = createIdentifier();
        const columns = Number(table.dataset.columns);
        const labels = JSON.parse(decodeURIComponent(table.dataset.columnLabels));
        const evidenceColumns = table.dataset.evidenceColumns
          ? table.dataset.evidenceColumns.split(",").map(Number)
          : [];
        state.saved.addedRows[tableKey] ||= [];
        state.saved.addedRows[tableKey].push(rowId);
        $("tbody", table).insertAdjacentHTML("beforeend", addedRowHtml(tableKey, rowId, columns, labels, evidenceColumns));
        markDirty();
        $(`[data-added-row="${rowId}"] [contenteditable="true"]`, table)?.focus();
        showToast("تمت إضافة صف جديد؛ اضغط حفظ لتثبيته");
        return;
      }

      const removeRowButton = event.target.closest("[data-remove-row]");
      if (removeRowButton) {
        const { tableKey, removeRow: rowId } = removeRowButton.dataset;
        state.saved.addedRows[tableKey] = (state.saved.addedRows[tableKey] || []).filter((id) => id !== rowId);
        const prefix = `${tableKey}-added-${rowId}-`;
        Object.keys(state.saved.edits).filter((key) => key.startsWith(prefix)).forEach((key) => delete state.saved.edits[key]);
        Object.keys(state.saved.evidence).filter((key) => key.startsWith(prefix)).forEach((key) => delete state.saved.evidence[key]);
        removeRowButton.closest("tr")?.remove();
        markDirty();
        showToast("تم حذف الصف المضاف");
        return;
      }

      const openButton = event.target.closest("[data-open-evidence]");
      if (openButton) {
        const attachment = findEvidence(openButton.dataset.openEvidence, openButton.dataset.evidenceId);
        if (!attachment) return;
        if (attachment.type?.startsWith("image/")) {
          $("#dialogImage").src = attachment.dataUrl;
          $("#dialogImage").alt = attachment.name;
          $("#dialogCaption").textContent = attachment.name;
          $("#imageDialog").showModal();
        } else {
          const link = document.createElement("a");
          link.href = attachment.dataUrl;
          link.target = "_blank";
          link.rel = "noopener";
          link.click();
        }
        return;
      }

      const removeEvidenceButton = event.target.closest("[data-remove-evidence]");
      if (removeEvidenceButton) {
        const evidenceKey = removeEvidenceButton.dataset.removeEvidence;
        state.saved.evidence[evidenceKey] = (state.saved.evidence[evidenceKey] || [])
          .filter((attachment) => attachment.id !== removeEvidenceButton.dataset.evidenceId);
        refreshEvidenceZone(evidenceKey);
        markDirty();
        showToast("تم حذف الشاهد؛ اضغط حفظ لتثبيت التغيير");
      }
    });

    document.addEventListener("change", async (event) => {
      const input = event.target.closest("[data-evidence-upload]");
      if (!input || !input.files?.length) return;
      const evidenceKey = input.dataset.evidenceUpload;
      const label = input.closest(".evidence-add")?.querySelector("span");
      if (label) label.textContent = "جارٍ إدراج الشواهد…";
      try {
        const attachments = state.saved.evidence[evidenceKey] || [];
        for (const file of input.files) {
          if (!(file.type.startsWith("image/") || file.type === "application/pdf")) continue;
          attachments.push({
            id: createIdentifier(),
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: await readFileAsDataUrl(file),
          });
        }
        state.saved.evidence[evidenceKey] = attachments;
        refreshEvidenceZone(evidenceKey);
        markDirty();
        showToast("تم إدراج الشواهد داخل الخانة");
      } catch (error) {
        console.error(error);
        showToast("تعذر قراءة أحد الملفات المختارة");
      } finally {
        input.value = "";
        if (label) label.textContent = "＋ إدراج شاهد من الجهاز";
      }
    });

    window.addEventListener("beforeunload", (event) => {
      if (!state.dirty) return;
      event.preventDefault();
      event.returnValue = "";
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
    $("#printPlan").addEventListener("click", () => beginPrint("all"));
    $("#floatingPrint").addEventListener("click", () => beginPrint("all"));

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        savePlan();
      }
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
      const cards = $$(".slide-card");
      state.printSnapshot = cards.map((card) => ({ open: card.open, hidden: card.hidden }));
      state.previousTitle ||= document.title;
      document.body.classList.add("printing-plan");
      cards.forEach((card) => {
        card.hidden = state.printMode === "single" && card.dataset.slide !== state.singlePrintSlide;
        card.open = !card.hidden;
      });
    });
    window.addEventListener("afterprint", () => {
      $$(".slide-card").forEach((card, index) => {
        card.open = state.printSnapshot[index]?.open ?? card.open;
        card.hidden = state.printSnapshot[index]?.hidden ?? card.hidden;
      });
      document.body.classList.remove("printing-plan");
      if (state.previousTitle) document.title = state.previousTitle;
      state.previousTitle = "";
      state.printMode = "all";
      state.singlePrintSlide = null;
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

  async function initialize() {
    state.saved = await loadSavedState();
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
    setupEditor();
    setupObservers();
    onScroll();

    if (pageParams.get("view") === "plan") {
      document.body.classList.add("plan-preview");
      scrollTo(0, 0);
    }
  }

  initialize().catch((error) => {
    console.error(error);
    document.body.insertAdjacentHTML("beforeend", '<div class="toast show">تعذر تشغيل أدوات التحرير؛ أعد تحميل الصفحة.</div>');
  });

})();
