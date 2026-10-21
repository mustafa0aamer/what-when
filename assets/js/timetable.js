/* ============================================================================
 * What When — TIMETABLE ENGINE
 *   Timetable.build(state)  -> { cells, placements, conflicts }
 *   Timetable.sectionLabel  -> one-line label for a section option
 *   Timetable.exportPNG     -> transposed grid drawn on a 2x <canvas> -> PNG
 *
 * Conflict rules (per spec):
 *   lecture vs lecture        -> type "lecture" (RED, unfixable by sections)
 *   anything involving a lab  -> type "section" (YELLOW, fixable by re-picking)
 * ========================================================================== */

"use strict";

const Timetable = {

  /* ------------------------------------------------ resolve course schedule by cohort */
  getCourseSchedule(course, idx, st) {
    if (!course) return { lectures: [], sections: [] };
    const currentState = st || (typeof state !== "undefined" ? state : { level: 1, group: "A" });
    const isSenior = (currentState.level || 1) >= 3;
    const currentGroup = currentState.group || "A";

    if (!course.hasGroups || !course.groups) {
      return {
        lectures: course.lectures || [],
        sections: (course.sections || []).map((s, i) => ({ ...s, originalIdx: i, group: null })),
        hasGroups: false,
        activeGroup: null,
        isSeniorFlex: false,
      };
    }

    // Course has groups (A & B)
    if (!isSenior) {
      // Level 1 or 2: Student is assigned to a specific group (A or B)
      const grpData = course.groups[currentGroup] || course.groups.A;
      return {
        lectures: grpData.lectures || [],
        sections: (grpData.sections || []).map((s, i) => ({ ...s, originalIdx: i, group: currentGroup })),
        hasGroups: true,
        activeGroup: currentGroup,
        isSeniorFlex: false,
      };
    }

    // Level 3 or 4 (Senior): Can pick any section and lecture from ANY group!
    const secA = (course.groups.A?.sections || []).map((s, i) => ({ ...s, originalIdx: i, group: "A", unifiedIdx: i }));
    const secB = (course.groups.B?.sections || []).map((s, i) => ({ ...s, originalIdx: i, group: "B", unifiedIdx: secA.length + i }));
    const unifiedSections = [...secA, ...secB];

    // Determine lecture group:
    // 1. Explicit override in lecturePicks if selected
    // 2. Otherwise match group of the selected section
    // 3. Fallback to Group A
    let lecGroup = (currentState.lecturePicks && currentState.lecturePicks[idx]) || null;
    if (!lecGroup) {
      const pick = currentState.picks ? currentState.picks[idx] : null;
      if (pick != null && unifiedSections[pick]) {
        lecGroup = unifiedSections[pick].group;
      } else {
        lecGroup = "A";
      }
    }

    const lectures = (course.groups[lecGroup] || course.groups.A).lectures || [];

    return {
      lectures,
      sections: unifiedSections,
      hasGroups: true,
      activeGroup: lecGroup,
      isSeniorFlex: true,
    };
  },

  /* ------------------------------------------------------- build the model */
  build(state) {
    const cells = {};        // "sat:3" -> [placement, ...]
    const placements = [];

    const add = (p) => {
      (cells[p.day + ":" + p.slot] ??= []).push(p);
      placements.push(p);
    };

    for (const idx of state.selected) {
      const course = COURSES[idx];
      if (!course) continue;

      const sched = this.getCourseSchedule(course, idx, state);
      const att = (state.attendance && state.attendance[idx]) || {};
      const lecAtt = att.lecture || "mandatory";
      const secAtt = att.section || "mandatory";

      sched.lectures.forEach((lec) => {
        const endSlot = lec.slots[1] ?? lec.slots[0];
        for (let s = lec.slots[0]; s <= endSlot; s++) {
          add({
            kind: "lecture", courseIdx: idx, course,
            day: lec.day, slot: s,
            place: lec.place, doctor: lec.doctor,
            group: sched.hasGroups ? (sched.activeGroup || lec.group) : null,
            first: s === lec.slots[0],
            attendance: lecAtt,
          });
        }
      });

      const pick = state.picks ? state.picks[idx] : null;
      const isPinned = Boolean(state.pinnedSections && state.pinnedSections[idx] && pick != null);
      if (pick != null && sched.sections[pick]) {
        const sec = sched.sections[pick];
        add({
          kind: "section", courseIdx: idx, course,
          day: sec.day, slot: sec.slot,
          place: sec.place, labels: sec.label, pick,
          group: sec.group || null,
          attendance: secAtt,
          pinned: isPinned,
        });
      }
    }

    /* conflicts: any cell with more than one placement */
    const conflicts = [];
    for (const key in cells) {
      const items = cells[key];
      if (items.length < 2) continue;
      const type = items.some((p) => p.kind === "section") ? "section" : "lecture";
      items.forEach((p) => { p.conflict = type; });
      const [day, slot] = key.split(":");
      conflicts.push({ day, slot: Number(slot), type, items });
    }
    const dayOrder = (k) => DAYS.findIndex((d) => d.key === k);
    conflicts.sort((a, b) => dayOrder(a.day) - dayOrder(b.day) || a.slot - b.slot);

    return { cells, placements, conflicts };
  },

  /* ------------------------------------ Real-time Conflict Check Helpers */
  getOccupiedMap(st, excludeCourseIdx = null, excludeSectionOfCourseIdx = null) {
    const map = new Map(); // "day:slot" -> [{ courseIdx, course, kind }]
    if (!st || !Array.isArray(st.selected)) return map;

    const pushSlot = (day, slot, info) => {
      const key = `${day}:${slot}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(info);
    };

    for (const idx of st.selected) {
      const course = COURSES[idx];
      if (!course) continue;
      const sched = this.getCourseSchedule(course, idx, st);

      if (idx !== excludeCourseIdx) {
        (sched.lectures || []).forEach((lec) => {
          const endSlot = lec.slots[1] ?? lec.slots[0];
          for (let s = lec.slots[0]; s <= endSlot; s++) {
            pushSlot(lec.day, s, { courseIdx: idx, course, kind: "lecture" });
          }
        });
      }

      if (idx !== excludeCourseIdx && idx !== excludeSectionOfCourseIdx) {
        const pick = st.picks ? st.picks[idx] : null;
        if (pick != null && sched.sections[pick]) {
          const sec = sched.sections[pick];
          pushSlot(sec.day, sec.slot, { courseIdx: idx, course, kind: "section" });
        }
      }
    }
    return map;
  },

  /* Check if adding/having courseIdx causes an unavoidable lecture conflict with other selected courses */
  getCourseConflictWithState(courseIdx, st) {
    const course = COURSES[courseIdx];
    if (!course || !st) return { hasConflict: false, conflictingCourses: [], preferredSafeLecGroup: null };

    const occupied = this.getOccupiedMap(st, courseIdx, courseIdx);
    const sched = this.getCourseSchedule(course, courseIdx, st);

    const checkLecturesList = (lectures) => {
      const clashedMap = new Map();
      (lectures || []).forEach((lec) => {
        const endSlot = lec.slots[1] ?? lec.slots[0];
        for (let s = lec.slots[0]; s <= endSlot; s++) {
          const items = occupied.get(`${lec.day}:${s}`) || [];
          items.forEach((it) => {
            if (it.courseIdx !== courseIdx) {
              clashedMap.set(it.courseIdx, it.course);
            }
          });
        }
      });
      return Array.from(clashedMap.values());
    };

    if (sched.isSeniorFlex && course.hasGroups && course.groups) {
      const clashesA = checkLecturesList(course.groups.A?.lectures || []);
      const clashesB = checkLecturesList(course.groups.B?.lectures || []);
      if (clashesA.length === 0) {
        return { hasConflict: false, conflictingCourses: [], preferredSafeLecGroup: "A" };
      }
      if (clashesB.length === 0) {
        return { hasConflict: false, conflictingCourses: [], preferredSafeLecGroup: "B" };
      }
      // Both A and B clash with existing registered courses
      const combined = new Map();
      [...clashesA, ...clashesB].forEach((c) => combined.set(c.code || tr(c.name), c));
      return {
        hasConflict: true,
        conflictingCourses: Array.from(combined.values()),
        preferredSafeLecGroup: null,
      };
    }

    const clashed = checkLecturesList(sched.lectures || []);
    return {
      hasConflict: clashed.length > 0,
      conflictingCourses: clashed,
      preferredSafeLecGroup: null,
    };
  },

  /* Check if a specific lecture group (A or B) for a Senior Flex course conflicts with current schedule */
  getLectureGroupConflictWithState(courseIdx, groupKey, st) {
    const course = COURSES[courseIdx];
    if (!course || !course.hasGroups || !course.groups) {
      return { hasConflict: false, conflictingCourses: [] };
    }
    const occupied = this.getOccupiedMap(st, courseIdx, null);
    const lectures = course.groups[groupKey]?.lectures || [];
    const clashedMap = new Map();

    lectures.forEach((lec) => {
      const endSlot = lec.slots[1] ?? lec.slots[0];
      for (let s = lec.slots[0]; s <= endSlot; s++) {
        const items = occupied.get(`${lec.day}:${s}`) || [];
        items.forEach((it) => {
          clashedMap.set(it.courseIdx, it.course);
        });
      }
    });

    return {
      hasConflict: clashedMap.size > 0,
      conflictingCourses: Array.from(clashedMap.values()),
    };
  },

  /* Check if picking section secIdx for courseIdx conflicts with current lectures or other chosen sections */
  getSectionConflictWithState(courseIdx, secIdx, st) {
    const course = COURSES[courseIdx];
    if (!course || secIdx == null) return { hasConflict: false, conflictingCourses: [] };

    const sched = this.getCourseSchedule(course, courseIdx, st);
    const sec = sched.sections[secIdx];
    if (!sec) return { hasConflict: false, conflictingCourses: [] };

    // Occupied by all courses' lectures (including courseIdx's own lecture) and OTHER courses' picked sections
    const occupied = this.getOccupiedMap(st, null, courseIdx);
    const items = occupied.get(`${sec.day}:${sec.slot}`) || [];
    const clashedMap = new Map();
    items.forEach((it) => {
      clashedMap.set(it.courseIdx, it.course);
    });

    return {
      hasConflict: clashedMap.size > 0,
      conflictingCourses: Array.from(clashedMap.values()),
    };
  },

  /* ------------------------------------------------------ display helpers */
  sectionLabel(sec) {
    const day = DAYS.find((d) => d.key === sec.day);
    const slot = SLOTS.find((s) => s.n === sec.slot);
    const grpPrefix = sec.group ? `[${sec.group === "A" ? (typeof state !== "undefined" && state.lang === "ar" ? "مجموعة أ" : "Group A") : (typeof state !== "undefined" && state.lang === "ar" ? "مجموعة ب" : "Group B")}] ` : "";
    return `${grpPrefix}${tr(day)} · ${t("slotWord")} ${slot.n} (${slot.long}) · ${sec.place} · ${sec.label.join(", ")}`;
  },

  /* ------------------------------------------------------------- PNG export */
  async exportPNG(mode) {
    await document.fonts.ready;
    const model = Timetable.build(state);
    if (!model.placements.length) {
      if (typeof showToast === "function") showToast(t("emptyGrid"));
      return;
    }

    const lang = state.lang;
    const rtl = lang === "ar";
    const F = rtl ? '"IBM Plex Sans Arabic", Tahoma, sans-serif'
                  : 'Inter, "Segoe UI", sans-serif';

    /* Grid axes — same orientation as the on-screen table:
       rows = days, columns = Slot 1..7 (both times in the header). */
    const days  = mode === "full" ? DAYS  : DAYS.filter((d) => model.placements.some((p) => p.day === d.key));
    const slots = mode === "full" ? SLOTS : SLOTS.filter((s) => model.placements.some((p) => p.slot === s.n));

    const C = {
      canvasBg: "#f8fafc",
      tableBg: "#ffffff",
      zebraRow: "#f8fafc",
      border: "#cbd5e1",
      gridLine: "#e2e8f0",
      headBg: "#0f172a",
      headText: "#ffffff",
      headSub: "#94a3b8",
      dayHeadBg: "#f1f5f9",
      text: "#0f172a",
      muted: "#475569",
      subtle: "#64748b",
      // Semantic card palettes
      lecBg: "#f0fdfa",
      lecBorder: "#99f6e4",
      lecBar: "#0f766e",
      lecTitle: "#115e59",
      secBg: "#f0f9ff",
      secBorder: "#bae6fd",
      secBar: "#0284c7",
      secTitle: "#0369a1",
      warnBg: "#fffbeb",
      warnBorder: "#fcd34d",
      warnBar: "#d97706",
      warnTitle: "#b45309",
      dangerBg: "#fef2f2",
      dangerBorder: "#fca5a5",
      dangerBar: "#dc2626",
      dangerTitle: "#b91c1c",
      facultyBg: "#f8fafc",
      facultyText: "#94a3b8",
    };

    const outerPad = 20;
    const dayW = 104, colW = 206, cellPad = 7, cardPad = 7, lineH = 14, cardGap = 6;

    /* ---- 1. measure everything BEFORE choosing canvas size ---- */
    const measurer = document.createElement("canvas").getContext("2d");
    const wrap = (text, font, maxW) => {
      measurer.font = font;
      const out = [];
      let cur = "";
      for (const w of String(text).split(" ")) {
        const test = cur ? cur + " " + w : w;
        if (cur && measurer.measureText(test).width > maxW) { out.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) out.push(cur);
      return out.length ? out : [""];
    };

    const getPalette = (p) => {
      if (p.conflict === "lecture") {
        return { bg: C.dangerBg, border: C.dangerBorder, bar: C.dangerBar, badge: C.dangerTitle };
      }
      if (p.conflict === "section") {
        return { bg: C.warnBg, border: C.warnBorder, bar: C.warnBar, badge: C.warnTitle };
      }
      if (p.kind === "section") {
        return { bg: C.secBg, border: C.secBorder, bar: C.secBar, badge: C.secTitle };
      }
      return { bg: C.lecBg, border: C.lecBorder, bar: C.lecBar, badge: C.lecTitle };
    };

    const textMaxW = colW - (cellPad * 2) - (cardPad * 2) - 8;

    /* each placement -> card object with lines [{txt, font, color}] */
    const buildCard = (p) => {
      const pal = getPalette(p);
      const isSkip = p.attendance === "skip";
      const mainTextColor = isSkip ? C.subtle : C.text;
      const metaTextColor = isSkip ? C.headSub : C.muted;

      const w = (txt, font, color) =>
        wrap(txt, font, textMaxW).map((l) => ({ txt: l, font, color }));

      const code = p.course.code ? p.course.code + " · " : "";
      const courseName = tr(p.course.name);
      const attSuffix = p.attendance === "skip"
        ? ` · ${t("ttBadgeSkip")}`
        : p.attendance === "rare"
          ? ` · ${t("ttBadgeRare")}`
          : "";
      const pinSuffix = p.pinned ? ` · 📌 ${t("pinnedBadge")}` : "";
      const conflictSuffix = p.conflict ? ` · ⚠ ${state.allowConflicts ? t("ttConflictWaivedBadge") : (p.conflict === "lecture" ? t("conflictLecture") : t("conflictSection"))}` : "";

      const lines = [];
      if (p.kind === "section") {
        lines.push(...w(`${t("sectionWord")} ${p.labels.join(", ")}${pinSuffix}${attSuffix}${conflictSuffix}`, `700 10px ${F}`, pal.badge));
        lines.push(...w((code + courseName).trim(), `700 11.5px ${F}`, mainTextColor));
        lines.push(...w(p.place, `500 10px ${F}`, metaTextColor));
      } else if (!p.first) {
        lines.push(...w(`${t("lectureWord")} (${t("continuation")})${attSuffix}${conflictSuffix}`, `700 10px ${F}`, pal.badge));
        lines.push(...w((code + courseName).trim(), `700 11.5px ${F}`, mainTextColor));
        lines.push(...w(p.place, `500 10px ${F}`, metaTextColor));
      } else {
        lines.push(...w(`${t("lectureWord")}${attSuffix}${conflictSuffix}`, `700 10px ${F}`, pal.badge));
        lines.push(...w((code + courseName).trim(), `700 11.5px ${F}`, mainTextColor));
        const metaLine = p.doctor ? `${p.place} · ${p.doctor}` : p.place;
        lines.push(...w(metaLine, `500 10px ${F}`, metaTextColor));
      }

      const cardH = lines.length * lineH + cardPad * 2 + 2;
      return { p, pal, isSkip, lines, cardH };
    };

    /* cell cards map + row heights (tallest cell wins) */
    const cellCards = {};
    const rowH = days.map((d) => {
      let max = 46;
      slots.forEach((sl) => {
        const items = model.cells[`${d.key}:${sl.n}`] || [];
        const cards = items.map(buildCard);
        cellCards[`${d.key}:${sl.n}`] = cards;
        const totalCardsH = cards.reduce((sum, c) => sum + c.cardH, 0) + Math.max(0, cards.length - 1) * cardGap;
        const h = cards.length
          ? totalCardsH + cellPad * 2
          : (FACULTY_ACTIVITY.day === d.key && FACULTY_ACTIVITY.slot === sl.n ? 44 : 0);
        max = Math.max(max, h);
      });
      return Math.max(50, max);
    });

    const titleH = 70, headH = 48, footH = 58;
    const tableW = dayW + slots.length * colW;
    const tableH = headH + rowH.reduce((a, b) => a + b, 0);
    const W = tableW + outerPad * 2;
    const H = titleH + tableH + footH + outerPad;

    const cv = document.createElement("canvas");
    cv.width = W * 2; cv.height = H * 2;
    const ctx = cv.getContext("2d");
    ctx.scale(2, 2);
    ctx.direction = rtl ? "rtl" : "ltr";

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const txt = (text, x, y, { font = `11px ${F}`, color = C.text, align = null } = {}) => {
      ctx.font = font; ctx.fillStyle = color;
      ctx.textAlign = align || (rtl ? "right" : "left");
      ctx.fillText(text, x, y);
    };

    /* ---- 2. Canvas background & Header Banner ---- */
    ctx.fillStyle = C.canvasBg;
    ctx.fillRect(0, 0, W, H);

    const usedH = state.selected.reduce((sum, idx) => {
      const c = COURSES[idx];
      return sum + (c && typeof c.creditHours === "number" ? c.creditHours : 3);
    }, 0) + (state.project ? APP_CONFIG.project.creditHours : 0);
    const deptDisplay = state.dept === "GEN"
      ? (state.isNewcomer ? tr({ ar: "مستجد", en: "Freshman" }) : tr({ ar: "عام", en: "General" }))
      : state.dept;
    const levelDisplay = t("levelTag").replace("{n}", state.level || 1);
    const conflictMeta = state.allowConflicts ? ` · ⚠ ${t("conflictSummaryOn")}` : "";

    txt(tr(APP_CONFIG.toolName), W / 2, 30, { font: `700 18px ${F}`, color: C.text, align: "center" });
    txt(`${tr(APP_CONFIG.academicTerm)}  |  ${levelDisplay} · ${deptDisplay} · ${usedH}/${state.hoursLimit} ${t("creditHoursUnitShort")}${conflictMeta}`,
        W / 2, 52, { font: `600 11.5px ${F}`, color: C.muted, align: "center" });

    /* ---- 3. Table Outer Shadow & Header Row ---- */
    const tx0 = outerPad;
    const ty0 = titleH;

    ctx.fillStyle = C.tableBg;
    ctx.fillRect(tx0, ty0, tableW, tableH);

    // Table header dark bar
    ctx.fillStyle = C.headBg;
    ctx.fillRect(tx0, ty0, tableW, headH);

    txt(t("dayWord"), tx0 + dayW / 2, ty0 + headH / 2 + 4, { font: `700 12px ${F}`, color: C.headText, align: "center" });

    slots.forEach((sl, i) => {
      const px = tx0 + dayW + i * colW;
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, ty0 + 6);
      ctx.lineTo(px + 0.5, ty0 + headH - 6);
      ctx.stroke();

      const cx = px + colW / 2;
      txt(`${t("slotWord")} ${sl.n}`, cx, ty0 + 18, { font: `700 11.5px ${F}`, color: C.headText, align: "center" });
      txt(sl.short, cx, ty0 + 33, { font: `600 9.5px ${F}`, color: "#cbd5e1", align: "center" });
      txt(sl.long, cx, ty0 + 44, { font: `500 9px ${F}`, color: C.headSub, align: "center" });
    });

    /* ---- 4. Day Rows & Inner Cards ---- */
    let ry = ty0 + headH;
    days.forEach((d, r) => {
      const rh = rowH[r];
      const rowBg = r % 2 === 1 ? C.zebraRow : C.tableBg;

      /* Day column cell */
      ctx.fillStyle = C.dayHeadBg;
      ctx.fillRect(tx0, ry, dayW, rh);
      txt(tr(d), tx0 + dayW / 2, ry + rh / 2 + 4, { font: `700 12.5px ${F}`, color: C.text, align: "center" });

      slots.forEach((sl, i) => {
        const px = tx0 + dayW + i * colW;
        const cards = cellCards[`${d.key}:${sl.n}`] || [];

        /* Base cell fill */
        ctx.fillStyle = rowBg;
        ctx.fillRect(px, ry, colW, rh);

        if (cards.length > 0) {
          let cy = ry + cellPad;
          cards.forEach((card) => {
            const cx = px + cellPad;
            const cw = colW - cellPad * 2;
            const ch = card.cardH;

            // Card fill
            roundRect(cx, cy, cw, ch, 6);
            ctx.fillStyle = card.pal.bg;
            ctx.fill();

            // Card border (dashed if skip)
            ctx.save();
            if (card.isSkip) ctx.setLineDash([4, 3]);
            ctx.strokeStyle = card.pal.border;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();

            // Start-edge vertical accent bar
            const barW = 4;
            const barX = rtl ? (cx + cw - barW) : cx;
            ctx.fillStyle = card.pal.bar;
            ctx.fillRect(barX, cy + 2, barW, ch - 4);

            // Card lines
            const textStartX = rtl ? (cx + cw - cardPad - 6) : (cx + cardPad + 6);
            let ly = cy + cardPad + 10;
            card.lines.forEach((l) => {
              txt(l.txt, textStartX, ly, { font: l.font, color: l.color });
              ly += lineH;
            });

            cy += ch + cardGap;
          });
        } else if (FACULTY_ACTIVITY.day === d.key && FACULTY_ACTIVITY.slot === sl.n) {
          txt(tr(FACULTY_ACTIVITY.label), px + colW / 2, ry + rh / 2 + 4,
              { font: `italic 10px ${F}`, color: C.facultyText, align: "center" });
        }

        /* Cell grid lines */
        ctx.strokeStyle = C.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 0.5, ry); ctx.lineTo(px + 0.5, ry + rh);
        ctx.moveTo(px, ry + rh + 0.5); ctx.lineTo(px + colW, ry + rh + 0.5);
        ctx.stroke();
      });

      /* Day-column separator & row bottom line */
      ctx.strokeStyle = C.border;
      ctx.beginPath();
      ctx.moveTo(tx0 + dayW + 0.5, ry); ctx.lineTo(tx0 + dayW + 0.5, ry + rh);
      ctx.moveTo(tx0, ry + rh + 0.5); ctx.lineTo(tx0 + dayW, ry + rh + 0.5);
      ctx.stroke();

      ry += rh;
    });

    /* Outer table frame */
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx0 + 0.5, ty0 + 0.5, tableW - 1, tableH - 1);

    /* ---- 5. Legend & Footer ---- */
    const footY = ty0 + tableH + 22;
    const legendItems = [
      { label: t("legendLecture"), bg: C.lecBg, border: C.lecBorder, bar: C.lecBar },
      { label: t("legendSection"), bg: C.secBg, border: C.secBorder, bar: C.secBar },
      { label: t("legendConflict"), bg: C.warnBg, border: C.warnBorder, bar: C.dangerBar },
    ];
    const itemSpacing = 125;
    const totalLegendW = legendItems.length * itemSpacing;
    let lx = (W - totalLegendW) / 2 + 20;

    legendItems.forEach((item) => {
      ctx.fillStyle = item.bg;
      ctx.strokeStyle = item.border;
      ctx.lineWidth = 1;
      roundRect(lx, footY - 10, 14, 14, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = item.bar;
      ctx.fillRect(lx, footY - 10, 3, 14);
      txt(item.label, lx + 20, footY + 1, { font: `600 10.5px ${F}`, color: C.muted, align: "left" });
      lx += itemSpacing;
    });

    txt(t("footerNote"), W / 2, footY + 24, { font: `italic 9.5px ${F}`, color: C.subtle, align: "center" });

    /* ---- 6. Download ---- */
    cv.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `what-when-${mode}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  },
};
