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
  KEY: "whatwhen-state-v4",
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.KEY));
      if (saved) return saved;
      // Fallback/migrate from v3 or earlier if present
      const v3 = JSON.parse(localStorage.getItem("whatwhen-state-v3"));
      if (v3) {
        return {
          lang: v3.lang || "ar",
          dept: v3.dept || "CS",
          passedHours: 96,
          gpa: 2.5,
          project: v3.project ?? false,
          extraHours: v3.extraHours ?? false,
          selected: v3.selected || [],
          picks: v3.picks || {},
          catalogView: v3.catalogView || "grid",
        };
      }
      return {};
    }
    catch { return {}; }
  },
  save(state) { localStorage.setItem(this.KEY, JSON.stringify(state)); },
  clear() { localStorage.removeItem(this.KEY); },
};

/* ----------------------------------------------------------------- State */
const persisted = Store.load();
const state = {
  lang: persisted.lang || "ar",
  step: persisted.step || "setup",          // 'setup' | 'catalog'
  isNewcomer: persisted.isNewcomer ?? false,// true for first-term freshmen (no GPA or hours)
  passedHours: persisted.passedHours != null ? Number(persisted.passedHours) : null,
  gpa: persisted.gpa != null ? Number(persisted.gpa) : null,
  gpaMode: persisted.gpaMode || "band",     // 'band' | 'manual'
  gpaBand: persisted.gpaBand || null,       // '3.0' | '2.0' | '1.5' | '0.8' | 'manual'
  level: persisted.level || (persisted.passedHours != null ? ACADEMIC_BYLAWS.calcLevel(persisted.passedHours) : 4),
  group: persisted.group || "A",           // 'A' | 'B' (cohort for levels 1 & 2)
  lecturePicks: persisted.lecturePicks || {}, // courseIndex -> 'A' | 'B' (for levels 3 & 4 senior flexibility)
  dept: persisted.dept || null,             // 'CS' | 'IT' | 'IS' | 'DS' | 'AI' | 'GEN'
  project: persisted.project ?? false,      // only allowed if passedHours >= 85
  extraHours: persisted.extraHours ?? false,// only allowed if canOverload
  allowConflicts: persisted.allowConflicts ?? false, // Conflict Waiver Mode (فتح التعارض)
  maxCourses: persisted.maxCourses || 0,
  hoursLimit: persisted.hoursLimit || 0,
  selected: persisted.selected || [],       // array of course indexes
  picks: persisted.picks || {},             // courseIndex -> sectionIndex
  pinnedSections: persisted.pinnedSections || {}, // courseIndex -> boolean
  attendance: persisted.attendance || {},   // courseIndex -> { lecture: 'mandatory'|'skip'|'rare', section: 'mandatory'|'skip'|'rare' }
  catalogView: persisted.catalogView || "grid",   // 'grid' | 'list'
  catalogLevelFilter: persisted.catalogLevelFilter || "all", // 'all' | 1 | 2 | 3 | 4 | 'retake'
};

/* Smart Optimizer Modal State */
const optState = {
  isOpen: false,
  tab: "focus",                  // 'focus' | 'compare'
  selectedScenario: "min_walking",
  appliedScenarioId: null,
};

/* Official Schedule Viewer Modal State */
const schedModalState = {
  isOpen: false,
};

/* Attendance Preferences Modal State */
const attendanceModalState = {
  isOpen: false,
};

/* First-Visit Schedule Tour Spotlight State */
const tourState = {
  isOpen: !localStorage.getItem("whatwhen_schedule_tour_seen_v3"),
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

function helpTip(text, id = "") {
  if (!text) return "";
  const idAttr = id ? ` id="${esc(id)}"` : "";
  return `<button type="button" class="help-tip-btn"${idAttr} data-tip="${esc(text)}" aria-label="${esc(t("helpTipAria"))}" aria-expanded="false">?</button>`;
}

let activeHelpBtn = null;

function closeHelpPopover() {
  if (activeHelpBtn) {
    activeHelpBtn.classList.remove("is-active");
    activeHelpBtn.setAttribute("aria-expanded", "false");
    activeHelpBtn = null;
  }
  $("#helpPopover")?.remove();
  $("#helpPopoverBackdrop")?.remove();
}

function openHelpPopover(btn) {
  const text = btn.getAttribute("data-tip");
  if (!text) return;

  if (activeHelpBtn === btn) {
    closeHelpPopover();
    return;
  }

  closeHelpPopover();
  activeHelpBtn = btn;
  btn.classList.add("is-active");
  btn.setAttribute("aria-expanded", "true");

  const isMobile = window.innerWidth <= 640;
  if (isMobile) {
    const backdrop = document.createElement("div");
    backdrop.id = "helpPopoverBackdrop";
    backdrop.className = "help-popover-backdrop";
    backdrop.addEventListener("click", closeHelpPopover);
    document.body.appendChild(backdrop);
  }

  const pop = document.createElement("div");
  pop.id = "helpPopover";
  pop.className = `help-popover ${isMobile ? "help-popover--mobile" : "help-popover--desktop"}`;
  pop.setAttribute("role", "tooltip");
  pop.innerHTML = `
    <div class="help-popover-inner">
      <p class="help-popover-text">${esc(text)}</p>
      <button type="button" class="help-popover-close" aria-label="Close">×</button>
    </div>`;
  document.body.appendChild(pop);

  pop.querySelector(".help-popover-close")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeHelpPopover();
  });

  if (!isMobile) {
    const rect = btn.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const margin = 12;

    let top = rect.bottom + 8;
    let placeAbove = false;
    if (top + popRect.height > window.innerHeight - margin && rect.top - popRect.height - 8 > margin) {
      top = rect.top - popRect.height - 8;
      placeAbove = true;
    }

    let left = rect.left + rect.width / 2 - popRect.width / 2;
    left = Math.max(margin, Math.min(window.innerWidth - popRect.width - margin, left));

    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
    if (placeAbove) pop.classList.add("is-above");
  }
}

function initHelpPopovers() {
  if (document.body.dataset.helpBound) return;
  document.body.dataset.helpBound = "true";

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".help-tip-btn");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      openHelpPopover(btn);
      return;
    }
    if (activeHelpBtn && !e.target.closest("#helpPopover")) {
      closeHelpPopover();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeHelpBtn) {
      closeHelpPopover();
    }
  });

  window.addEventListener("scroll", () => {
    if (activeHelpBtn && window.innerWidth > 640) closeHelpPopover();
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (activeHelpBtn) closeHelpPopover();
  });
}

function resolveGpaBand() {
  if (state.gpaMode === "manual" || state.gpaBand === "manual") return "manual";
  if (state.gpaBand && ["3.0", "2.0", "1.5", "0.8"].includes(state.gpaBand)) return state.gpaBand;
  if (state.gpa != null && !isNaN(state.gpa)) {
    const g = Number(state.gpa);
    // Check if it matches one of the standard band values or infer band
    if (g >= 3.0) return "3.0";
    if (g >= 2.0) return "2.0";
    if (g > 1.0) return "1.5";
    return "0.8";
  }
  return "";
}

function formatGpaSummary() {
  if (state.isNewcomer) return `— (${esc(t("newcomerGpaTag"))})`;
  if (state.gpaMode === "manual" && state.gpa != null) {
    return esc(Number(state.gpa).toFixed(2));
  }
  const band = resolveGpaBand();
  if (band === "3.0") return esc(t("gpaSummary3Plus"));
  if (band === "2.0") return esc(t("gpaSummary2To3"));
  if (band === "1.5") return esc(t("gpaSummary1To2"));
  if (band === "0.8") return esc(t("gpaSummaryBelow1"));
  return state.gpa != null ? esc(Number(state.gpa).toFixed(2)) : "—";
}

function usedHours() {
  const coursesHours = state.selected.reduce((sum, idx) => {
    const c = COURSES[idx];
    return sum + (c && typeof c.creditHours === "number" ? c.creditHours : 3);
  }, 0);
  return coursesHours + (state.project ? APP_CONFIG.project.creditHours : 0);
}

function canAddCourse(courseIdx) {
  if (state.selected.includes(courseIdx)) return true;
  const course = COURSES[courseIdx];
  const cost = course && typeof course.creditHours === "number" ? course.creditHours : 3;
  return usedHours() + cost <= state.hoursLimit;
}

function formatCreditBadge(c) {
  const h = c && typeof c.creditHours === "number" ? c.creditHours : 3;
  if (h === 0) return t("creditHoursZero");
  if (h === 1) return t("creditHoursSingle");
  if (h === 2) return t("creditHoursTwo");
  return t("creditHoursCount").replace("{n}", h);
}

function getCourseAttendance(courseIdx) {
  const att = (state.attendance && state.attendance[courseIdx]) || {};
  return {
    lecture: att.lecture || "mandatory",
    section: att.section || "mandatory",
  };
}

function countCustomAttendance() {
  if (!state.attendance) return 0;
  let count = 0;
  state.selected.forEach((idx) => {
    const att = state.attendance[idx];
    if (att) {
      if (att.lecture && att.lecture !== "mandatory") count++;
      const course = COURSES[idx];
      const sched = typeof Timetable !== "undefined" && Timetable.getCourseSchedule
        ? Timetable.getCourseSchedule(course, idx, state)
        : (course || { sections: [] });
      if (sched.sections && sched.sections.length > 0 && att.section && att.section !== "mandatory") {
        count++;
      }
    }
  });
  return count;
}

function countPinnedSections() {
  if (!state.pinnedSections) return 0;
  let count = 0;
  state.selected.forEach((idx) => {
    if (state.pinnedSections[idx] && state.picks && state.picks[idx] != null) {
      count++;
    }
  });
  return count;
}

function formatCourseShortList(courses) {
  if (!courses || !courses.length) return "";
  const sep = state.lang === "ar" ? "، " : ", ";
  return courses.map((c) => {
    const name = tr(c.name);
    return c.code ? `${c.code} (${name})` : name;
  }).join(sep);
}

function pruneOrphanedCourseState() {
  const selSet = new Set(state.selected);
  [state.picks, state.lecturePicks, state.attendance, state.pinnedSections].forEach((mapObj) => {
    if (!mapObj) return;
    Object.keys(mapObj).forEach((k) => {
      if (!selSet.has(Number(k))) {
        delete mapObj[k];
      }
    });
  });
  if (state.pinnedSections) {
    Object.keys(state.pinnedSections).forEach((k) => {
      if (!state.picks || state.picks[k] == null) {
        delete state.pinnedSections[k];
      }
    });
  }
}

/* Cleans up any active schedule overlaps when disabling Conflict Waiver Mode */
function sanitizeConflictsWhenLocking() {
  let cleaned = false;
  let model = Timetable.build(state);
  if (!model.conflicts.length) return false;

  // Step 1: Unpick any section involved in a conflict
  model.conflicts.forEach((c) => {
    c.items.forEach((p) => {
      if (p.kind === "section" && state.picks[p.courseIdx] != null) {
        delete state.picks[p.courseIdx];
        if (state.pinnedSections) delete state.pinnedSections[p.courseIdx];
        cleaned = true;
      }
    });
  });

  // Step 2: Re-check for lecture-lecture conflicts and remove the later-added clashing course
  model = Timetable.build(state);
  while (model.conflicts.length > 0) {
    const firstConflict = model.conflicts[0];
    const lastItem = firstConflict.items[firstConflict.items.length - 1];
    if (!lastItem) break;
    state.selected = state.selected.filter((idx) => idx !== lastItem.courseIdx);
    cleaned = true;
    pruneOrphanedCourseState();
    model = Timetable.build(state);
  }

  return cleaned;
}

function toggleConflictMode(forceValue = null) {
  const nextVal = forceValue != null ? Boolean(forceValue) : !state.allowConflicts;
  state.allowConflicts = nextVal;
  let cleaned = false;
  if (!nextVal) {
    cleaned = sanitizeConflictsWhenLocking();
  }
  persist();
  renderAll();
  if (nextVal) {
    showToast(t("toastConflictModeEnabled"));
  } else {
    showToast(cleaned ? t("toastConflictModeDisabledCleaned") : t("toastConflictModeDisabled"));
  }
}

function togglePinSection(courseIdx) {
  const idx = Number(courseIdx);
  const course = COURSES[idx];
  if (!course) return;
  if (!state.picks || state.picks[idx] == null) {
    showToast(t("pinNeedSectionToast"));
    return;
  }
  state.pinnedSections = state.pinnedSections || {};
  const isNowPinned = !state.pinnedSections[idx];
  if (isNowPinned) {
    state.pinnedSections[idx] = true;
  } else {
    delete state.pinnedSections[idx];
  }
  persist();
  renderAll();
  const cName = tr(course.name);
  showToast((isNowPinned ? t("pinSuccessToast") : t("unpinSuccessToast")).replace("{course}", cName));
}

function computeLimit() {
  if (state.isNewcomer) {
    state.passedHours = 0;
    state.gpa = null;
    state.level = 1;
    state.dept = "GEN";
    state.hoursLimit = 16;
    state.extraHours = false;
    state.project = false;
    state.maxCourses = 6;
    state.catalogLevelFilter = "1";
    return;
  }

  const hours = state.passedHours != null ? state.passedHours : 0;
  const gpa = state.gpa != null ? state.gpa : 0;
  state.level = ACADEMIC_BYLAWS.calcLevel(hours);

  // If student hasn't reached specialization (< 45h), department is GEN
  if (!ACADEMIC_BYLAWS.isSpecialized(hours)) {
    state.dept = "GEN";
  }

  let limit = ACADEMIC_BYLAWS.calcBaseHours(gpa, state.isNewcomer);
  const eligibleOverload = ACADEMIC_BYLAWS.canOverload(hours, gpa);
  if (state.extraHours && eligibleOverload) {
    limit = APP_CONFIG.overload.maxHours; // 21h
  } else if (!eligibleOverload) {
    state.extraHours = false;
  }

  // Project eligibility check
  if (!ACADEMIC_BYLAWS.canTakeProject(hours)) {
    state.project = false;
  }

  state.hoursLimit = limit;
  const usable = limit - (state.project ? APP_CONFIG.project.creditHours : 0);
  state.maxCourses = Math.max(0, Math.floor(usable / APP_CONFIG.creditHoursPerCourse));
}

function groupCourses() {
  const isSpec = state.passedHours != null ? ACADEMIC_BYLAWS.isSpecialized(state.passedHours) : true;
  const order = ["GEN", ...APP_CONFIG.departments];
  const groups = new Map(order.map((d) => [d, []]));

  COURSES.forEach((course, idx) => {
    // If student is a Newcomer (First Term): ONLY show Level 1 foundational courses (no retakes, no level 2/3/4)
    if (state.isNewcomer) {
      if (course.level !== 1 || course.isRetake) {
        return;
      }
    }

    // If student is not specialized (< 45h), lock out Level 3 and Level 4 courses
    if (!isSpec && (course.level && course.level >= 3)) {
      return;
    }

    // Filter pill check (Level 1, 2, 3, 4, Retake, All)
    if (state.catalogLevelFilter && state.catalogLevelFilter !== "all") {
      if (state.catalogLevelFilter === "retake") {
        if (!course.isRetake) return;
      } else if (course.level !== Number(state.catalogLevelFilter)) {
        return;
      }
    }

    const targetDept = groups.has(course.dept) ? course.dept : "GEN";
    groups.get(targetDept).push({ course, idx });
  });

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
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m9 20 3-6-3-3 4-2 3 4 3-1"/><path d="m6 17 3-3-1-4"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sunBeach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-18 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 3v1"/></svg>',
  sunrise: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="m4.93 10.93 1.41 1.41"/><path d="M20 18h2"/><path d="M2 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>',
  coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>',
  alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  hourglass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg>',
  fileText: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
  externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  userGraduate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  userCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z"/></svg>',
  shieldAlert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

/* -------------------------------------------------------------- Chrome */
function renderChrome() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.title = tr(APP_CONFIG.toolName) + " | " + APP_CONFIG.toolName.en;

  const sched = APP_CONFIG.officialSchedule;
  const schedBtnLabel = t("officialScheduleBtn").replace("{v}", sched.version);
  const schedMobileLabel = t("officialScheduleMobileBtn").replace("{v}", sched.version);
  const isSpotlight = tourState.isOpen ? "is-spotlight" : "";

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
        <button class="schedule-header-btn ${isSpotlight}" id="openScheduleModalBtn" type="button" title="${esc(schedBtnLabel)}">
          ${ICONS.fileText}
          <span class="sched-btn-text-full">${esc(schedBtnLabel)}</span>
          <span class="sched-btn-text-mobile">${esc(schedMobileLabel)}</span>
          <span class="schedule-version-badge">${esc(sched.version)}</span>
        </button>
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

  const schedModalBtn = $("#openScheduleModalBtn");
  if (schedModalBtn) {
    schedModalBtn.addEventListener("click", () => {
      schedModalState.isOpen = true;
      renderAll();
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
  const isNewcomer = state.isNewcomer ?? false;
  const hoursVal = state.passedHours != null ? state.passedHours : "";
  const selectedBand = resolveGpaBand();
  const gpaVal = state.gpa != null ? state.gpa : "";
  const initialHours = state.passedHours != null ? state.passedHours : 96;
  const initialGpa = state.gpa != null ? state.gpa : (selectedBand && selectedBand !== "manual" ? Number(selectedBand) : 2.5);

  const currentLevel = isNewcomer ? 1 : ACADEMIC_BYLAWS.calcLevel(initialHours);
  const isSpec = isNewcomer ? false : ACADEMIC_BYLAWS.isSpecialized(initialHours);
  const canProj = isNewcomer ? false : ACADEMIC_BYLAWS.canTakeProject(initialHours);
  const canOver = isNewcomer ? false : ACADEMIC_BYLAWS.canOverload(initialHours, initialGpa);
  const baseHours = ACADEMIC_BYLAWS.calcBaseHours(initialGpa, isNewcomer);

  const deptOptions = APP_CONFIG.departments.map((d) =>
    `<option value="${d}" ${state.dept === d ? "selected" : ""}>${esc(d)} — ${esc(tr(DEPT_NAMES[d]))}</option>`
  ).join("");

  const checked = (v) => (v === true ? "checked" : "");
  const projectChecked = (v) => (state.project === v ? "checked" : "");

  return `
  <section class="card setup-card">
    <div class="section-title-row setup-title-row">
      <h1 class="card-title">${esc(t("setupTitle"))}</h1>
      ${helpTip(t("setupSubtitle"))}
    </div>

    <form id="setupForm" novalidate>
      <div class="student-type-selector" role="radiogroup" aria-label="Student Category">
        <label class="student-type-card ${isNewcomer ? "is-selected" : ""}">
          <input type="radio" name="studentType" value="newcomer" ${isNewcomer ? "checked" : ""}>
          <div class="student-type-content">
            <div class="student-type-title">
              <span class="student-type-icon">${ICONS.userGraduate}</span>
              <strong>${esc(t("studentTypeNewcomer"))}</strong>
              ${helpTip(t("studentTypeNewcomerDesc"))}
            </div>
          </div>
        </label>

        <label class="student-type-card ${!isNewcomer ? "is-selected" : ""}">
          <input type="radio" name="studentType" value="returning" ${!isNewcomer ? "checked" : ""}>
          <div class="student-type-content">
            <div class="student-type-title">
              <span class="student-type-icon">${ICONS.book}</span>
              <strong>${esc(t("studentTypeReturning"))}</strong>
              ${helpTip(t("studentTypeReturningDesc"))}
            </div>
          </div>
        </label>
      </div>

      <div id="returningStudentInputs" ${isNewcomer ? 'style="display:none;"' : ""}>
        <div class="form-grid-2">
          <div class="field">
            <label class="field-label" for="passedHours">
              <span>${esc(t("passedHoursLabel"))}</span>
              ${helpTip(t("passedHoursHint"))}
            </label>
            <input type="number" id="passedHours" min="0" max="180" step="1"
                   placeholder="${esc(t("passedHoursPh"))}" value="${hoursVal}">
          </div>

          <div class="field">
            <label class="field-label" for="gpaSelect">
              <span>${esc(t("gpaInputLabel"))}</span>
              ${helpTip(t("gpaHint"))}
            </label>
            <select id="gpaSelect">
              <option value="" disabled ${selectedBand === "" ? "selected" : ""}>${esc(t("gpaSelectPlaceholder"))}</option>
              <option value="3.0" ${selectedBand === "3.0" ? "selected" : ""}>${esc(t("gpaBand3Plus"))}</option>
              <option value="2.0" ${selectedBand === "2.0" ? "selected" : ""}>${esc(t("gpaBand2To3"))}</option>
              <option value="1.5" ${selectedBand === "1.5" ? "selected" : ""}>${esc(t("gpaBand1To2"))}</option>
              <option value="0.8" ${selectedBand === "0.8" ? "selected" : ""}>${esc(t("gpaBandBelow1"))}</option>
              <option value="manual" ${selectedBand === "manual" ? "selected" : ""}>${esc(t("gpaBandManual"))}</option>
            </select>
            <div class="gpa-manual-wrap" id="gpaManualWrap" ${selectedBand === "manual" ? "" : 'style="display:none;"'}>
              <input type="number" id="gpaInput" min="0" max="4.00" step="0.01"
                     placeholder="${esc(t("gpaInputPh"))}" value="${selectedBand === "manual" ? gpaVal : ""}">
            </div>
          </div>
        </div>
      </div>

      <div class="live-calc-box" id="liveCalcBox">
        <div class="live-calc-row">
          <span class="live-calc-label">${esc(t("detectedLevel"))}</span>
          <span class="live-calc-value">
            <span class="badge-level-tag" id="calcLevelBadge">${esc(isNewcomer ? t("level1") : t("level" + currentLevel))}</span>
          </span>
        </div>
        <div class="live-calc-row">
          <span class="live-calc-label">${esc(state.lang === "ar" ? "حالة التخصص:" : "Specialization Stage:")}</span>
          <span class="live-calc-value">
            <span class="${isSpec ? "badge-spec-active" : "badge-spec-general"}" id="calcSpecBadge">
              ${esc(isSpec ? t("statusSpecialized") : t("statusGeneral"))}
            </span>
            ${helpTip(isSpec ? t("specializedNotice") : t("notSpecializedNotice"), "calcSpecTip")}
          </span>
        </div>
        <div class="live-calc-row">
          <span class="live-calc-label">${esc(t("gpaCalculatedLimit"))}</span>
          <span class="live-calc-value" id="calcLimitDisplay">
            ${esc(t("gpaHoursDesc").replace("{h}", isNewcomer ? 16 : baseHours))}
          </span>
        </div>
      </div>

      <div class="field" id="deptField" ${isSpec ? "" : 'style="display:none;"'}>
        <label class="field-label" for="dept">
          <span>${esc(t("deptLabel"))}</span>
          ${helpTip(t("specializedNotice"))}
        </label>
        <select id="dept" ${isSpec ? "required" : ""}>
          <option value="" disabled ${state.dept && state.dept !== "GEN" ? "" : "selected"}>${esc(t("deptPlaceholder"))}</option>
          ${deptOptions}
        </select>
      </div>

      <div class="field" id="projectField" ${canProj ? "" : 'style="display:none;"'}>
        <span class="field-label">
          <span>${esc(t("projectLabel"))}</span>
          ${helpTip(t("projectHint") + " — " + t("projectEligibilityNote"))}
        </span>
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
      </div>

      <div class="overload-box" id="extraHoursBox" ${canOver ? "" : 'style="display:none;"'}>
        <label class="choice choice-block">
          <input type="checkbox" id="extraHours" ${checked(state.extraHours)}>
          <strong>${esc(t("extraHoursLabel"))}</strong>
          ${helpTip(currentLevel === 4 && initialGpa >= 2.0 ? t("overloadReasonLevel4") : t("overloadReasonGpa3"), "overloadReasonTip")}
        </label>
      </div>

      <div class="conflict-mode-setup-box ${state.allowConflicts ? "is-active" : ""}" id="conflictModeBox">
        <label class="choice choice-block">
          <input type="checkbox" id="allowConflictsCheck" ${checked(state.allowConflicts)}>
          <span class="conflict-mode-icon">${ICONS.shieldAlert}</span>
          <strong>${esc(t("conflictModeLabel"))}</strong>
          ${helpTip(t("conflictModeSub"))}
        </label>
        <div class="conflict-mode-warning" id="conflictWarningBanner" ${state.allowConflicts ? "" : 'style="display:none;"'}>
          <div class="conflict-warning-head">
            ${ICONS.alert}
            <strong>${esc(t("conflictModeWarningTitle"))}</strong>
          </div>
          <p class="conflict-warning-text">${esc(t("conflictModeWarningBody"))}</p>
        </div>
      </div>

      <button class="btn btn-primary btn-block" type="submit">${esc(t("startBtn"))}</button>
    </form>
  </section>`;
}

function bindSetup() {
  const form = $("#setupForm");
  if (!form) return;

  const hoursInput = $("#passedHours");
  const gpaSelect = $("#gpaSelect");
  const gpaManualWrap = $("#gpaManualWrap");
  const gpaInput = $("#gpaInput");
  const deptField = $("#deptField");
  const deptSelect = $("#dept");
  const projectField = $("#projectField");
  const extraHoursBox = $("#extraHoursBox");
  const extraHoursCheck = $("#extraHours");
  const overloadReasonTip = $("#overloadReasonTip");
  const returningInputs = $("#returningStudentInputs");
  const conflictModeBox = $("#conflictModeBox");
  const allowConflictsCheck = $("#allowConflictsCheck");
  const conflictWarningBanner = $("#conflictWarningBanner");

  if (allowConflictsCheck) {
    allowConflictsCheck.addEventListener("change", () => {
      const isOn = allowConflictsCheck.checked;
      if (conflictModeBox) conflictModeBox.classList.toggle("is-active", isOn);
      if (conflictWarningBanner) conflictWarningBanner.style.display = isOn ? "" : "none";
    });
  }

  const calcLevelBadge = $("#calcLevelBadge");
  const calcSpecBadge = $("#calcSpecBadge");
  const calcSpecTip = $("#calcSpecTip");
  const calcLimitDisplay = $("#calcLimitDisplay");

  const getEffectiveGpa = () => {
    const band = gpaSelect ? gpaSelect.value : "";
    if (band === "manual") {
      const raw = gpaInput?.value ? gpaInput.value.trim() : "";
      return raw !== "" ? Math.max(0, Math.min(4.0, Number(raw))) : 0;
    }
    if (band !== "") {
      return Number(band);
    }
    return 0;
  };

  const updateCalculations = () => {
    const isNewcomer = form.querySelector('input[name="studentType"]:checked')?.value === "newcomer";

    if (isNewcomer) {
      if (calcLevelBadge) calcLevelBadge.textContent = t("level1");
      if (calcSpecBadge) {
        calcSpecBadge.className = "badge-spec-general";
        calcSpecBadge.textContent = t("statusGeneral");
      }
      if (calcSpecTip) calcSpecTip.setAttribute("data-tip", t("notSpecializedNotice"));
      if (calcLimitDisplay) {
        calcLimitDisplay.textContent = t("gpaHoursDesc").replace("{h}", 16);
      }
      if (deptField) deptField.style.display = "none";
      if (projectField) projectField.style.display = "none";
      if (extraHoursBox) extraHoursBox.style.display = "none";
      return;
    }

    const rawHours = hoursInput?.value ? hoursInput.value.trim() : "";
    const hours = rawHours !== "" ? Math.max(0, Number(rawHours)) : 0;
    const gpa = getEffectiveGpa();

    const level = ACADEMIC_BYLAWS.calcLevel(hours);
    const isSpec = ACADEMIC_BYLAWS.isSpecialized(hours);
    const canProj = ACADEMIC_BYLAWS.canTakeProject(hours);
    const canOver = ACADEMIC_BYLAWS.canOverload(hours, gpa);
    const baseHours = ACADEMIC_BYLAWS.calcBaseHours(gpa, false);

    // Update Live Badges
    if (calcLevelBadge) calcLevelBadge.textContent = t("level" + level);
    if (calcSpecBadge) {
      calcSpecBadge.className = isSpec ? "badge-spec-active" : "badge-spec-general";
      calcSpecBadge.textContent = isSpec ? t("statusSpecialized") : t("statusGeneral");
    }
    if (calcSpecTip) {
      calcSpecTip.setAttribute("data-tip", isSpec ? t("specializedNotice") : t("notSpecializedNotice"));
    }
    if (calcLimitDisplay) {
      calcLimitDisplay.textContent = t("gpaHoursDesc").replace("{h}", baseHours);
    }

    // Department field visibility
    if (deptField && deptSelect) {
      if (isSpec) {
        deptField.style.display = "";
        deptSelect.required = true;
      } else {
        deptField.style.display = "none";
        deptSelect.required = false;
      }
    }

    // Graduation project visibility (>= 85h)
    if (projectField) {
      projectField.style.display = canProj ? "" : "none";
      if (!canProj) {
        const projYes = form.querySelector('input[name="project"][value="yes"]');
        if (projYes && projYes.checked) projYes.checked = false;
      }
    }

    // Overload 21h visibility
    if (extraHoursBox && extraHoursCheck) {
      extraHoursBox.style.display = canOver ? "" : "none";
      if (!canOver) {
        extraHoursCheck.checked = false;
      } else if (overloadReasonTip) {
        overloadReasonTip.setAttribute(
          "data-tip",
          (level === 4 && gpa >= 2.0) ? t("overloadReasonLevel4") : t("overloadReasonGpa3")
        );
      }
    }
  };

  const syncStudentTypeUI = () => {
    const isNewcomer = form.querySelector('input[name="studentType"]:checked')?.value === "newcomer";
    if (returningInputs) returningInputs.style.display = isNewcomer ? "none" : "";

    form.querySelectorAll(".student-type-card").forEach((card) => {
      const radio = card.querySelector('input[name="studentType"]');
      if (radio && radio.checked) card.classList.add("is-selected");
      else card.classList.remove("is-selected");
    });

    updateCalculations();
  };

  form.querySelectorAll('input[name="studentType"]').forEach((r) => {
    r.addEventListener("change", syncStudentTypeUI);
  });

  if (hoursInput) hoursInput.addEventListener("input", updateCalculations);

  if (gpaSelect) {
    gpaSelect.addEventListener("change", () => {
      const isManual = gpaSelect.value === "manual";
      if (gpaManualWrap) {
        gpaManualWrap.style.display = isManual ? "" : "none";
      }
      if (isManual && gpaInput) {
        gpaInput.focus();
      }
      updateCalculations();
    });
  }

  if (gpaInput) gpaInput.addEventListener("input", updateCalculations);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const isNewcomer = form.querySelector('input[name="studentType"]:checked')?.value === "newcomer";
    state.isNewcomer = isNewcomer;
    state.allowConflicts = Boolean(allowConflictsCheck?.checked);

    if (isNewcomer) {
      const prevCount = state.selected.length;
      state.passedHours = 0;
      state.gpa = null;
      state.gpaMode = "band";
      state.gpaBand = null;
      state.level = 1;
      state.dept = "GEN";
      state.group = state.group || "A";
      state.project = false;
      state.extraHours = false;
      state.hoursLimit = 16;
      state.maxCourses = 6;
      state.catalogLevelFilter = "1";
      // Prune any selected courses that are not Level 1 foundational courses
      state.selected = state.selected.filter((idx) => {
        const c = COURSES[idx];
        return c && c.level === 1 && !c.isRetake;
      });
      while (usedHours() > state.hoursLimit && state.selected.length > 0) {
        state.selected.pop();
      }
      if (!state.allowConflicts) {
        sanitizeConflictsWhenLocking();
      }
      pruneOrphanedCourseState();
      state.step = "catalog";
      computeLimit();
      persist();
      renderAll();
      if (state.selected.length < prevCount) {
        showToast(t("setupPrunedToast"));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const rawHours = hoursInput ? hoursInput.value.trim() : "";
    const selectedBand = gpaSelect ? gpaSelect.value : "";
    const isManualGpa = selectedBand === "manual";
    const rawManualGpa = gpaInput ? gpaInput.value.trim() : "";

    if (rawHours === "" || isNaN(Number(rawHours)) || Number(rawHours) < 0 ||
        selectedBand === "" ||
        (isManualGpa && (rawManualGpa === "" || isNaN(Number(rawManualGpa)) || Number(rawManualGpa) < 0 || Number(rawManualGpa) > 4.0))) {
      form.classList.add("shake");
      setTimeout(() => form.classList.remove("shake"), 400);
      return;
    }

    const hours = Math.round(Number(rawHours));
    const gpa = isManualGpa ? Number(Number(rawManualGpa).toFixed(2)) : Number(selectedBand);
    const level = ACADEMIC_BYLAWS.calcLevel(hours);
    const isSpec = ACADEMIC_BYLAWS.isSpecialized(hours);
    const canProj = ACADEMIC_BYLAWS.canTakeProject(hours);

    state.passedHours = hours;
    state.gpa = gpa;
    state.gpaMode = isManualGpa ? "manual" : "band";
    state.gpaBand = selectedBand;
    state.level = level;

    if (isSpec) {
      state.dept = deptSelect.value || null;
      if (!state.dept) {
        form.classList.add("shake");
        setTimeout(() => form.classList.remove("shake"), 400);
        return;
      }
    } else {
      state.dept = "GEN";
    }

    if (level <= 2) {
      state.group = state.group || "A";
    }

    if (canProj) {
      const proj = form.querySelector('input[name="project"]:checked');
      state.project = proj ? proj.value === "yes" : false;
    } else {
      state.project = false;
    }

    const eligibleOverload = ACADEMIC_BYLAWS.canOverload(hours, gpa);
    state.extraHours = eligibleOverload && extraHoursCheck.checked;

    computeLimit();

    // Sanitize selected courses against new specialization rules and credit limit
    const prevCount = state.selected.length;
    state.selected = state.selected.filter((idx) => {
      const c = COURSES[idx];
      if (!c) return false;
      if (!isSpec && c.level >= 3) return false;
      return true;
    });
    while (usedHours() > state.hoursLimit && state.selected.length > 0) {
      state.selected.pop();
    }
    if (!state.allowConflicts) {
      sanitizeConflictsWhenLocking();
    }
    pruneOrphanedCourseState();

    state.step = "catalog";

    if (typeof Analytics !== "undefined") {
      Analytics.trackScheduleStarted(state);
    }

    persist();
    renderAll();
    if (state.selected.length < prevCount) {
      showToast(t("setupPrunedToast"));
    }
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
  const isMandatory = course.mandatoryFor && course.mandatoryFor.includes(state.dept);
  const pick = state.picks[idx] ?? null;
  const canAdd = canAddCourse(idx);
  const clashInfo = typeof Timetable !== "undefined" && Timetable.getCourseConflictWithState
    ? Timetable.getCourseConflictWithState(idx, state)
    : { hasConflict: false, conflictingCourses: [] };

  const creditDisabled = !isSelected && !canAdd;
  const conflictLocked = !isSelected && clashInfo.hasConflict && !state.allowConflicts;
  const disabled = creditDisabled;

  const cost = course && typeof course.creditHours === "number" ? course.creditHours : 3;
  const rem = Math.max(0, state.hoursLimit - usedHours());
  const clashNames = formatCourseShortList(clashInfo.conflictingCourses);

  const disabledTooltip = creditDisabled
    ? t("limitReachedRemaining").replace("{rem}", rem).replace("{cost}", cost).replace("{limit}", state.hoursLimit)
    : conflictLocked
      ? t("toastConflictLockedCourse").replace("{courses}", clashNames)
      : "";

  const badges = [];
  if (isMandatory) {
    badges.push(`<span class="badge badge-mandatory">${ICONS.check}${esc(t("mandatoryBadge"))}</span>`);
  } else {
    badges.push(`<span class="badge badge-optional">${esc(t("optionalBadge"))}</span>`);
  }
  if (course.mandatoryFor && course.mandatoryFor.length && !isMandatory) {
    badges.push(`<span class="badge badge-forothers">${esc(t("mandatoryForPrefix"))} ${esc(course.mandatoryFor.join(", "))}</span>`);
  }
  badges.push(`<span class="badge badge-level">${esc(t("levelPrefix"))} ${course.level}</span>`);
  if (course.isRetake) {
    badges.push(`<span class="badge badge-retake">${esc(t("retakeBadge"))}</span>`);
  }
  badges.push(`<span class="badge badge-credit">${esc(formatCreditBadge(course))}</span>`);

  if (clashInfo.hasConflict) {
    if (!state.allowConflicts && !isSelected) {
      badges.push(`<span class="badge badge-conflict-lock">${ICONS.alert}<span>${esc(t("courseClashesWith").replace("{courses}", clashNames))}</span></span>`);
    } else {
      badges.push(`<span class="badge badge-conflict-waived">${ICONS.alert}<span>${esc(t("courseClashAllowedWith").replace("{courses}", clashNames))}</span></span>`);
    }
  }

  const meta = [
    course.code ? `<span class="course-code">${esc(course.code)}</span>` : "",
    ...badges,
  ].join("");

  const sched = typeof Timetable !== "undefined" && Timetable.getCourseSchedule
    ? Timetable.getCourseSchedule(course, idx, state)
    : { lectures: course.lectures || [], sections: course.sections || [] };

  const counts = `
    <span class="course-count">${sched.lectures.length} ${esc(t("lecturesCount"))}</span>
    ${sched.sections.length ? `<span class="course-count">${sched.sections.length} ${esc(t("sectionsCount"))}</span>` : ""}
    ${isSelected && pick != null && sched.sections[pick] ? `<span class="course-count course-count--picked">${ICONS.check}${esc(Timetable.sectionLabel(sched.sections[pick]))}</span>` : ""}`;

  return `
  <div class="course-card ${isSelected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""} ${conflictLocked ? "is-conflict-locked" : ""}">
    <label class="course-check-row" ${disabledTooltip ? `title="${esc(disabledTooltip)}"` : ""}>
      <input type="checkbox" class="course-check" data-idx="${idx}" ${isSelected ? "checked" : ""} ${disabled ? "disabled" : ""}>
      <div class="course-body">
        <div class="course-top">
          <span class="course-name">${esc(tr(course.name))}</span>
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

  const isSenior = (state.level || 1) >= 3;
  const currentGroup = state.group || "A";

  const cohortCard = !isSenior ? `
    <div class="cohort-selector-card">
      <div class="cohort-selector-header">
        <div class="cohort-title-wrap">
          <span class="cohort-icon">${ICONS.users}</span>
          <div class="cohort-title-line">
            <h4 class="cohort-title">${esc(t("cohortSelectTitle"))}</h4>
            ${helpTip(t("cohortSelectDesc") + " " + t("cohortSwitchHint"))}
            <span class="cohort-status-tag">${currentGroup === 'B' ? esc(t("showingGroupB")) : esc(t("showingGroupA"))}</span>
          </div>
        </div>
        <div class="cohort-toggle-pills" role="radiogroup" aria-label="${esc(t("cohortGroupLabel"))}">
          <button type="button" class="cohort-pill ${currentGroup === 'A' ? 'is-active' : ''}" data-group="A">
            <span class="cohort-pill-bullet">A</span>
            <span>${esc(t("groupA"))}</span>
          </button>
          <button type="button" class="cohort-pill ${currentGroup === 'B' ? 'is-active' : ''}" data-group="B">
            <span class="cohort-pill-bullet">B</span>
            <span>${esc(t("groupB"))}</span>
          </button>
        </div>
      </div>
    </div>` : "";

  const hasGroupCourses = state.selected.some((idx) => COURSES[idx]?.hasGroups);
  const seniorBanner = (isSenior && hasGroupCourses) ? `
    <div class="cohort-senior-banner">
      <div class="senior-banner-head">
        <span class="senior-banner-icon">${ICONS.zap}</span>
        <div class="section-title-row">
          <h4 class="senior-banner-title">${esc(t("seniorFlexTitle"))}</h4>
          ${helpTip(t("seniorFlexDesc"))}
        </div>
      </div>
    </div>` : "";

  const renderSectionOption = (courseIdx, secObj, secIdx, currentPick) => {
    const secClash = typeof Timetable !== "undefined" && Timetable.getSectionConflictWithState
      ? Timetable.getSectionConflictWithState(courseIdx, secIdx, state)
      : { hasConflict: false, conflictingCourses: [] };
    const isCurrent = currentPick === secIdx;
    const isLocked = secClash.hasConflict && !state.allowConflicts && !isCurrent;
    const clashSuffix = secClash.hasConflict
      ? ` — ${t("sectionClashesWith").replace("{courses}", formatCourseShortList(secClash.conflictingCourses))}`
      : "";
    return `<option value="${secIdx}" ${isCurrent ? "selected" : ""} ${isLocked ? "disabled" : ""}>${esc(Timetable.sectionLabel(secObj) + clashSuffix)}</option>`;
  };

  const items = state.selected.map((idx) => {
    const course = COURSES[idx];
    const sched = Timetable.getCourseSchedule(course, idx, state);
    const pick = state.picks[idx] ?? null;
    const isPinned = Boolean(state.pinnedSections && state.pinnedSections[idx] && pick != null);
    const clash = conflicted.has(idx);
    const mand = course.mandatoryFor && course.mandatoryFor.includes(state.dept);
    const hasSections = Boolean(sched.sections && sched.sections.length > 0);

    let sectionSelectHtml = "";
    if (hasSections) {
      if (sched.isSeniorFlex) {
        const secA = sched.sections.filter((s) => s.group === "A");
        const secB = sched.sections.filter((s) => s.group === "B");
        sectionSelectHtml = `
          <select class="section-select ${isPinned ? "is-pinned-select" : ""}" data-idx="${idx}">
            <option value="" ${pick == null ? "selected" : ""} disabled>${esc(t("pickSectionPh"))}</option>
            ${secA.length ? `
              <optgroup label="${esc(t("groupA"))}">
                ${secA.map((s) => renderSectionOption(idx, s, s.unifiedIdx, pick)).join("")}
              </optgroup>` : ""}
            ${secB.length ? `
              <optgroup label="${esc(t("groupB"))}">
                ${secB.map((s) => renderSectionOption(idx, s, s.unifiedIdx, pick)).join("")}
              </optgroup>` : ""}
          </select>`;
      } else {
        sectionSelectHtml = `
          <select class="section-select ${isPinned ? "is-pinned-select" : ""}" data-idx="${idx}">
            <option value="" ${pick == null ? "selected" : ""} disabled>${esc(t("pickSectionPh"))}</option>
            ${sched.sections.map((s, i) => renderSectionOption(idx, s, i, pick)).join("")}
          </select>`;
      }
    } else {
      sectionSelectHtml = `<span class="badge badge-optional" style="margin-inline-end: .5rem;">${esc(t("lectureOnlyWord"))}</span>`;
    }

    let pinButtonHtml = "";
    if (hasSections) {
      pinButtonHtml = `
        <button class="btn-pin-sec ${isPinned ? "is-pinned" : ""} ${pick == null ? "is-unpicked" : ""}"
                data-pin-course="${idx}" type="button"
                title="${esc(isPinned ? t("unpinSectionBtn") : t("pinSectionBtn"))}"
                aria-label="${esc(isPinned ? t("unpinSectionBtn") : t("pinSectionBtn"))}"
                aria-pressed="${isPinned ? "true" : "false"}">
          ${ICONS.pin}
          <span class="btn-pin-label">${esc(isPinned ? t("pinnedBadge") : t("pinSectionBtn"))}</span>
        </button>`;
    }

    let lectureGroupPicker = "";
    if (sched.hasGroups && sched.isSeniorFlex) {
      const clashA = Timetable.getLectureGroupConflictWithState(idx, "A", state);
      const clashB = Timetable.getLectureGroupConflictWithState(idx, "B", state);
      const titleA = clashA.hasConflict ? t("sectionClashesWith").replace("{courses}", formatCourseShortList(clashA.conflictingCourses)) : t("lectureGroupA");
      const titleB = clashB.hasConflict ? t("sectionClashesWith").replace("{courses}", formatCourseShortList(clashB.conflictingCourses)) : t("lectureGroupB");

      lectureGroupPicker = `
        <div class="lec-group-switch" title="${esc(t("lectureGroupLabel"))}">
          <span class="lec-group-label">${esc(t("lectureGroupLabel"))}:</span>
          <button type="button" class="btn-lec-grp ${sched.activeGroup === 'A' ? 'is-active' : ''} ${clashA.hasConflict && sched.activeGroup !== 'A' ? 'is-clashing-grp' : ''}"
                  data-idx="${idx}" data-lecgroup="A" title="${esc(titleA)}">
            ${esc(t("groupShortA"))}${clashA.hasConflict && sched.activeGroup !== 'A' ? " ⚠" : ""}
          </button>
          <button type="button" class="btn-lec-grp ${sched.activeGroup === 'B' ? 'is-active' : ''} ${clashB.hasConflict && sched.activeGroup !== 'B' ? 'is-clashing-grp' : ''}"
                  data-idx="${idx}" data-lecgroup="B" title="${esc(titleB)}">
            ${esc(t("groupShortB"))}${clashB.hasConflict && sched.activeGroup !== 'B' ? " ⚠" : ""}
          </button>
        </div>`;
    }

    return `
    <div class="reg-item ${clash ? "reg-item--clash" : ""} ${isPinned ? "reg-item--pinned" : ""}">
      <div class="reg-info">
        ${clash ? `<span class="reg-clashicon" title="${esc(state.allowConflicts ? t("ttConflictWaivedBadge") : t("conflictSection"))}">${ICONS.alert}</span>` : ""}
        <span class="reg-name">
          ${course.code ? `<strong class="course-code">${esc(course.code)}</strong>` : ""}
          ${esc(tr(course.name))}
        </span>
        <span class="badge badge-credit">${esc(formatCreditBadge(course))}</span>
        <span class="badge ${mand ? "badge-mandatory" : "badge-optional"}">${esc(mand ? t("mandatoryShort") : t("optionalShort"))}</span>
        ${sched.hasGroups && !sched.isSeniorFlex ? `<span class="badge badge-group">${sched.activeGroup === 'A' ? esc(t("groupShortA")) : esc(t("groupShortB"))}</span>` : ""}
        ${isPinned ? `<span class="badge badge-pinned-pill">${ICONS.pin}<span>${esc(t("pinnedBadge"))}</span></span>` : ""}
        ${(() => {
          const att = getCourseAttendance(idx);
          const hasSec = sched.sections && sched.sections.length > 0;
          const parts = [];
          if (att.lecture !== "mandatory") parts.push(`${t("attendanceLectureLabel")}: ${att.lecture === "skip" ? t("attendanceOptSkip") : t("attendanceOptRare")}`);
          if (hasSec && att.section !== "mandatory") parts.push(`${t("attendanceSectionLabel").split(" ")[0]}: ${att.section === "skip" ? t("attendanceOptSkip") : t("attendanceOptRare")}`);
          if (!parts.length) return "";
          return `<span class="badge badge-attendance-pill" title="${esc(parts.join(" · "))}">${ICONS.userCheck}<span>${esc(parts.join(" · "))}</span></span>`;
        })()}
      </div>
      <div class="reg-actions">
        ${lectureGroupPicker}
        ${sectionSelectHtml}
        ${pinButtonHtml}
        <button class="icon-btn reg-remove" data-idx="${idx}" type="button"
                title="${esc(t("removeCourse"))}" aria-label="${esc(t("removeCourse"))}">${ICONS.x}</button>
      </div>
    </div>`;
  }).join("");

  const heroCallout = state.selected.length ? `
    <div class="opt-hero-callout">
      <div class="opt-hero-beacon" aria-hidden="true">
        <span class="beacon-pulse"></span>
        <span class="beacon-core"></span>
      </div>
      <div class="opt-hero-content">
        <div class="opt-hero-badge">
          <span class="opt-hero-badge-icon">${ICONS.target}</span>
          <span>${esc(t("optCalloutBadge"))}</span>
        </div>
        <div class="section-title-row opt-hero-title-row">
          <h3 class="opt-hero-title">${esc(t("optCalloutTitle"))}</h3>
          ${helpTip(t("optCalloutDesc"))}
        </div>
      </div>
      <div class="opt-hero-cta">
        <button class="btn-smart-cta open-optimizer-trigger" type="button">
          <span class="btn-smart-cta-icon">${ICONS.target}</span>
          <span>${esc(t("optCalloutBtn"))}</span>
          <span class="btn-smart-cta-arrow" aria-hidden="true">${state.lang === "ar" ? "←" : "→"}</span>
        </button>
      </div>
    </div>` : "";

  const customAttCount = countCustomAttendance();
  const attendanceTrigger = state.selected.length ? `
    <div class="attendance-trigger-card">
      <div class="attendance-trigger-content">
        <div class="attendance-trigger-icon-wrap" aria-hidden="true">
          <span class="attendance-trigger-icon">${ICONS.userCheck}</span>
        </div>
        <div class="attendance-trigger-info">
          <div class="section-title-row">
            <h4 class="attendance-trigger-title">${esc(t("attendanceBtn"))}</h4>
            ${helpTip(t("attendanceBtnSub"))}
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-outline btn-small open-attendance-modal-btn">
        <span class="btn-icon">${ICONS.list}</span>
        <span>${esc(t("attendanceConfigureBtn"))}</span>
        ${customAttCount > 0 ? `<span class="badge badge-accent">${esc(t("attendanceBadgeActive").replace("{n}", customAttCount))}</span>` : ""}
      </button>
    </div>` : "";

  return `
  <section class="registered-panel" id="registered">
    <div class="registered-header-row">
      <div class="registered-header-left">
        <div class="section-title-row">
          <h2 class="registered-title">${esc(t("registeredTitle"))}</h2>
          ${helpTip(t("registeredSubtitle"))}
        </div>
      </div>
      <div class="registered-header-right">
        <span class="badge badge-credit">${usedHours()} / ${state.hoursLimit} ${esc(t("creditHoursUnit"))}</span>
        ${state.hoursLimit - usedHours() > 0 ? `<span class="badge badge-optional">${esc(t("creditHoursRemaining").replace("{rem}", state.hoursLimit - usedHours()))}</span>` : ""}
      </div>
    </div>
    ${cohortCard}
    ${seniorBanner}
    ${heroCallout}
    ${attendanceTrigger}
    ${state.selected.length
      ? `<div class="reg-list">${items}</div>`
      : `<p class="registered-empty">${esc(t("registeredEmpty"))}</p>`}
  </section>`;
}

/* ------------------------------------------- Smart Optimizer Modal View */
function getStrainLabel(strain) {
  switch (strain) {
    case "low": return t("optStrainLow");
    case "medium": return t("optStrainMedium");
    case "high": return t("optStrainHigh");
    case "very_high": return t("optStrainVeryHigh");
    default: return strain;
  }
}

function renderOptimizerModal() {
  if (!optState.isOpen) return "";

  if (!state.selected.length) {
    return `
    <div class="modal-backdrop is-open" id="optimizerModal">
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-title-group">
            <h2 class="modal-title">${ICONS.target}<span>${esc(t("optimizerTitle"))}</span>${helpTip(t("optimizerSubtitle"))}</h2>
          </div>
          <button class="modal-close-btn" id="closeOptimizerBtn" type="button" aria-label="${esc(t("optCloseModal"))}">${ICONS.x}</button>
        </div>
        <div class="opt-body">
          <p class="registered-empty">${esc(t("emptyGrid"))}</p>
        </div>
      </div>
    </div>`;
  }

  const res = typeof ScheduleOptimizer !== "undefined"
    ? ScheduleOptimizer.solve(state.selected)
    : { feasible: false, bottleneck: { type: "complex_multi_clash" } };

  const pinnedCount = countPinnedSections();
  let bodyContent = "";

  if (!res.feasible) {
    const bn = res.bottleneck || {};
    let desc = "";

    if (bn.type === "pinned_section_clash" && bn.courseA) {
      const c1Name = `${bn.courseA.code || ""} ${tr(bn.courseA.name)}`.trim();
      desc = t("optBottleneckPinned").replace("{c1}", `<strong>${esc(c1Name)}</strong>`);
    } else if (bn.type === "lecture_clash" && bn.clashes && bn.clashes.length > 0) {
      const c = bn.clashes[0];
      const c1Name = `${c.courses[0].code || ""} ${tr(c.courses[0].name)}`.trim();
      const c2Name = `${c.courses[1].code || ""} ${tr(c.courses[1].name)}`.trim();
      const dayObj = DAYS.find((d) => d.key === c.day);
      desc = t("optBottleneckLecture")
        .replace("{c1}", `<strong>${esc(c1Name)}</strong>`)
        .replace("{c2}", `<strong>${esc(c2Name)}</strong>`)
        .replace("{day}", `<strong>${esc(tr(dayObj))}</strong>`)
        .replace("{slot}", `<strong>${c.slot}</strong>`);
    } else if (bn.type === "all_sections_blocked_by_lectures" && bn.blockedInfo && bn.blockedInfo.length > 0) {
      const b = bn.blockedInfo[0];
      const cName = `${b.course.code || ""} ${tr(b.course.name)}`.trim();
      desc = t("optBottleneckSections").replace("{c1}", `<strong>${esc(cName)}</strong>`);
    } else if (bn.type === "pairwise_section_clash" && bn.courseA && bn.courseB) {
      const c1Name = `${bn.courseA.code || ""} ${tr(bn.courseA.name)}`.trim();
      const c2Name = `${bn.courseB.code || ""} ${tr(bn.courseB.name)}`.trim();
      desc = t("optBottleneckPairwise")
        .replace("{c1}", `<strong>${esc(c1Name)}</strong>`)
        .replace("{c2}", `<strong>${esc(c2Name)}</strong>`);
    } else {
      desc = t("optBottleneckGeneric");
    }

    bodyContent = `
    <div class="opt-bottleneck-card">
      <div class="opt-bn-head">
        ${ICONS.alert}
        <span>${esc(t("optBottleneckTitle"))}</span>
      </div>
      <p class="opt-bn-desc">${esc(t("optBottleneckDesc"))}</p>
      <div class="opt-bn-details">${desc}</div>
      <div class="opt-apply-actions opt-bn-actions">
        ${pinnedCount > 0 ? `
          <button class="btn btn-outline" id="optUnpinAllRetryBtn" type="button">
            ${ICONS.pin}<span>${esc(t("optUnpinAllBtn"))}</span>
          </button>` : ""}
        ${!state.allowConflicts ? `
          <button class="btn btn-primary" id="optEnableConflictBtn" type="button">
            ${ICONS.shieldAlert}<span>${esc(t("optEnableConflictModeBtn"))}</span>
          </button>` : ""}
        <button class="btn btn-ghost" id="optCloseBtn" type="button">${esc(t("optCloseModal"))}</button>
      </div>
    </div>`;
  } else {
    const customAttCount = countCustomAttendance();
    const relaxedConflictBanner = res.hasConflicts ? `
      <div class="opt-conflict-relaxed-banner">
        ${ICONS.shieldAlert}
        <span>${esc(t("optConflictRelaxedBanner").replace("{n}", res.minConflicts))}</span>
      </div>` : "";

    const feasibleBanner = `
    ${relaxedConflictBanner}
    <div class="opt-status-pills-row">
      <span class="opt-feasible-summary">${esc(t("optFeasibleCount").replace("{n}", res.count))}</span>
      ${pinnedCount > 0 ? `<span class="badge badge-pinned-pill">${ICONS.pin}<span>${esc(t("optPinnedActiveNote").replace("{n}", pinnedCount))}</span></span>` : ""}
      ${customAttCount > 0 ? `<span class="badge badge-attendance-pill">${ICONS.userCheck}<span>${esc(t("optAttendanceActiveNote").replace("{n}", customAttCount))}</span></span>` : ""}
    </div>`;

    if (optState.tab === "focus") {
      const optResult = ScheduleOptimizer.optimizeForScenario(state.selected, optState.selectedScenario);
      const best = optResult.best;

      const scenariosHtml = ScheduleOptimizer.SCENARIOS.map((sc) => {
        const isSel = optState.selectedScenario === sc.id;
        return `
        <div class="opt-scenario-card ${isSel ? "is-selected" : ""}" data-scenario="${sc.id}">
          <div class="opt-sc-top">
            <span class="opt-sc-icon">${ICONS[sc.iconKey] || ICONS.target}</span>
            <div class="section-title-row">
              <div class="opt-sc-title">${esc(tr(sc.name))}</div>
              ${helpTip(tr(sc.subtitle))}
            </div>
          </div>
        </div>`;
      }).join("");

      const previewHtml = best ? `
      <div class="opt-preview-panel">
        <div class="opt-preview-head">
          <h3 class="opt-preview-title">
            <span class="opt-preview-icon">${ICONS[optResult.scenario.iconKey] || ICONS.target}</span>
            <span>${esc(tr(optResult.scenario.name))}</span>
            ${helpTip(tr(optResult.scenario.desc))}
          </h3>
          <div class="opt-preview-badges">
            ${best.conflictCount > 0
              ? `<span class="badge badge-conflict-waived">${ICONS.alert}<span>${esc(t("optConflictCountBadge").replace("{n}", best.conflictCount))}</span></span>`
              : `<span class="badge badge-mandatory">${ICONS.check}<span>${esc(t("optConflictZeroBadge"))}</span></span>`}
          </div>
        </div>

        <div class="opt-metrics-grid">
          <div class="opt-metric-box">
            <span class="opt-metric-label">${esc(t("optActiveDays"))}</span>
            <span class="opt-metric-val">${best.activeDays} ${esc(t("metricDaysUnit"))}</span>
          </div>
          <div class="opt-metric-box">
            <span class="opt-metric-label">${esc(t("optGapHours"))}</span>
            <span class="opt-metric-val">${best.totalGapHours} ${esc(t("metricHoursUnit"))}</span>
          </div>
          <div class="opt-metric-box">
            <span class="opt-metric-label">${esc(t("optTransitStrain"))}</span>
            <span class="opt-metric-val opt-metric-val--strain-${best.transitStrain}">${esc(getStrainLabel(best.transitStrain))}</span>
          </div>
          <div class="opt-metric-box">
            <span class="opt-metric-label">${esc(t("optMorningClasses"))}</span>
            <span class="opt-metric-val">${best.morningSlotsCount}</span>
          </div>
          <div class="opt-metric-box">
            <span class="opt-metric-label">${esc(t("optLateClasses"))}</span>
            <span class="opt-metric-val">${best.lateSlotsCount}</span>
          </div>
        </div>

        <div class="opt-apply-actions">
          <button class="btn btn-ghost" id="optCloseBtn" type="button">${esc(t("optCloseModal"))}</button>
          <button class="btn btn-primary opt-apply-btn" data-scenario="${optResult.scenario.id}" type="button">
            ${ICONS.check}<span>${esc(t("optApplyBtn"))}</span>
          </button>
        </div>
      </div>` : "";

      bodyContent = `
      ${feasibleBanner}
      <h3 class="opt-section-header">${esc(t("optSelectGoalHeader"))}</h3>
      <div class="opt-scenarios-grid">${scenariosHtml}</div>
      ${previewHtml}`;
    } else {
      const compResult = ScheduleOptimizer.compareAllScenarios(state.selected);
      const cardsHtml = compResult.comparison.map(({ scenario, best }) => {
        return `
        <div class="opt-compare-card">
          <div class="opt-compare-info">
            <h4 class="opt-compare-title">
              <span class="opt-compare-title-icon">${ICONS[scenario.iconKey] || ICONS.target}</span>
              <span>${esc(tr(scenario.name))}</span>
              ${helpTip(tr(scenario.subtitle))}
              ${best.conflictCount > 0 ? `<span class="badge badge-conflict-waived">${esc(t("optConflictCountBadge").replace("{n}", best.conflictCount))}</span>` : ""}
            </h4>
            <div class="opt-compare-metrics">
              <span class="opt-cmp-metric">${ICONS.calendar} <strong>${best.activeDays}</strong> ${esc(t("metricDaysUnit"))}</span>
              <span aria-hidden="true">·</span>
              <span class="opt-cmp-metric">${ICONS.hourglass} <strong>${best.totalGapHours}</strong> ${esc(t("metricHoursUnit"))}</span>
              <span aria-hidden="true">·</span>
              <span class="opt-cmp-metric">${ICONS.walk} <strong class="opt-metric-val--strain-${best.transitStrain}">${esc(getStrainLabel(best.transitStrain))}</strong></span>
              <span aria-hidden="true">·</span>
              <span class="opt-cmp-metric">${ICONS.sunrise} <strong>${best.morningSlotsCount}</strong> ${state.lang === "ar" ? "8:00 ص" : "8:00 AM"}</span>
            </div>
          </div>
          <div class="opt-compare-action">
            <button class="btn btn-primary btn-small opt-apply-btn" data-scenario="${scenario.id}" type="button">
              ${ICONS.check}<span>${esc(t("optApplyBtn"))}</span>
            </button>
          </div>
        </div>`;
      }).join("");

      bodyContent = `
      ${feasibleBanner}
      <h3 class="opt-section-header">${esc(t("optCompareHeader"))}</h3>
      <div class="opt-compare-list">${cardsHtml}</div>
      <div class="opt-apply-actions" style="margin-top: 1rem;">
        <button class="btn btn-ghost" id="optCloseBtn" type="button">${esc(t("optCloseModal"))}</button>
      </div>`;
    }
  }

  return `
  <div class="modal-backdrop is-open" id="optimizerModal">
    <div class="modal-card" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title-group">
          <h2 class="modal-title">${ICONS.target}<span>${esc(t("optimizerTitle"))}</span>${helpTip(t("optimizerSubtitle"))}</h2>
        </div>
        <button class="modal-close-btn" id="closeOptimizerBtn" type="button" aria-label="${esc(t("optCloseModal"))}">${ICONS.x}</button>
      </div>

      ${res.feasible ? `
      <div class="opt-tabs">
        <button class="opt-tab ${optState.tab === "focus" ? "active" : ""}" data-tab="focus" type="button">
          ${ICONS.target}<span>${esc(t("tabFocusGoal"))}</span>
        </button>
        <button class="opt-tab ${optState.tab === "compare" ? "active" : ""}" data-tab="compare" type="button">
          ${ICONS.chart}<span>${esc(t("tabCompareAll"))}</span>
        </button>
      </div>` : ""}

      <div class="opt-body">
        ${bodyContent}
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------ Timetable panel */
function renderGridCell(day, slot, model) {
  const items = model.cells[`${day.key}:${slot.n}`] || [];
  const cellCls = items.some((p) => p.conflict === "lecture") && !items.some((p) => p.kind === "section")
    ? "tt-cell--lecture"
    : items.some((p) => p.conflict) ? "tt-cell--section" : (items.length ? "tt-cell--filled" : "");

  const body = items.map((p) => {
    const courseName = esc(tr(p.course.name));
    const title = (p.first || p.kind === "section")
      ? `${p.course.code ? `<strong class="tt-code">${esc(p.course.code)}</strong>` : ""}<span class="tt-cname">${courseName}</span>`
      : `${p.course.code ? `<strong class="tt-code">${esc(p.course.code)}</strong>` : ""}<span class="tt-cname">${courseName}</span><span class="tt-cont">(${esc(t("continuation"))})</span>`;

    const attCls = p.attendance === "skip" ? "tt-item--att-skip" : p.attendance === "rare" ? "tt-item--att-rare" : "";
    const pinCls = p.pinned ? "tt-item--pinned" : "";
    const attBadge = p.attendance === "skip"
      ? `<span class="tt-att-tag tt-att-tag--skip">${esc(t("ttBadgeSkip"))}</span>`
      : p.attendance === "rare"
        ? `<span class="tt-att-tag tt-att-tag--rare">${esc(t("ttBadgeRare"))}</span>`
        : "";

    const kindLabel = p.kind === "lecture"
      ? esc(t("lectureWord")) + (p.group ? ` (${esc(p.group)})` : "")
      : `${esc(t("sectionWord"))} ${p.labels ? esc(p.labels.join(", ")) : ""}`;

    const pinBtn = p.kind === "section" ? `
      <button type="button" class="tt-pin-btn ${p.pinned ? "is-pinned" : ""}"
              data-pin-course="${p.courseIdx}"
              title="${esc(p.pinned ? t("unpinSectionBtn") : t("pinSectionBtn"))}"
              aria-label="${esc(p.pinned ? t("unpinSectionBtn") : t("pinSectionBtn"))}">
        ${ICONS.pin}
      </button>` : "";

    const clashTag = p.conflict ? `
      <span class="tt-clash" title="${esc(state.allowConflicts ? t("ttConflictWaivedBadge") : t("conflictSection"))}">
        ${ICONS.alert}
        ${state.allowConflicts ? `<span class="tt-clash-text">${esc(t("ttConflictWaivedBadge"))}</span>` : ""}
      </span>` : "";

    return `
    <div class="tt-item tt-item--${p.kind} ${pinCls} ${attCls} ${p.conflict ? "tt-item--clash-" + p.conflict : ""}">
      <div class="tt-item-top">
        <span class="tt-kind tt-kind--${p.kind}">${kindLabel}</span>
        <div class="tt-item-top-end">
          ${attBadge}
          ${clashTag}
          ${pinBtn}
        </div>
      </div>
      <div class="tt-item-title">${title}</div>
      <div class="tt-item-sub">
        <span class="tt-place">${esc(p.place)}</span>${p.doctor ? `<span class="tt-sep">·</span><span class="tt-doc">${esc(p.doctor)}</span>` : ""}
      </div>
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
    const mand = p.course.mandatoryFor && p.course.mandatoryFor.includes(state.dept);
    return `
    <li>
      <span class="warn-kind warn-kind--${p.kind}">${p.kind === "lecture" ? esc(t("lectureWord")) : esc(t("sectionWord"))}</span>
      <strong>${esc(p.course.code || "")}</strong> ${esc(tr(p.course.name))} · ${esc(p.place)}
      ${p.doctor ? " · " + esc(p.doctor) : ""}${p.labels ? " · " + esc(p.labels.join("/")) : ""}
      <span class="badge ${mand ? "badge-mandatory" : "badge-optional"}">${esc(mand ? t("mandatoryShort") : t("optionalShort"))}</span>
    </li>`;
  }).join("");

  const hint = state.allowConflicts
    ? t("conflictModeWarningBody")
    : (c.type === "lecture"
        ? t("hintLectureHard")
        : t("hintSectionFix") + (c.items.some((p) => !p.course.mandatoryFor.includes(state.dept))
            ? " " + t("hintOptionalSwap") : ""));

  return `
  <div class="warn warn--${c.type}">
    <div class="warn-head">
      <span class="warn-icon">${ICONS.alert}</span>
      <strong>${esc(state.allowConflicts ? t("ttConflictWaivedBadge") + " — " : "")}${esc(c.type === "lecture" ? t("conflictLecture") : t("conflictSection"))}</strong>
      <span class="warn-meta">${esc(tr(day))} · ${esc(t("slotWord"))} ${slot.n} (${esc(slot.short)} / ${esc(slot.long)})</span>
    </div>
    <ul class="warn-items">${items}</ul>
    <p class="warn-hint">${esc(hint)}</p>
  </div>`;
}

function renderTimetablePanel(model) {
  const pending = state.selected.filter((i) => {
    const s = typeof Timetable !== "undefined" && Timetable.getCourseSchedule
      ? Timetable.getCourseSchedule(COURSES[i], i, state)
      : COURSES[i];
    return s?.sections?.length > 0 && state.picks[i] == null;
  }).length;
  const hasConflicts = model.conflicts.length > 0;

  /* transposed grid: days = rows, Slot 1..7 = columns (both times on top) */
  return `
  <section class="timetable-panel" id="timetable">
    <div class="tt-head">
      <div class="tt-head-start">
        <h2 class="tt-title">${esc(t("myTimetable"))}</h2>
        <div class="tt-legend-bar" aria-label="Legend">
          <span class="tt-legend-item"><span class="tt-legend-swatch tt-legend-swatch--lecture"></span>${esc(t("legendLecture"))}</span>
          <span class="tt-legend-item"><span class="tt-legend-swatch tt-legend-swatch--section"></span>${esc(t("legendSection"))}</span>
          <span class="tt-legend-item"><span class="tt-legend-swatch tt-legend-swatch--pinned"></span>${esc(t("legendPinned"))}</span>
          <span class="tt-legend-item"><span class="tt-legend-swatch tt-legend-swatch--conflict"></span>${esc(t("legendConflict"))}</span>
        </div>
      </div>
      <div class="tt-actions">
        ${hasConflicts ? `
          <button class="btn btn-primary btn-small open-optimizer-trigger tt-opt-btn" type="button" title="${esc(t("optSolveClashesBtn"))}">
            ${ICONS.target}
            <span>${esc(t("optSolveClashesBtn"))}</span>
          </button>` : ""}
        <span class="tt-status ${hasConflicts ? "tt-status--bad" : "tt-status--ok"}">
          ${hasConflicts
            ? `${ICONS.alert}<span>${model.conflicts.length} ${esc(t("conflictsUnit"))}</span>`
            : `${ICONS.check}<span>${esc(t("noConflicts"))}</span>`}
        </span>
        <button class="btn btn-ghost btn-small open-schedule-trigger" type="button"
                title="${esc(t("officialScheduleBtn").replace("{v}", APP_CONFIG.officialSchedule.version))}">
          ${ICONS.fileText}
          <span>${esc(t("officialScheduleBtn").replace("{v}", APP_CONFIG.officialSchedule.version))}</span>
        </button>
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
              <span class="tt-slot-t"><span class="tt-slot-short">${esc(sl.short)}</span><span class="tt-slot-long">${esc(sl.long)}</span></span>
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
  const deptName = state.dept === "GEN"
    ? t("generalTag")
    : tr(DEPT_NAMES[state.dept] || { ar: state.dept, en: state.dept });
  const groups = groupCourses();
  const model = Timetable.build(state);
  const asList = state.catalogView === "list";

  const groupHtml = groups.map(({ dept, items }) => renderGroup(dept, items, asList)).join("");

  return `
  <div class="planner">
    <div class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">${esc(t("levelLabel") || "المستوى")}</span>
        <span class="summary-value">${state.isNewcomer ? esc(t("newcomerBadge")) : esc(t("levelPrefix")) + " " + state.level}${(state.isNewcomer || (state.level || 1) <= 2) && state.group ? " · " + esc(t("groupTag").replace("{g}", state.group)) : ""}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">${esc(t("deptLabel"))}</span>
        <span class="summary-value">${state.dept === "GEN" ? esc(deptName) : esc(state.dept) + " · " + esc(deptName)}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">GPA</span>
        <span class="summary-value">${formatGpaSummary()}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">${esc(t("yourHoursLimit"))}</span>
        <span class="summary-value highlight-limit">${state.hoursLimit} ${esc(t("creditHoursUnit"))}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">${esc(t("hoursLabel"))}</span>
        <span class="summary-value ${usedHours() > state.hoursLimit ? "text-danger" : ""}">${usedHours()} / ${state.hoursLimit} ${esc(t("creditHoursUnitShort"))}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">${esc(t("selectedLabel"))}</span>
        <span class="summary-value" id="selectedCounter">${state.selected.length} ${esc(t("coursesUnit"))}</span>
      </div>
      <div class="summary-nav">
        <button class="btn-conflict-quick ${state.allowConflicts ? "is-active" : ""}" id="summaryConflictToggleBtn" type="button" title="${esc(t("conflictSummaryToggleHint"))}">
          ${ICONS.shieldAlert}
          <span>${esc(state.allowConflicts ? t("conflictSummaryOn") : t("conflictSummaryOff"))}</span>
        </button>
        <button class="btn btn-ghost btn-small" data-goto="#catalog" type="button">${ICONS.book}<span>${esc(t("navCourses"))}</span></button>
        <button class="btn btn-ghost btn-small" data-goto="#registered" type="button">${ICONS.check}<span>${esc(t("navRegistered"))}</span></button>
        <button class="btn btn-ghost btn-small" data-goto="#timetable" type="button">${ICONS.calendar}<span>${esc(t("navTimetable"))}</span></button>
      </div>
      <button class="btn btn-ghost btn-small" id="editInfoBtn" type="button">${esc(t("editInfo"))}</button>
    </div>

    ${state.allowConflicts ? `
    <div class="conflict-active-strip" role="status">
      <div class="conflict-strip-main">
        ${ICONS.shieldAlert}
        <strong>${esc(t("conflictModeWarningTitle"))}:</strong>
        <span>${esc(t("conflictModeWarningBody"))}</span>
      </div>
    </div>` : ""}

    <div class="catalog-col" id="catalog">
      <header class="catalog-header">
        <div class="section-title-row">
          <h1 class="card-title">${esc(t("catalogTitle"))}</h1>
          ${helpTip(t("catalogSubtitle"))}
        </div>
        <div class="view-toggle" role="group" aria-label="catalog view">
          <button type="button" data-view="grid" class="view-btn ${!asList ? "is-active" : ""}">${ICONS.grid}<span>${esc(t("viewGrid"))}</span></button>
          <button type="button" data-view="list" class="view-btn ${asList ? "is-active" : ""}">${ICONS.list}<span>${esc(t("viewList"))}</span></button>
        </div>
        ${state.isNewcomer ? "" : `
          <div class="level-filter-pills" role="tablist" aria-label="level filters">
            <button type="button" class="filter-pill ${state.catalogLevelFilter === "all" ? "is-active" : ""}" data-level="all">${esc(t("filterAllLevels"))}</button>
            <button type="button" class="filter-pill ${state.catalogLevelFilter === "1" ? "is-active" : ""}" data-level="1">${esc(t("filterLevel1"))}</button>
            <button type="button" class="filter-pill ${state.catalogLevelFilter === "2" ? "is-active" : ""}" data-level="2">${esc(t("filterLevel2"))}</button>
            <button type="button" class="filter-pill ${state.catalogLevelFilter === "3" ? "is-active" : ""}" data-level="3">${esc(t("filterLevel3"))}</button>
            <button type="button" class="filter-pill ${state.catalogLevelFilter === "4" ? "is-active" : ""}" data-level="4">${esc(t("filterLevel4"))}</button>
            <button type="button" class="filter-pill ${state.catalogLevelFilter === "retake" ? "is-active" : ""}" data-level="retake">${esc(t("filterRetakes"))}</button>
          </div>
        `}
      </header>
      ${groupHtml}
    </div>

    ${renderRegisteredList(model)}

    ${renderTimetablePanel(model)}

    ${renderOptimizerModal()}
  </div>`;
}

function bindPlanner() {
  const editBtn = $("#editInfoBtn");
  if (editBtn) editBtn.addEventListener("click", goBackToSetup);

  const summaryConflictToggleBtn = $("#summaryConflictToggleBtn");
  if (summaryConflictToggleBtn) {
    summaryConflictToggleBtn.addEventListener("click", () => {
      toggleConflictMode();
    });
  }

  /* Pin section buttons (both in Registered List and inside Timetable Grid cells) */
  $$("[data-pin-course]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePinSection(btn.getAttribute("data-pin-course"));
    });
  });

  /* Smart Optimizer bindings - wire all trigger touchpoints */
  $$(".open-optimizer-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      optState.isOpen = true;
      renderAll();
    });
  });

  const closeOpt = $("#closeOptimizerBtn");
  if (closeOpt) {
    closeOpt.addEventListener("click", () => {
      optState.isOpen = false;
      renderAll();
    });
  }

  const optCloseBtn = $("#optCloseBtn");
  if (optCloseBtn) {
    optCloseBtn.addEventListener("click", () => {
      optState.isOpen = false;
      renderAll();
    });
  }

  const optEnableConflictBtn = $("#optEnableConflictBtn");
  if (optEnableConflictBtn) {
    optEnableConflictBtn.addEventListener("click", () => {
      toggleConflictMode(true);
    });
  }

  const optUnpinAllRetryBtn = $("#optUnpinAllRetryBtn");
  if (optUnpinAllRetryBtn) {
    optUnpinAllRetryBtn.addEventListener("click", () => {
      state.pinnedSections = {};
      persist();
      renderAll();
    });
  }

  const modalBackdrop = $("#optimizerModal");
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) {
        optState.isOpen = false;
        renderAll();
      }
    });
  }

  $$(".opt-tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      optState.tab = tabBtn.dataset.tab;
      renderAll();
    });
  });

  $$(".opt-scenario-card").forEach((card) => {
    card.addEventListener("click", () => {
      optState.selectedScenario = card.dataset.scenario;
      renderAll();
    });
  });

  $$(".opt-apply-btn").forEach((applyBtn) => {
    applyBtn.addEventListener("click", () => {
      const scId = applyBtn.dataset.scenario;
      if (typeof ScheduleOptimizer !== "undefined") {
        const optResult = ScheduleOptimizer.optimizeForScenario(state.selected, scId);
        if (optResult && optResult.feasible && optResult.best) {
          state.picks = { ...optResult.best.picks };
          if (optResult.best.lecturePicks) {
            state.lecturePicks = { ...(state.lecturePicks || {}), ...optResult.best.lecturePicks };
          }
          optState.appliedScenarioId = scId;
          optState.isOpen = false;
          persist();
          renderAll();
          showToast(t("optAppliedToast"));
        }
      }
    });
  });

  $$("[data-view]").forEach((btn) => btn.addEventListener("click", () => {
    state.catalogView = btn.dataset.view;
    persist();
    renderAll();
  }));

  $$("[data-goto]").forEach((btn) => btn.addEventListener("click", () => {
    const el = $(btn.dataset.goto);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  $$(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      state.catalogLevelFilter = pill.dataset.level;
      persist();
      renderAll();
    });
  });

  $$(".course-check").forEach((box) => {
    box.addEventListener("change", () => {
      const idx = Number(box.dataset.idx);
      const course = COURSES[idx];
      if (box.checked) {
        if (!canAddCourse(idx)) {
          box.checked = false;
          const cost = course && typeof course.creditHours === "number" ? course.creditHours : 3;
          const rem = Math.max(0, state.hoursLimit - usedHours());
          const msg = t("limitReachedRemaining")
            .replace("{rem}", rem)
            .replace("{cost}", cost)
            .replace("{limit}", state.hoursLimit);
          showToast(msg);
          box.closest(".course-card")?.classList.add("shake");
          setTimeout(() => box.closest(".course-card")?.classList.remove("shake"), 400);
          return;
        }

        const clashInfo = typeof Timetable !== "undefined" && Timetable.getCourseConflictWithState
          ? Timetable.getCourseConflictWithState(idx, state)
          : { hasConflict: false, conflictingCourses: [], preferredSafeLecGroup: null };

        if (clashInfo.hasConflict && !state.allowConflicts) {
          box.checked = false;
          const clashNames = formatCourseShortList(clashInfo.conflictingCourses);
          showToast(t("toastConflictLockedCourse").replace("{courses}", clashNames));
          box.closest(".course-card")?.classList.add("shake");
          setTimeout(() => box.closest(".course-card")?.classList.remove("shake"), 400);
          return;
        }

        if (!state.selected.includes(idx)) {
          state.selected.push(idx);
          if (clashInfo.preferredSafeLecGroup) {
            state.lecturePicks = state.lecturePicks || {};
            state.lecturePicks[idx] = clashInfo.preferredSafeLecGroup;
          }
          if (typeof Analytics !== "undefined") {
            Analytics.trackCourseToggled(course?.code, tr(course?.name), true);
          }
        }
      } else {
        state.selected = state.selected.filter((i) => i !== idx);
        pruneOrphanedCourseState();
        if (typeof Analytics !== "undefined") {
          Analytics.trackCourseToggled(course?.code, tr(course?.name), false);
        }
      }
      computeLimit();
      persist();
      renderAll();
    });
  });

  $$(".cohort-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetGroup = btn.getAttribute("data-group");
      if (state.group === targetGroup) return;
      state.group = targetGroup;
      // Re-validate section picks for courses with groups
      state.selected.forEach((idx) => {
        const c = COURSES[idx];
        if (c && c.hasGroups) {
          const sched = Timetable.getCourseSchedule(c, idx, state);
          const currentPick = state.picks[idx];
          if (currentPick != null && !sched.sections[currentPick]) {
            delete state.picks[idx];
            if (state.pinnedSections) delete state.pinnedSections[idx];
          }
        }
      });
      if (!state.allowConflicts) {
        sanitizeConflictsWhenLocking();
      }
      persist();
      renderAll();
    });
  });

  $$(".btn-lec-grp").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-idx"));
      const targetGroup = btn.getAttribute("data-lecgroup");
      const grpClash = Timetable.getLectureGroupConflictWithState(idx, targetGroup, state);
      if (grpClash.hasConflict && !state.allowConflicts) {
        showToast(t("toastConflictLockedSection").replace("{courses}", formatCourseShortList(grpClash.conflictingCourses)));
        return;
      }
      state.lecturePicks = state.lecturePicks || {};
      state.lecturePicks[idx] = targetGroup;
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
        if (state.pinnedSections) delete state.pinnedSections[idx];
      } else {
        const pickIdx = Number(sel.value);
        const secClash = Timetable.getSectionConflictWithState(idx, pickIdx, state);
        if (secClash.hasConflict && !state.allowConflicts) {
          showToast(t("toastConflictLockedSection").replace("{courses}", formatCourseShortList(secClash.conflictingCourses)));
          renderAll();
          return;
        }
        state.picks[idx] = pickIdx;
        const sched = typeof Timetable !== "undefined" && Timetable.getCourseSchedule
          ? Timetable.getCourseSchedule(course, idx, state)
          : null;
        if (typeof Analytics !== "undefined") {
          const sec = sched?.sections[pickIdx] || course?.sections[pickIdx];
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
      if (state.pinnedSections) delete state.pinnedSections[idx];
      if (state.lecturePicks) delete state.lecturePicks[idx];
      if (state.attendance) delete state.attendance[idx];
      if (typeof Analytics !== "undefined") {
        Analytics.trackCourseToggled(course?.code, tr(course?.name), false);
      }
      computeLimit();
      persist();
      renderAll();
    });
  });

  $$(".open-attendance-modal-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      attendanceModalState.isOpen = true;
      renderAll();
    });
  });

  $$(".open-schedule-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      schedModalState.isOpen = true;
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

/* ------------------------------------------- Official Schedule Modal View */
function renderScheduleModal() {
  if (!schedModalState.isOpen) return "";

  const sched = APP_CONFIG.officialSchedule;
  const versionTitle = t("officialScheduleBtn").replace("{v}", sched.version);
  const modalSub = t("scheduleModalSubtitle").replace("{v}", sched.version);

  return `
  <div class="modal-backdrop is-open" id="scheduleModal">
    <div class="schedule-modal-card" role="dialog" aria-modal="true" aria-labelledby="scheduleModalTitle">
      <div class="schedule-modal-header">
        <div class="schedule-modal-title-group">
          <h2 class="schedule-modal-title" id="scheduleModalTitle">
            ${ICONS.fileText}
            <span>${esc(t("scheduleModalTitle"))}</span>
            <span class="schedule-version-badge">${esc(sched.version)}</span>
            ${helpTip(modalSub)}
          </h2>
        </div>
        <div class="schedule-modal-actions">
          <a class="btn btn-ghost btn-small" href="${esc(sched.shareUrl)}" target="_blank" rel="noopener">
            ${ICONS.externalLink}<span>${esc(t("openInDrive"))}</span>
          </a>
          <button class="modal-close-btn" id="closeScheduleModalBtn" type="button" aria-label="${esc(t("closeScheduleModal"))}">${ICONS.x}</button>
        </div>
      </div>
      <div class="schedule-iframe-container">
        <iframe src="${esc(sched.previewUrl)}" class="schedule-iframe" title="${esc(versionTitle)}" allow="autoplay" loading="lazy"></iframe>
      </div>
      <div class="schedule-modal-footer">
        <span>${esc(t("scheduleViewerFallback"))}</span>
        <a href="${esc(sched.shareUrl)}" target="_blank" rel="noopener">
          ${esc(sched.shareUrl)}
        </a>
      </div>
    </div>
  </div>`;
}

function bindScheduleModal() {
  const modal = $("#scheduleModal");
  if (!modal) return;

  const closeBtn = $("#closeScheduleModalBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      schedModalState.isOpen = false;
      renderAll();
    });
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      schedModalState.isOpen = false;
      renderAll();
    }
  });

  const onKeyDown = (e) => {
    if (e.key === "Escape" && schedModalState.isOpen) {
      schedModalState.isOpen = false;
      document.removeEventListener("keydown", onKeyDown);
      renderAll();
    }
  };
  document.addEventListener("keydown", onKeyDown);
}

/* -------------------------------- Attendance Preferences Modal View */
function renderAttendanceModal() {
  if (!attendanceModalState.isOpen) return "";

  const rowsHtml = state.selected.map((idx) => {
    const course = COURSES[idx];
    if (!course) return "";
    const sched = Timetable.getCourseSchedule(course, idx, state);
    const att = getCourseAttendance(idx);

    let lecDetails = "";
    if (sched.lectures && sched.lectures.length > 0) {
      lecDetails = sched.lectures.map((l) => {
        const dayName = t("day_" + l.day);
        const slotText = l.slots.length > 1 ? `${l.slots[0]}-${l.slots[l.slots.length - 1]}` : `${l.slots[0]}`;
        const place = l.place ? ` (${l.place})` : "";
        const doc = l.doctor ? ` · ${l.doctor}` : "";
        return `${dayName} - ${t("slotLabel")} ${slotText}${place}${doc}`;
      }).join(", ");
    }

    return `
    <div class="attendance-course-card" data-idx="${idx}">
      <div class="attendance-course-head">
        <div class="attendance-course-code-wrap">
          ${course.code ? `<strong class="course-code">${esc(course.code)}</strong>` : ""}
          <span class="badge badge-dept badge-${course.dept.toLowerCase()}">${esc(course.dept)}</span>
          <span class="attendance-course-title">${esc(tr(course.name))}</span>
        </div>
        ${course.creditHours ? `<span class="badge badge-credit">${course.creditHours} ${esc(t("creditHoursUnitShort"))}</span>` : ""}
      </div>

      <div class="attendance-rows-wrap">
        <!-- Lecture Attendance Row -->
        <div class="attendance-component-row">
          <div class="attendance-row-meta">
            <span class="attendance-component-tag badge-lecture">${esc(t("attendanceLectureLabel"))}</span>
            <span class="attendance-details-text">${esc(lecDetails || (state.lang === 'ar' ? 'المحاضرة الرسمية' : 'Official Lecture'))}</span>
          </div>
          <div class="attendance-pill-group" role="radiogroup" aria-label="${esc(t("attendanceLectureLabel"))}" data-idx="${idx}" data-component="lecture">
            <button type="button" class="attendance-pill ${att.lecture === 'mandatory' ? 'is-active is-mandatory' : ''}" data-val="mandatory">
              ${esc(t("attendanceOptMandatory"))}
            </button>
            <button type="button" class="attendance-pill ${att.lecture === 'skip' ? 'is-active is-skip' : ''}" data-val="skip">
              ${esc(t("attendanceOptSkip"))}
            </button>
            <button type="button" class="attendance-pill ${att.lecture === 'rare' ? 'is-active is-rare' : ''}" data-val="rare">
              ${esc(t("attendanceOptRare"))}
            </button>
          </div>
        </div>

        ${sched.sections && sched.sections.length > 0 ? `
        <!-- Section Attendance Row (General for course) -->
        <div class="attendance-component-row">
          <div class="attendance-row-meta">
            <span class="attendance-component-tag badge-section">${esc(t("attendanceSectionLabel"))}</span>
            <span class="attendance-details-text">${esc(state.lang === 'ar' ? 'ينطبق على سكشن المادة المختار' : 'Applies to chosen section')}</span>
          </div>
          <div class="attendance-pill-group" role="radiogroup" aria-label="${esc(t("attendanceSectionLabel"))}" data-idx="${idx}" data-component="section">
            <button type="button" class="attendance-pill ${att.section === 'mandatory' ? 'is-active is-mandatory' : ''}" data-val="mandatory">
              ${esc(t("attendanceOptMandatory"))}
            </button>
            <button type="button" class="attendance-pill ${att.section === 'skip' ? 'is-active is-skip' : ''}" data-val="skip">
              ${esc(t("attendanceOptSkip"))}
            </button>
            <button type="button" class="attendance-pill ${att.section === 'rare' ? 'is-active is-rare' : ''}" data-val="rare">
              ${esc(t("attendanceOptRare"))}
            </button>
          </div>
        </div>` : ""}
      </div>
    </div>`;
  }).join("");

  return `
  <div class="modal-backdrop is-open" id="attendanceModal">
    <div class="attendance-modal-card" role="dialog" aria-modal="true" aria-labelledby="attendanceModalTitle">
      <div class="attendance-modal-header">
        <div class="attendance-header-info">
          <div class="attendance-header-icon">${ICONS.userCheck}</div>
          <div>
            <h3 class="attendance-modal-title" id="attendanceModalTitle">${esc(t("attendanceModalTitle"))}</h3>
            <p class="attendance-modal-desc">${esc(t("attendanceModalDesc"))}</p>
          </div>
        </div>
        <button type="button" class="modal-close-btn" id="attendanceModalCloseBtn" aria-label="Close">${ICONS.x}</button>
      </div>

      <div class="attendance-modal-body">
        ${state.selected.length === 0 ? `
          <div class="attendance-empty-state">
            <p>${esc(t("attendanceEmptyNotice"))}</p>
          </div>
        ` : `
          <div class="attendance-courses-list">
            ${rowsHtml}
          </div>
        `}
      </div>

      <div class="attendance-modal-footer">
        <button type="button" class="btn btn-ghost btn-small" id="attendanceResetAllBtn">
          ${esc(t("attendanceResetAll"))}
        </button>
        <button type="button" class="btn btn-primary btn-small" id="attendanceSaveBtn">
          ${esc(t("attendanceSaveBtn"))}
        </button>
      </div>
    </div>
  </div>`;
}

function bindAttendanceModal() {
  const modal = $("#attendanceModal");
  if (!modal) return;

  const close = () => {
    attendanceModalState.isOpen = false;
    persist();
    renderAll();
  };

  const closeBtn = $("#attendanceModalCloseBtn");
  const saveBtn = $("#attendanceSaveBtn");
  const resetBtn = $("#attendanceResetAllBtn");

  if (closeBtn) closeBtn.addEventListener("click", close);
  if (saveBtn) saveBtn.addEventListener("click", close);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  const onKeyDown = (e) => {
    if (e.key === "Escape" && attendanceModalState.isOpen) {
      attendanceModalState.isOpen = false;
      document.removeEventListener("keydown", onKeyDown);
      renderAll();
    }
  };
  document.addEventListener("keydown", onKeyDown);

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      state.attendance = {};
      persist();
      renderAll();
    });
  }

  modal.querySelectorAll(".attendance-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const group = pill.closest(".attendance-pill-group");
      if (!group) return;
      const idx = Number(group.dataset.idx);
      const component = group.dataset.component;
      const val = pill.dataset.val;

      state.attendance = state.attendance || {};
      state.attendance[idx] = state.attendance[idx] || { lecture: "mandatory", section: "mandatory" };
      state.attendance[idx][component] = val;

      group.querySelectorAll(".attendance-pill").forEach((p) => {
        p.classList.remove("is-active", "is-mandatory", "is-skip", "is-rare");
      });
      pill.classList.add("is-active", `is-${val}`);

      persist();
    });
  });
}

/* -------------------------------------- First-Visit Tour Spotlight View */
function renderTourPopover() {
  if (!tourState.isOpen) return "";

  const sched = APP_CONFIG.officialSchedule;
  const title = t("tourNoticeTitle").replace("{v}", sched.version);
  const body = t("tourNoticeBody").replace("{v}", sched.version);

  return `
  <div class="tour-backdrop" id="tourBackdrop"></div>
  <div class="tour-popover" role="dialog" aria-modal="true" aria-labelledby="tourTitle" id="tourPopover">
    <div class="tour-popover-arrow" aria-hidden="true"></div>
    <div class="tour-header">
      <span class="tour-tag">${ICONS.target} <span>${esc(t("tourNoticeBadge"))}</span></span>
    </div>
    <h3 class="tour-title" id="tourTitle">${esc(title)}</h3>
    <p class="tour-body">${esc(body)}</p>
    <div class="tour-actions">
      <button class="btn btn-primary btn-small" id="tourViewBtn" type="button">
        ${ICONS.fileText}
        <span>${esc(t("tourNoticeCtaView"))}</span>
      </button>
      <button class="btn btn-ghost btn-small" id="tourDismissBtn" type="button">
        <span>${esc(t("tourNoticeCtaDismiss"))}</span>
      </button>
    </div>
  </div>`;
}

function bindTour() {
  const backdrop = $("#tourBackdrop");
  const viewBtn = $("#tourViewBtn");
  const dismissBtn = $("#tourDismissBtn");

  const dismiss = () => {
    localStorage.setItem("whatwhen_schedule_tour_seen_v3", "true");
    tourState.isOpen = false;
    renderAll();
  };

  if (backdrop) backdrop.addEventListener("click", dismiss);
  if (dismissBtn) dismissBtn.addEventListener("click", dismiss);

  if (viewBtn) {
    viewBtn.addEventListener("click", () => {
      localStorage.setItem("whatwhen_schedule_tour_seen_v3", "true");
      tourState.isOpen = false;
      schedModalState.isOpen = true;
      renderAll();
    });
  }
}

/* -------------------------------------------------------------- Render */
function renderAll() {
  closeHelpPopover();
  renderChrome();
  const app = $("#app");
  if (state.step === "catalog" && state.maxCourses === 0) computeLimit();

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

  // Handle Official Schedule Modal
  const existingSchedModal = $("#scheduleModal");
  if (schedModalState.isOpen) {
    if (!existingSchedModal) {
      document.body.insertAdjacentHTML("beforeend", renderScheduleModal());
      bindScheduleModal();
    }
  } else {
    if (existingSchedModal) existingSchedModal.remove();
  }

  // Handle Attendance Preferences Modal
  const existingAttModal = $("#attendanceModal");
  if (attendanceModalState.isOpen) {
    if (!existingAttModal) {
      document.body.insertAdjacentHTML("beforeend", renderAttendanceModal());
      bindAttendanceModal();
    }
  } else {
    if (existingAttModal) existingAttModal.remove();
  }

  // Handle First-Visit Tour Spotlight
  const existingTour = $("#tourPopover");
  const existingBackdrop = $("#tourBackdrop");
  if (tourState.isOpen) {
    if (!existingTour) {
      document.body.insertAdjacentHTML("beforeend", renderTourPopover());
      bindTour();
    }
  } else {
    if (existingTour) existingTour.remove();
    if (existingBackdrop) existingBackdrop.remove();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Analytics !== "undefined") {
    Analytics.init();
  }
  initHelpPopovers();
  renderAll();
});
