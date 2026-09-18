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

      course.lectures.forEach((lec) => {
        for (let s = lec.slots[0]; s <= lec.slots[1]; s++) {
          add({
            kind: "lecture", courseIdx: idx, course,
            day: lec.day, slot: s,
            place: lec.place, doctor: lec.doctor,
            first: s === lec.slots[0],
          });
        }
      });

      const pick = state.picks ? state.picks[idx] : null;
      if (pick != null && course.sections[pick]) {
        const sec = course.sections[pick];
        add({
          kind: "section", courseIdx: idx, course,
          day: sec.day, slot: sec.slot,
          place: sec.place, labels: sec.label, pick,
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

  /* ------------------------------------------------------ display helpers */
  sectionLabel(sec) {
    const day = DAYS.find((d) => d.key === sec.day);
    const slot = SLOTS.find((s) => s.n === sec.slot);
    return `${tr(day)} · ${t("slotWord")} ${slot.n} (${slot.long}) · ${sec.place} · ${sec.label.join(", ")}`;
  },

  /* ------------------------------------------------------------- PNG export */
  async exportPNG(mode) {
    await document.fonts.ready;
    const model = Timetable.build(state);
    if (!model.placements.length) { window.alert(t("emptyGrid")); return; }

    const lang = state.lang;
    const rtl = lang === "ar";
    const F = rtl ? '"IBM Plex Sans Arabic", Tahoma, sans-serif'
                  : 'Inter, "Segoe UI", sans-serif';

    /* Grid axes — same orientation as the on-screen table:
       rows = days, columns = Slot 1..7 (both times in the header). */
    const days  = mode === "full" ? DAYS  : DAYS.filter((d) => model.placements.some((p) => p.day === d.key));
    const slots = mode === "full" ? SLOTS : SLOTS.filter((s) => model.placements.some((p) => p.slot === s.n));

    const C = {
      border: "#cbd5e1", head: "#f1f5f9", text: "#1e293b", muted: "#64748b",
      accent: "#0f766e",
      danger: "#dc2626", dangerBg: "#fee2e2",
      warn: "#d97706", warnBg: "#fef3c7",
      faculty: "#94a3b8",
    };

    const dayW = 96, colW = 192, pad = 9, lineH = 13;

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

    /* each placement -> ordered [{txt,font,color}] (pre-wrapped) */
    const blocksFor = (p) => {
      const clashColor = p.conflict === "lecture" ? C.danger : C.warn;
      const base = p.conflict ? clashColor : null;
      const w = (txt, font, color) =>
        wrap(txt, font, colW - pad * 2 - 10).map((l) => ({ txt: l, font, color: base || color }));

      const code = p.course.code ? p.course.code + " " : "";
      if (p.kind === "section") {
        return [
          ...w(`${t("sectionWord")} ${p.labels.join(", ")}`, `700 10px ${F}`, C.accent),
          ...w((code + p.course.name).trim(), `600 11px ${F}`, C.text),
          ...w(p.place, `10px ${F}`, C.muted),
        ];
      }
      if (!p.first) {
        return [
          ...w(`${t("lectureWord")} · ${t("continuation")}`, `700 10px ${F}`, C.accent),
          ...w((code + p.course.name).trim(), `600 11px ${F}`, C.text),
        ];
      }
      const b = [
        ...w(t("lectureWord"), `700 10px ${F}`, C.accent),
        ...w((code + p.course.name).trim(), `600 11px ${F}`, C.text),
        ...w(p.place, `10px ${F}`, C.muted),
      ];
      if (p.doctor) b.push(...w(p.doctor, `10px ${F}`, C.muted));
      return b;
    };

    /* cell content map + row heights (tallest cell wins) */
    const cellBlocks = {};
    const rowH = days.map((d) => {
      let max = 30;
      slots.forEach((sl) => {
        const items = model.cells[`${d.key}:${sl.n}`] || [];
        const blocks = items.flatMap(blocksFor);
        cellBlocks[`${d.key}:${sl.n}`] = blocks;
        const h = blocks.length
          ? blocks.length * lineH + Math.max(0, items.length - 1) * 4 + pad * 2 + 4
          : (FACULTY_ACTIVITY.day === d.key && FACULTY_ACTIVITY.slot === sl.n ? 30 : 0);
        max = Math.max(max, h);
      });
      return Math.max(34, max);
    });

    const titleH = 58, headH = 42, footH = 46;
    const W = dayW + slots.length * colW + 2;
    const H = titleH + headH + rowH.reduce((a, b) => a + b, 0) + footH + 2;

    const cv = document.createElement("canvas");
    cv.width = W * 2; cv.height = H * 2;
    const ctx = cv.getContext("2d");
    ctx.scale(2, 2);
    ctx.direction = rtl ? "rtl" : "ltr";

    const txt = (text, x, y, { font = `11px ${F}`, color = C.text, align = null } = {}) => {
      ctx.font = font; ctx.fillStyle = color;
      ctx.textAlign = align || (rtl ? "right" : "left");
      ctx.fillText(text, x, y);
    };
    /* x-origin for a cell's text, honoring direction */
    const tx = (px) => (rtl ? px + colW - pad - 5 : px + pad + 5);

    /* ---- 2. frame + title ---- */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    txt(tr(APP_CONFIG.toolName), W / 2, 27, { font: `700 16px ${F}`, align: "center" });
    txt(tr(APP_CONFIG.academicTerm), W / 2, 45, { font: `11px ${F}`, color: C.muted, align: "center" });

    /* ---- 3. header row: corner + Slot 1..7 with both times ---- */
    let y = titleH;
    ctx.fillStyle = C.head;
    ctx.fillRect(1, y, W - 2, headH);
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.beginPath();
    ctx.moveTo(1, y + headH + 0.5); ctx.lineTo(W - 1, y + headH + 0.5);
    ctx.strokeStyle = C.border; ctx.stroke();

    txt(t("dayWord"), dayW / 2, y + headH / 2 + 4, { font: `700 11px ${F}`, color: C.muted, align: "center" });

    slots.forEach((sl, i) => {
      const px = dayW + i * colW;
      ctx.strokeStyle = C.border;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, y); ctx.lineTo(px + 0.5, y + headH);
      ctx.stroke();
      const cx = px + colW / 2;
      txt(`${t("slotWord")} ${sl.n}`, cx, y + 17, { font: `700 11px ${F}`, align: "center" });
      txt(sl.short, cx, y + 30, { font: `9px ${F}`, color: C.muted, align: "center" });
      txt(sl.long, cx, y + 40, { font: `9px ${F}`, color: C.muted, align: "center" });
    });

    /* ---- 4. day rows ---- */
    let ry = y + headH;
    days.forEach((d, r) => {
      const rh = rowH[r];

      /* day label cell */
      ctx.fillStyle = C.head;
      ctx.fillRect(1, ry + 1, dayW - 1, rh - 1);
      txt(tr(d), dayW / 2, ry + rh / 2 + 4, { font: `700 12px ${F}`, align: "center" });

      slots.forEach((sl, i) => {
        const px = dayW + i * colW;
        const items = model.cells[`${d.key}:${sl.n}`] || [];
        const blocks = cellBlocks[`${d.key}:${sl.n}`] || [];

        /* cell frame */
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(px + 1, ry + 1, colW - 1, rh - 1);

        if (items.length) {
          const isLec = items.every((p) => p.kind === "lecture");
          ctx.fillStyle = isLec ? C.dangerBg : C.warnBg;
          ctx.fillRect(px + 1, ry + 1, colW - 1, rh - 1);
          ctx.fillStyle = isLec ? C.danger : C.warn;
          ctx.fillRect(rtl ? px + colW - 4 : px + 1, ry + 1, 3, rh - 1);
        } else if (FACULTY_ACTIVITY.day === d.key && FACULTY_ACTIVITY.slot === sl.n) {
          txt(tr(FACULTY_ACTIVITY.label), px + colW / 2, ry + rh / 2 + 3,
              { font: `italic 9px ${F}`, color: C.faculty, align: "center" });
        }

        /* cell borders */
        ctx.strokeStyle = C.border;
        ctx.beginPath();
        ctx.moveTo(px + 0.5, ry); ctx.lineTo(px + 0.5, ry + rh);
        ctx.moveTo(px, ry + rh + 0.5); ctx.lineTo(px + colW, ry + rh + 0.5);
        ctx.stroke();

        /* text, with a small gap between stacked placements */
        let ty = ry + pad + 9;
        let prevPlacementEnd = 0, drawn = 0;
        items.forEach((p) => {
          const n = blocksFor(p).length;
          if (drawn > 0) ty += 4;
          blocks.slice(prevPlacementEnd, prevPlacementEnd + n).forEach((l) => {
            txt(l.txt, tx(px), ty, { font: l.font, color: l.color });
            ty += lineH;
          });
          prevPlacementEnd += n;
          drawn++;
        });
      });

      /* day-column separator */
      ctx.strokeStyle = C.border;
      ctx.beginPath();
      ctx.moveTo(dayW + 0.5, ry); ctx.lineTo(dayW + 0.5, ry + rh);
      ctx.stroke();

      ry += rh;
    });

    /* ---- 5. footer ---- */
    const usedH = state.selected.length * APP_CONFIG.creditHoursPerCourse +
      (state.project ? APP_CONFIG.project.creditHours : 0);
    txt(`${state.dept} · ${usedH}/${state.hoursLimit}h · ${tr(APP_CONFIG.academicTerm)}`,
        W / 2, H - footH + 16, { font: `10px ${F}`, color: C.muted, align: "center" });
    txt(t("footerNote"), W / 2, H - footH + 32, { font: `italic 9px ${F}`, color: C.muted, align: "center" });

    /* ---- 6. download ---- */
    cv.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `what-when-${mode}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  },
};
