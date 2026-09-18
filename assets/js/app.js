/* ============================================================================
 * What When — APPLICATION LOGIC
 * Phase 1: setup flow + course catalog + course-limit enforcement
 * Phase 2: section picking + live timetable grid + conflict detection + PNG export
 * Phase 3 (later): admin page
 * Structure: Store -> state -> utilities -> views (render/bind) -> renderAll
 * ========================================================================== */

"use strict";

/* ------------------------------------------------------------------ Store */
const Store = {
  KEY: "whatwhen-state-v1",
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

/* ----------------------------------------------------------- SVG helpers */
const ICONS = {
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.96L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.13 15.07l-.3-.18-3.06.88.9-2.98-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.1 4.03c-.18 0-.47.07-.72.34-.24.27-.94.92-.94 2.24 0 1.32.96 2.6 1.1 2.78.13.18 1.88 3 4.65 4.08 2.3.9 2.77.72 3.27.68.5-.05 1.6-.65 1.83-1.28.22-.63.22-1.17.15-1.28-.06-.11-.24-.18-.5-.31-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.13-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07a7.4 7.4 0 0 1-2.18-1.35 8.2 8.2 0 0 1-1.51-1.88c-.16-.27-.02-.42.12-.55.12-.12.27-.32.4-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.13-.6-1.46-.83-2-.2-.47-.4-.41-.56-.42l-.6-.03Z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-2.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3Z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17" r="0.4" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12.5 9.5 18 20 6.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><polyline points="6.5 9.5 12 15 17.5 9.5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
};

/* -------------------------------------------------------------- Chrome */
function renderChrome() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.title = tr(APP_CONFIG.toolName) + " | " + APP_CONFIG.toolName.en;

  $("#appHeader").innerHTML = `
    <div class="header-inner">
      <div class="brand">
        <span class="brand-icon">${ICONS.calendar}</span>
        <div class="brand-text">
          <strong>${esc(tr(APP_CONFIG.toolName))}</strong>
          <small>${esc(tr(APP_CONFIG.academicTerm))}</small>
        </div>
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="langToggle" type="button">${esc(t("langToggle"))}</button>
      </div>
    </div>`;

  $("#appFooter").innerHTML = `
    <p class="footer-note">
      <span class="footer-icon">${ICONS.alert}</span>
      ${esc(t("footerNote"))}
    </p>`;

  /* floating WhatsApp button (single contact point) */
  if (!$("#waFloat")) {
    document.body.insertAdjacentHTML("beforeend",
      `<a class="wa-float" id="waFloat" target="_blank" rel="noopener"
          title="${esc(t("whatsappAria"))}" aria-label="${esc(t("whatsappAria"))}">${ICONS.whatsapp}</a>`);
  }
  $("#waFloat").href = APP_CONFIG.whatsapp.link;

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
  const limitFull = state.selected.length >= state.maxCourses;
  const disabled = !isSelected && limitFull;
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
    course.code
      ? `<span class="course-code">${esc(course.code)}</span>`
      : `<span class="course-code course-code-missing">${esc(t("noCode"))}</span>`,
    ...badges,
  ].join("");

  const counts = `
    <span class="course-count">${course.lectures.length} ${esc(t("lecturesCount"))}</span>
    <span class="course-count">${course.sections.length} ${esc(t("sectionsCount"))}</span>`;

  const pickRow = isSelected && course.sections.length ? `
    <div class="pick-row">
      <label class="pick-label">${esc(t("pickSection"))}</label>
      <select class="section-select" data-idx="${idx}">
        <option value="" ${pick == null ? "selected" : ""} disabled>${esc(t("pickSectionPh"))}</option>
        ${course.sections.map((s, i) =>
          `<option value="${i}" ${pick === i ? "selected" : ""}>${esc(Timetable.sectionLabel(s))}</option>`
        ).join("")}
      </select>
    </div>` : "";

  const noLecNote = isSelected && !course.lectures.length ? `
    <p class="no-lec-note">${ICONS.alert}<span>${esc(t("noLectureWarning"))}</span></p>` : "";

  return `
  <div class="course-card ${isSelected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}">
    <label class="course-check-row">
      <input type="checkbox" class="course-check" data-idx="${idx}" ${isSelected ? "checked" : ""} ${disabled ? "disabled" : ""}>
      <div class="course-body">
        <div class="course-top">
          <span class="course-name">${esc(course.name)}</span>
          ${counts}
        </div>
        <div class="course-meta">${meta}</div>
      </div>
    </label>
    ${pickRow}
    ${noLecNote}
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

/* ------------------------------------------------------ Timetable panel */
function renderGridCell(day, slot, model) {
  const items = model.cells[`${day.key}:${slot.n}`] || [];
  const cellCls = items.some((p) => p.conflict === "lecture") && !items.some((p) => p.kind === "section")
    ? "tt-cell--lecture"
    : items.some((p) => p.conflict) ? "tt-cell--section" : "";

  const body = items.map((p) => {
    const code = p.course.code || t("noCode");
    const title = (p.first || p.kind === "section")
      ? `<strong class="tt-code">${esc(code)}</strong><span class="tt-cname">${esc(p.course.name)}</span>`
      : `<strong class="tt-code">${esc(code)}</strong><span class="tt-cont">${esc(t("continuation"))}</span>`;
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
    const code = p.course.code || t("noCode");
    return `
    <li>
      <span class="warn-kind warn-kind--${p.kind}">${p.kind === "lecture" ? esc(t("lectureWord")) : esc(t("sectionWord"))}</span>
      <strong>${esc(code)}</strong> ${esc(p.course.name)} · ${esc(p.place)}
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
            <th class="tt-corner">${esc(t("slotWord"))}</th>
            ${DAYS.map((d) => `<th class="tt-day">${esc(tr(d))}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${SLOTS.map((sl) => `
          <tr>
            <th class="tt-slot">
              <span class="tt-slot-n">${esc(t("slotWord"))} ${sl.n}</span>
              <span class="tt-slot-t">${esc(sl.short)}<br>${esc(sl.long)}</span>
            </th>
            ${DAYS.map((d) => renderGridCell(d, sl, model)).join("")}
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
        <button class="btn btn-ghost btn-small" data-goto="#timetable" type="button">${ICONS.calendar}<span>${esc(t("navTimetable"))}</span></button>
      </div>
      <button class="btn btn-ghost btn-small" id="editInfoBtn" type="button">${esc(t("editInfo"))}</button>
    </div>

    <p class="limit-warning" id="limitWarning" ${state.selected.length >= state.maxCourses ? "" : "hidden"}>
      ${ICONS.alert}<span>${esc(t("limitReached"))}</span>
    </p>

    <div class="planner-layout">
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

      <div class="tt-col">
        <div class="tt-sticky">
          ${renderTimetablePanel(model)}
        </div>
      </div>
    </div>
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
      if (box.checked) {
        if (!state.selected.includes(idx)) state.selected.push(idx);
      } else {
        state.selected = state.selected.filter((i) => i !== idx);
        delete state.picks[idx];
      }
      computeLimit();
      persist();
      renderAll();
    });
  });

  $$(".section-select").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.dataset.idx);
      if (sel.value === "") delete state.picks[idx];
      else state.picks[idx] = Number(sel.value);
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

document.addEventListener("DOMContentLoaded", renderAll);