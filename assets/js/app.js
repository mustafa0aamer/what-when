/* ============================================================================
 * What When / هجدول — APPLICATION LOGIC
 * Phase 1: setup flow + limits
 * Phase 2: catalog, section picking, live grid, conflicts, PNG export
 * Phase 3: transposed grid, registered-courses list, limit toast, stacking
 * Structure: Store -> state -> utilities -> views (render/bind) -> renderAll
 * ========================================================================== */

"use strict";

/* ------------------------------------------------------------------ Store */
const Store = {
  KEY: "whatwhen-state-v2",
  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch { return {}; }
  },
  save(state) { localStorage.setItem(this.KEY, JSON.stringify(state)); },
  clear() { localStorage.removeItem(this.KEY); },
};

/* ----------------------------------------------------------------- State */
const persisted = Store.load();
const state = {
  lang: persisted.lang || "ar",
  step: persisted.step || "setup",          // 'setup' | 'notready' | 'catalog'
  dept: persisted.dept || null,
  creditOk: persisted.creditOk ?? null,
  project: persisted.project ?? null,
  gpaRuleId: persisted.gpaRuleId || null,
  extraHours: persisted.extraHours ?? false,
  maxCourses: persisted.maxCourses || 0,
  hoursLimit: persisted.hoursLimit || 0,
  selected: persisted.selected || [],       // array of course indexes
  picks: persisted.picks || {},             // courseIndex -> sectionIndex
  catalogView: persisted.catalogView || "grid",   // 'grid' | 'list'
};

function persist() { Store.save(state); }

/* ------------------------------------------------------------- Utilities */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function usedHours() {
  return state.selected.length * APP_CONFIG.creditHoursPerCourse +
    (state.project ? APP_CONFIG.project.creditHours : 0);
}

function computeLimit() {
  const rule = APP_CONFIG.gpaRules.find((r) => r.id === state.gpaRuleId);
  if (!rule) return;
  let hours = rule.maxHours;
  if (state.extraHours && rule.minGpa >= APP_CONFIG.extraHours.requiresGpa) {
    hours = APP_CONFIG.extraHours.maxHours;
  }
  state.hoursLimit = hours;
  const usable = hours - (state.project ? APP_CONFIG.project.creditHours : 0);
  state.maxCourses = Math.max(0, Math.floor(usable / APP_CONFIG.creditHoursPerCourse));
}

function groupCourses() {
  const order = [...APP_CONFIG.departments, "GEN"];
  const groups = new Map(order.map((d) => [d, []]));
  COURSES.forEach((course, idx) => groups.get(course.dept).push({ course, idx }));
  return order
    .map((dept) => ({ dept, items: groups.get(dept) }))
    .filter((g) => g.items.length > 0);
}

/* transient toast (limit & notices) */
function showToast(message) {
  $(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `${ICONS.alert}<span>${esc(message)}</span>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-visible"));
  setTimeout(() => {
    el.classList.remove("is-visible");
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ----------------------------------------------------------- SVG helpers */
const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.993L2 22l5.233-1.371a9.994 9.994 0 0 0 4.779 1.217h.004c5.505 0 9.99-4.478 9.99-9.984 0-2.669-1.038-5.176-2.925-7.062A9.935 9.935 0 0 0 12.012 2zm5.834 14.128c-.242.679-1.4 1.29-1.954 1.37-.5.082-1.144.114-1.843-.11-.424-.136-.973-.314-1.66-.612-2.922-1.264-4.81-4.2-4.956-4.396-.145-.196-1.182-1.572-1.182-2.997 0-1.426.747-2.127 1.012-2.417.266-.29.58-.363.774-.363.193 0 .387.002.556.01.179.01.416-.068.65.493.242.58.822 2.006.894 2.152.073.145.121.315.024.508-.097.193-.145.314-.29.483-.145.17-.306.38-.436.508-.145.145-.298.306-.129.596.17.29.754 1.242 1.618 2.012 1.112.992 2.047 1.3 2.345 1.445.298.145.472.121.645-.073.174-.193.742-.862.943-1.152.202-.29.395-.242.66-.145.267.097 1.693.798 1.983.943.29.145.484.218.556.339.073.12.073.693-.169 1.372z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-2.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3Z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="0.4" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><polyline points="6.5 9.5 12 15 17.5 9.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',
};

/* -------------------------------------------------------------- Chrome */
function renderChrome() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.title = tr(APP_CONFIG.toolName) + " | " + APP_CONFIG.toolName.en;

  $("#appHeader").innerHTML = `
    <div class="header-inner">
      <a href="#" class="brand" id="brandLink" title="${esc(t("brandHome"))}" aria-label="${esc(tr(APP_CONFIG.toolName))} - ${esc(t("brandHome"))}">
        <span class="brand-icon">${ICONS.calendar}</span>
        <div class="brand-text">
          <strong>${esc(tr(APP_CONFIG.toolName))}</strong>
          <small>${esc(tr(APP_CONFIG.academicTerm))}</small>
        </div>
      </a>
      <div class="header-actions">
        <button class="icon-btn" id="langToggle" type="button">${esc(t("langToggle"))}</button>
      </div>
    </div>`;

  const brandLink = $("#brandLink");
  if (brandLink) {
    brandLink.addEventListener("click", (e) => {
      e.preventDefault();
      goBackToSetup();
    });
  }

  $("#appFooter").innerHTML = `
    <p class="footer-note">
      <span class="footer-icon">${ICONS.alert}</span>
      ${esc(t("footerNote"))}
    </p>`;

  let wa = $("#waFloat");
  if (!wa) {
    document.body.insertAdjacentHTML("beforeend",
      `<a class="wa-float" id="waFloat" target="_blank" rel="noopener"
          title="${esc(t("whatsappAria"))}" aria-label="${esc(t("whatsappAria"))}">${ICONS.whatsapp}</a>`);
    wa = $("#waFloat");
  } else {
    wa.innerHTML = ICONS.whatsapp;
    wa.setAttribute("title", t("whatsappAria"));
    wa.setAttribute("aria-label", t("whatsappAria"));
  }
  wa.href = APP_CONFIG.whatsapp.link;
  if (!wa.dataset.bound) {
    wa.dataset.bound = "true";
    wa.addEventListener("click", () => {
      if (typeof Analytics !== "undefined") Analytics.trackWhatsAppClick("floating_button");
    });
  }

  $("#langToggle").addEventListener("click", () => {
    state.lang = state.lang === "ar" ? "en" : "ar";
    persist();
    renderAll();
  });
}

/* ---------------------------------------------------------- Setup view */
function renderSetup() {
  const deptOptions = APP_CONFIG.departments.map((d) =>
    `<option value="${d}" ${state.dept === d ? "selected" : ""}>${esc(d)} — ${esc(tr(DEPT_NAMES[d]))}</option>`
  ).join("");

  const gpaOptions = APP_CONFIG.gpaRules.map((r) =>
    `<option value="${r.id}" ${state.gpaRuleId === r.id ? "selected" : ""}>${esc(tr(r.label))} — ${esc(tr(r.desc))}</option>`
  ).join("");

  const checked = (v) => (v === true ? "checked" : "");
  const creditChecked = (v) => (state.creditOk === v ? "checked" : "");
  const projectChecked = (v) => (state.project === v ? "checked" : "");

  return `
  <section class="card setup-card">
    <h1 class="card-title">${esc(t("setupTitle"))}</h1>
    <p class="card-subtitle">${esc(t("setupSubtitle"))}</p>

    <form id="setupForm" novalidate>
      <div class="field">
        <label class="field-label" for="dept">${esc(t("deptLabel"))}</label>
        <select id="dept" required>
          <option value="" disabled ${state.dept ? "" : "selected"}>${esc(t("deptPlaceholder"))}</option>
          ${deptOptions}
        </select>
      </div>

      <div class="field">
        <span class="field-label">${esc(t("creditLabel"))}</span>
        <div class="choice-row">
          <label class="choice">
            <input type="radio" name="credit" value="ok" ${creditChecked(true)}>
            <span>${esc(t("creditOk"))}</span>
          </label>
          <label class="choice">
            <input type="radio" name="credit" value="low" ${creditChecked(false)}>
            <span>${esc(t("creditLow"))}</span>
          </label>
        </div>
      </div>

      <div class="field">
        <span class="field-label">${esc(t("projectLabel"))}</span>
        <div class="choice-row">
          <label class="choice">
            <input type="radio" name="project" value="yes" ${projectChecked(true)}>
            <span>${esc(t("yes"))}</span>
          </label>
          <label class="choice">
            <input type="radio" name="project" value="no" ${projectChecked(false)}>
            <span>${esc(t("no"))}</span>
          </label>
        </div>
        <p class="field-hint">${esc(t("projectHint"))}</p>
      </div>

      <div class="field">
        <label class="field-label" for="gpa">${esc(t("gpaLabel"))}</label>
        <select id="gpa" required>
          <option value="" disabled ${state.gpaRuleId ? "" : "selected"} hidden></option>
          ${gpaOptions}
        </select>
      </div>

      <div class="field" id="extraHoursField" hidden>
        <label class="choice choice-block">
          <input type="checkbox" id="extraHours" ${checked(state.extraHours)}>
          <span>${esc(t("extraHoursLabel"))}</span>
        </label>
        <p class="field-hint">${esc(t("extraHoursHint"))}</p>
      </div>

      <button class="btn btn-primary btn-block" type="submit">${esc(t("startBtn"))}</button>
    </form>
  </section>`;
}

function bindSetup() {
  const form = $("#setupForm");
  if (!form) return;

  const gpaSelect = $("#gpa");
  const extraField = $("#extraHoursField");

  const syncExtraField = () => {
    const rule = APP_CONFIG.gpaRules.find((r) => r.id === gpaSelect.value);
    const show = !!rule && rule.minGpa >= APP_CONFIG.extraHours.requiresGpa;
    extraField.hidden = !show;
    if (!show) $("#extraHours").checked = false;
  };
  gpaSelect.addEventListener("change", syncExtraField);
  syncExtraField();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    state.dept = $("#dept").value || null;
    const credit = form.querySelector('input[name="credit"]:checked');
    const project = form.querySelector('input[name="project"]:checked');
    state.creditOk = credit ? credit.value === "ok" : null;
    state.project = project ? project.value === "yes" : null;
    state.gpaRuleId = gpaSelect.value || null;
    state.extraHours = $("#extraHours").checked;

    if (!state.dept || state.creditOk === null || state.project === null || !state.gpaRuleId) {
      form.classList.add("shake");
      setTimeout(() => form.classList.remove("shake"), 400);
      return;
    }

    state.selected = [];
    state.picks = {};
    if (!state.creditOk) {
      state.step = "notready";
    } else {
      computeLimit();
      state.step = "catalog";
      if (typeof Analytics !== "undefined") {
        Analytics.trackScheduleStarted(state);
      }
    }
    persist();
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* -------------------------------------------------------- Not-ready view */
function renderNotReady() {
  return `
  <section class="card notready-card">
    <span class="notready-icon">${ICONS.alert}</span>
    <h1 class="card-title">${esc(t("notReadyTitle"))}</h1>
    <p class="card-subtitle">${esc(t("notReadyBody"))}</p>
    <div class="notready-actions">
      <a class="btn btn-primary" href="${APP_CONFIG.whatsapp.link}" target="_blank" rel="noopener">
        ${ICONS.whatsapp}<span>${esc(t("contactDev"))}</span>
      </a>
      <button class="btn btn-ghost" id="backBtn" type="button">${esc(t("editInfo"))}</button>
    </div>
  </section>`;
}

function bindNotReady() {
  const back = $("#backBtn");
  if (back) back.addEventListener("click", goBackToSetup);
  const waBtn = $(".notready-actions a");
  if (waBtn) waBtn.addEventListener("click", () => {
    if (typeof Analytics !== "undefined") Analytics.trackWhatsAppClick("not_ready_page");
  });
}

function goBackToSetup() {
  state.step = "setup";
  persist();
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ============================================================ PLANNER === */
function renderCourseCard(course, idx) {
  const isSelected = state.selected.includes(idx);
  const isMandatory = course.mandatoryFor.includes(state.dept);
  const pick = state.picks[idx] ?? null;

  const badges = [];
  if (isMandatory) {
    badges.push(`<span class="badge badge-mandatory">${ICONS.check}${esc(t("mandatoryBadge"))}</span>`);
  } else {
    badges.push(`<span class="badge badge-optional">${esc(t("optionalBadge"))}</span>`);
  }
  if (course.mandatoryFor.length && !isMandatory) {
    badges.push(`<span class="badge badge-forothers">${esc(t("mandatoryForPrefix"))} ${esc(course.mandatoryFor.join(", "))}</span>`);
  }
  badges.push(`<span class="badge badge-level">${esc(t("levelPrefix"))} ${course.level}</span>`);

  const meta = [
    course.code ? `<span class="course-code">${esc(course.code)}</span>` : "",
    ...badges,
  ].join("");

  const counts = `
    <span class="course-count">${course.lectures.length} ${esc(t("lecturesCount"))}</span>
    <span class="course-count">${course.sections.length} ${esc(t("sectionsCount"))}</span>
    ${isSelected && pick != null ? `<span class="course-count course-count--picked">${ICONS.check}${esc(Timetable.sectionLabel(course.sections[pick]))}</span>` : ""}`;

  return `
  <div class="course-card ${isSelected ? "is-selected" : ""}">
    <label class="course-check-row">
      <input type="checkbox" class="course-check" data-idx="${idx}" ${isSelected ? "checked" : ""}>
      <div class="course-body">
        <div class="course-top">
          <span class="course-name">${esc(course.name)}</span>
          ${counts}
        </div>
        <div class="course-meta">${meta}</div>
      </div>
    </label>
  </div>`;
}

function renderGroup(dept, items, asList) {
  const head = `
    <span class="dept-code">${esc(dept)}</span>
    <span class="dept-name">${esc(tr(DEPT_NAMES[dept]))}</span>
    <span class="dept-count">${items.length}</span>`;

  const list = `<div class="course-list">${items.map(({ course, idx }) => renderCourseCard(course, idx)).join("")}</div>`;

  if (asList) {
    return `
    <details class="dept-group dept-details" ${dept === state.dept ? "open" : ""}>
      <summary class="dept-title">${head}</summary>
      ${list}
    </details>`;
  }
  return `
  <section class="dept-group">
    <h3 class="dept-title">${head}</h3>
    ${list}
  </section>`;
}

/* --------------------------------------------- Registered courses list */
function renderRegisteredList(model) {
  const conflicted = new Set();
  model.conflicts.forEach((c) => c.items.forEach((p) => conflicted.add(p.courseIdx)));

  const items = state.selected.map((idx) => {
    const course = COURSES[idx];
    const pick = state.picks[idx] ?? null;
    const clash = conflicted.has(idx);
    const mand = course.mandatoryFor.includes(state.dept);

    return `
    <div class="reg-item ${clash ? "reg-item--clash" : ""}">
      <div class="reg-info">
        ${clash ? `<span class="reg-clashicon" title="${esc(t("conflictSection"))}">${ICONS.alert}</span>` : ""}
        <span class="reg-name">
          ${course.code ? `<strong class="course-code">${esc(course.code)}</strong>` : ""}
          ${esc(course.name)}
        </span>
        <span class="badge ${mand ? "badge-mandatory" : "badge-optional"}">${esc(mand ? t("mandatoryShort") : t("optionalShort"))}</span>
      </div>
      <div class="reg-actions">
        <select class="section-select" data-idx="${idx}">
          <option value="" ${pick == null ? "selected" : ""} disabled>${esc(t("pickSectionPh"))}</option>
          ${course.sections.map((s, i) =>
            `<option value="${i}" ${pick === i ? "selected" : ""}>${esc(Timetable.sectionLabel(s))}</option>`
          ).join("")}
        </select>
        <button class="icon-btn reg-remove" data-idx="${idx}" type="button"
                title="${esc(t("removeCourse"))}" aria-label="${esc(t("removeCourse"))}">${ICONS.x}</button>
      </div>
    </div>`;
  }).join("");

  return `
  <section class="registered-panel" id="registered">
    <h2 class="registered-title">${esc(t("registeredTitle"))}</h2>
    <p class="registered-subtitle">${esc(t("registeredSubtitle"))}</p>
    ${state.selected.length
      ? `<div class="reg-list">${items}</div>`
      : `<p class="registered-empty">${esc(t("registeredEmpty"))}</p>`}
  </section>`;
}

/* ------------------------------------------------------ Timetable panel */
function renderGridCell(day, slot, model) {
  const items = model.cells[`${day.key}:${slot.n}`] || [];
  const cellCls = items.some((p) => p.conflict === "lecture") && !items.some((p) => p.kind === "section")
    ? "tt-cell--lecture"
    : items.some((p) => p.conflict) ? "tt-cell--section" : "";

  const body = items.map((p) => {
    const title = (p.first || p.kind === "section")
      ? `<strong class="tt-code">${esc(p.course.code || "")}</strong><span class="tt-cname">${esc(p.course.name)}</span>`
      : `<strong class="tt-code">${esc(p.course.code || "")}</strong><span class="tt-cont">${esc(t("continuation"))}</span>`;
    return `
    <div class="tt-item tt-item--${p.kind} ${p.conflict ? "tt-item--clash-" + p.conflict : ""}">
      <div class="tt-item-top">
        <span class="tt-kind">${p.kind === "lecture" ? esc(t("lectureWord")) : esc(t("sectionWord"))}</span>
        ${p.conflict ? `<span class="tt-clash">${ICONS.alert}</span>` : ""}
      </div>
      <div class="tt-item-title">${title}</div>
      <div class="tt-item-sub">${esc(p.place)}${p.doctor ? " · " + esc(p.doctor) : ""}${p.labels ? " · " + esc(p.labels.join(", ")) : ""}</div>
    </div>`;
  }).join("");

  const faculty = !items.length && FACULTY_ACTIVITY.day === day.key && FACULTY_ACTIVITY.slot === slot.n
    ? `<span class="tt-faculty">${esc(tr(FACULTY_ACTIVITY.label))}</span>` : "";

  return `<td class="tt-cell ${cellCls}">${body}${faculty}</td>`;
}

function renderConflict(c) {
  const day = DAYS.find((d) => d.key === c.day);
  const slot = SLOTS.find((s) => s.n === c.slot);

  const items = c.items.map((p) => {
    const mand = p.course.mandatoryFor.includes(state.dept);
    return `
    <li>
      <span class="warn-kind warn-kind--${p.kind}">${p.kind === "lecture" ? esc(t("lectureWord")) : esc(t("sectionWord"))}</span>
      <strong>${esc(p.course.code || "")}</strong> ${esc(p.course.name)} · ${esc(p.place)}
      ${p.doctor ? " · " + esc(p.doctor) : ""}${p.labels ? " · " + esc(p.labels.join("/")) : ""}
      <span class="badge ${mand ? "badge-mandatory" : "badge-optional"}">${esc(mand ? t("mandatoryShort") : t("optionalShort"))}</span>
    </li>`;
  }).join("");

  const hint = c.type === "lecture"
    ? t("hintLectureHard")
    : t("hintSectionFix") + (c.items.some((p) => !p.course.mandatoryFor.includes(state.dept))
        ? " " + t("hintOptionalSwap") : "");

  return `
  <div class="warn warn--${c.type}">
    <div class="warn-head">
      <span class="warn-icon">${ICONS.alert}</span>
      <strong>${esc(c.type === "lecture" ? t("conflictLecture") : t("conflictSection"))}</strong>
      <span class="warn-meta">${esc(tr(day))} · ${esc(t("slotWord"))} ${slot.n} (${esc(slot.short)} / ${esc(slot.long)})</span>
    </div>
    <ul class="warn-items">${items}</ul>
    <p class="warn-hint">${esc(hint)}</p>
  </div>`;
}

function renderTimetablePanel(model) {
  const pending = state.selected.filter((i) => state.picks[i] == null).length;
  const hasConflicts = model.conflicts.length > 0;

  /* transposed grid: days = rows, Slot 1..7 = columns (both times on top) */
  return `
  <section class="timetable-panel" id="timetable">
    <div class="tt-head">
      <h2 class="tt-title">${esc(t("myTimetable"))}</h2>
      <div class="tt-actions">
        <span class="tt-status ${hasConflicts ? "tt-status--bad" : "tt-status--ok"}">
          ${hasConflicts
            ? `${ICONS.alert}<span>${model.conflicts.length} ${esc(t("conflictsUnit"))}</span>`
            : `${ICONS.check}<span>${esc(t("noConflicts"))}</span>`}
        </span>
        <button class="btn btn-ghost btn-small" id="exportBtn" type="button">${ICONS.download}<span>${esc(t("exportBtn"))}</span></button>
      </div>
    </div>

    <div class="export-panel" id="exportPanel" hidden>
      <label class="choice choice-block">
        <input type="radio" name="exportMode" value="full" checked>
        <span>${esc(t("exportFull"))}</span>
      </label>
      <label class="choice choice-block">
        <input type="radio" name="exportMode" value="compact">
        <span>${esc(t("exportCompact"))}</span>
      </label>
      <button class="btn btn-primary btn-block" id="doExport" type="button">${ICONS.download}<span>${esc(t("download"))}</span></button>
    </div>

    ${pending ? `
    <p class="pending-banner">${ICONS.clock}<span>${esc(t("pendingBanner").replace("{n}", pending))}</span></p>` : ""}

    <div class="tt-wrap">
      <table class="tt-table">
        <thead>
          <tr>
            <th class="tt-corner">${esc(t("dayWord"))}</th>
            ${SLOTS.map((sl) => `
            <th class="tt-slothead">
              <span class="tt-slot-n">${esc(t("slotWord"))} ${sl.n}</span>
              <span class="tt-slot-t">${esc(sl.short)}<br>${esc(sl.long)}</span>
            </th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${DAYS.map((d) => `
          <tr>
            <th class="tt-dayrow">${esc(tr(d))}</th>
            ${SLOTS.map((sl) => renderGridCell(d, sl, model)).join("")}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>

    ${!state.selected.length ? `<p class="grid-hint">${esc(t("gridHint"))}</p>` : ""}

    <div class="warn-area">
      ${model.conflicts.map(renderConflict).join("")}
    </div>
  </section>`;
}

/* ---------------------------------------------------------- Planner view */
function renderPlanner() {
  const deptName = tr(DEPT_NAMES[state.dept]);
  const groups = groupCourses();
  const model = Timetable.build(state);
  const asList = state.catalogView === "list";

  const groupHtml = groups.map(({ dept, items }) => renderGroup(dept, items, asList)).join("");

  return `
  <div class="planner">
    <div class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">${esc(t("deptLabel"))}</span>
        <span class="summary-value">${esc(state.dept)} · ${esc(deptName)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">${esc(t("yourLimit"))}</span>
        <span class="summary-value">${state.maxCourses} ${esc(t("coursesUnit"))}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">${esc(t("selectedLabel"))}</span>
        <span class="summary-value" id="selectedCounter">${esc(t("selectedOf").replace("{selected}", state.selected.length).replace("{max}", state.maxCourses))}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">${esc(t("hoursLabel"))}</span>
        <span class="summary-value">${usedHours()} / ${state.hoursLimit}</span>
      </div>
      <div class="summary-nav">
        <button class="btn btn-ghost btn-small" data-goto="#catalog" type="button">${ICONS.book}<span>${esc(t("navCourses"))}</span></button>
        <button class="btn btn-ghost btn-small" data-goto="#registered" type="button">${ICONS.check}<span>${esc(t("navRegistered"))}</span></button>
        <button class="btn btn-ghost btn-small" data-goto="#timetable" type="button">${ICONS.calendar}<span>${esc(t("navTimetable"))}</span></button>
      </div>
      <button class="btn btn-ghost btn-small" id="editInfoBtn" type="button">${esc(t("editInfo"))}</button>
    </div>

    <div class="catalog-col" id="catalog">
      <header class="catalog-header">
        <h1 class="card-title">${esc(t("catalogTitle"))}</h1>
        <p class="card-subtitle">${esc(t("catalogSubtitle"))}</p>
        <div class="view-toggle" role="group" aria-label="catalog view">
          <button type="button" data-view="grid" class="view-btn ${!asList ? "is-active" : ""}">${ICONS.grid}<span>${esc(t("viewGrid"))}</span></button>
          <button type="button" data-view="list" class="view-btn ${asList ? "is-active" : ""}">${ICONS.list}<span>${esc(t("viewList"))}</span></button>
        </div>
      </header>
      ${groupHtml}
    </div>

    ${renderRegisteredList(model)}

    ${renderTimetablePanel(model)}
  </div>`;
}

function bindPlanner() {
  const editBtn = $("#editInfoBtn");
  if (editBtn) editBtn.addEventListener("click", goBackToSetup);

  $$("[data-view]").forEach((btn) => btn.addEventListener("click", () => {
    state.catalogView = btn.dataset.view;
    persist();
    renderAll();
  }));

  $$("[data-goto]").forEach((btn) => btn.addEventListener("click", () => {
    const el = $(btn.dataset.goto);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  $$(".course-check").forEach((box) => {
    box.addEventListener("change", () => {
      const idx = Number(box.dataset.idx);
      const course = COURSES[idx];
      if (box.checked) {
        if (state.selected.length >= state.maxCourses) {
          box.checked = false;
          showToast(t("limitReached"));
          box.closest(".course-card")?.classList.add("shake");
          setTimeout(() => box.closest(".course-card")?.classList.remove("shake"), 400);
          return;
        }
        if (!state.selected.includes(idx)) {
          state.selected.push(idx);
          if (typeof Analytics !== "undefined") {
            Analytics.trackCourseToggled(course?.code, tr(course?.name), true);
          }
        }
      } else {
        state.selected = state.selected.filter((i) => i !== idx);
        delete state.picks[idx];
        if (typeof Analytics !== "undefined") {
          Analytics.trackCourseToggled(course?.code, tr(course?.name), false);
        }
      }
      computeLimit();
      persist();
      renderAll();
    });
  });

  $$(".section-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.dataset.idx);
      const course = COURSES[idx];
      if (sel.value === "") {
        delete state.picks[idx];
      } else {
        const pickIdx = Number(sel.value);
        state.picks[idx] = pickIdx;
        if (typeof Analytics !== "undefined") {
          const sec = course?.sections[pickIdx];
          Analytics.trackSectionPicked(tr(course?.name), sec ? Timetable.sectionLabel(sec) : String(pickIdx));
        }
      }
      persist();
      renderAll();
    });
  });

  $$(".reg-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const course = COURSES[idx];
      state.selected = state.selected.filter((i) => i !== idx);
      delete state.picks[idx];
      if (typeof Analytics !== "undefined") {
        Analytics.trackCourseToggled(course?.code, tr(course?.name), false);
      }
      computeLimit();
      persist();
      renderAll();
    });
  });

  const exportBtn = $("#exportBtn");
  const exportPanel = $("#exportPanel");
  if (exportBtn) exportBtn.addEventListener("click", () => { exportPanel.hidden = !exportPanel.hidden; });

  const doExport = $("#doExport");
  if (doExport) doExport.addEventListener("click", () => {
    const mode = (document.querySelector('input[name="exportMode"]:checked') || {}).value || "full";
    if (typeof Analytics !== "undefined") {
      const model = Timetable.build(state);
      Analytics.trackImageExported(mode, state, (model.conflicts || []).length);
    }
    Timetable.exportPNG(mode);
    exportPanel.hidden = true;
  });
}

/* -------------------------------------------------------------- Render */
function renderAll() {
  renderChrome();
  const app = $("#app");
  if (state.step === "catalog" && state.maxCourses === 0) computeLimit();
  if (state.step === "catalog" && !state.creditOk) state.step = "notready";

  if (state.step === "notready") {
    app.innerHTML = renderNotReady();
    bindNotReady();
  } else if (state.step === "catalog") {
    app.innerHTML = renderPlanner();
    bindPlanner();
  } else {
    app.innerHTML = renderSetup();
    bindSetup();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Analytics !== "undefined") {
    Analytics.init();
  }
  renderAll();
});
