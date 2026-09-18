/* ============================================================================
 * What When — TIMETABLE ENGINE (Phase 2)
 * Pure logic shared by the on-screen grid and the PNG exporter.
 *   Timetable.build(state)  -> { cells, placements, conflicts }
 *   Timetable.sectionLabel  -> one-line Arabic/English label for a section
 *   Timetable.exportPNG     -> renders the grid to a <canvas> and downloads PNG
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
    const F = lang === "ar"
      ? '"IBM Plex Sans Arabic", Tahoma, sans-serif'
      : 'Inter, "Segoe UI", sans-serif';

    const days  = mode === "full" ? DAYS  : DAYS.filter((d) => model.placements.some((p) => p.day === d.key));
    const slots = mode === "full" ? SLOTS : SLOTS.filter((s) => model.placements.some((p) => p.slot === s.n));

    const C = {
      border: "#e2e8f0", head: "#f1f5f9", text: "#1e293b", muted: "#64748b",
      accent: "#0f766e", accentSoft: "#ecfdf9",
      danger: "#dc2626", dangerBg: "#fef2f2",
      warn: "#d97706", warnBg: "#fffbeb", faculty: "#cbd5e1",
    };

    const labelW = 100, colW = 180, pad = 8;
    const titleH = 58, colHeadH = 32, footH = 44;

    /* -- text wrapping helper -- */
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

    /* -- the lines each placement draws -- */
    const linesFor = (p) => {
      const code = p.course.code || "";
      if (p.kind === "section") {
        return [
          { txt: `${t("sectionWord")} ${p.labels.join(", ")}`, font: `700 10px ${F}`, color: C.accent },
          { txt: `${code} ${p.course.name}`.trim(), font: `600 11px ${F}`, color: C.text },
          { txt: p.place, font: `10px ${F}`, color: C.muted },
        ];
      }
      if (!p.first) {
        return [
          { txt: `${t("lectureWord")} · ${t("continuation")}`, font: `700 10px ${F}`, color: C.accent },
          { txt: `${code} ${p.course.name}`.trim(), font: `600 11px ${F}`, color: C.text },
        ];
      }
      const lines = [
        { txt: t("lectureWord"), font: `700 10px ${F}`, color: C.accent },
        { txt: `${code} ${p.course.name}`.trim(), font: `600 11px ${F}`, color: C.text },
        { txt: p.place, font: `10px ${F}`, color: C.muted },
      ];
      if (p.doctor) lines.push({ txt: p.doctor, font: `10px ${F}`, color: C.muted });
      return lines;
    };

    /* -- row heights: tallest cell wins -- */
    const rowH = slots.map((sl) => {
      let maxLines = 1;
      days.forEach((d) => {
        const items = model.cells[`${d.key}:${sl.n}`] || [];
        let n = 0;
        items.forEach((p) => linesFor(p).forEach((l) => { n += wrap(l.txt, l.font, colW - pad * 2).length; }));
        maxLines = Math.max(maxLines, n);
      });
      return Math.max(40, maxLines * 13 + pad * 2 + 6);
    });

    const W = labelW + days.length * colW + 2;
    const H = titleH + colHeadH + rowH.reduce((a, b) => a + b, 0) + footH + 2;
    const cv = document.createElement("canvas");
    cv.width = W * 2; cv.height = H * 2;           // 2x for crisp output
    const ctx = cv.getContext("2d");
    ctx.scale(2, 2);

    const rtl = lang === "ar";
    const alignX = (x) => (rtl ? W - x : x);       // logical -> physical

    /* -- frame + title -- */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = rtl ? "right" : "left";
    ctx.direction = rtl ? "rtl" : "ltr";

    ctx.fillStyle = C.text;
    ctx.font = `700 16px ${F}`;
    ctx.textAlign = "center";
    ctx.fillText(tr(APP_CONFIG.toolName), W / 2, 26);
    ctx.fillStyle = C.muted;
    ctx.font = `11px ${F}`;
    ctx.fillText(tr(APP_CONFIG.academicTerm), W / 2, 44);
    ctx.textAlign = rtl ? "right" : "left";

    /* -- column headers -- */
    let y = titleH;
    ctx.fillStyle = C.head;
    ctx.fillRect(1, y, W - 2, colHeadH);
    ctx.strokeStyle = C.border;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.fillStyle = C.muted;
    ctx.font = `700 10px ${F}`;
    ctx.fillText(t("slotWord"), alignX(labelW / 2 + (rtl ? 0 : 0)), y + 20);
    days.forEach((d, i) => {
      const cx = labelW + i * colW + colW / 2;
      ctx.fillStyle = C.text;
      ctx.font = `700 12px ${F}`;
      ctx.textAlign = "center";
      ctx.fillText(tr(d), alignX(cx), y + 21);
      ctx.textAlign = rtl ? "right" : "left";
    });

    /* -- rows -- */
    slots.forEach((sl, r) => {
      const ry = y + colHeadH + rowH.slice(0, r).reduce((a, b) => a + b, 0);
      const rh = rowH[r];

      ctx.fillStyle = C.head;
      ctx.fillRect(1, ry + 1, labelW - 1, rh - 1);
      ctx.fillStyle = C.text;
      ctx.font = `700 11px ${F}`;
      ctx.textAlign = "center";
      ctx.fillText(`${t("slotWord")} ${sl.n}`, alignX(labelW / 2), ry + rh / 2 - 2);
      ctx.fillStyle = C.muted;
      ctx.font = `9px ${F}`;
      ctx.fillText(sl.short, alignX(labelW / 2), ry + rh / 2 + 11);
      ctx.fillText(sl.long, alignX(labelW / 2), ry + rh / 2 + 22);
      ctx.textAlign = rtl ? "right" : "left";

      days.forEach((d, i) => {
        const px = labelW + i * colW;
        const items = model.cells[`${d.key}:${sl.n}`] || [];

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(px + 1, ry + 1, colW - 1, rh - 1);

        if (items.length) {
          const isLec = items.every((p) => p.kind === "lecture");
          ctx.fillStyle = isLec ? C.dangerBg : C.warnBg;
          ctx.fillRect(px + 1, ry + 1, colW - 1, rh - 1);
          ctx.fillStyle = isLec ? C.danger : C.warn;
          ctx.fillRect(rtl ? px + colW - 4 : px + 1, ry + 1, 3, rh - 1);
        } else if (FACULTY_ACTIVITY.day === d.key && FACULTY_ACTIVITY.slot === sl.n) {
          ctx.fillStyle = C.faculty;
          ctx.font = `italic 9px ${F}`;
          ctx.textAlign = "center";
          ctx.fillText(tr(FACULTY_ACTIVITY.label), alignX(px + colW / 2), ry + rh / 2 + 3);
          ctx.textAlign = rtl ? "right" : "left";
        }

        let ty = ry + pad + 9;
        items.forEach((p) => {
          linesFor(p).forEach((l) => {
            const color = p.conflict
              ? (p.conflict === "lecture" ? C.danger : C.warn)
              : l.color;
            wrap(l.txt, l.font, colW - pad * 2 - 6).forEach((line) => {
              ctx.font = l.font;
              ctx.fillStyle = color;
              ctx.fillText(line, alignX(rtl ? px + colW - pad - 6 : px + pad + 6), ty);
              ty += 13;
            });
          });
          ty += 3;
        });
      });
    });

    /* -- footer -- */
    const fy = H - footH + 4;
    const usedHours = state.selected.length * APP_CONFIG.creditHoursPerCourse +
      (state.project ? APP_CONFIG.project.creditHours : 0);
    ctx.fillStyle = C.muted;
    ctx.font = `10px ${F}`;
    ctx.textAlign = "center";
    ctx.fillText(
      `${state.dept} · ${usedHours}/${state.hoursLimit}h · ${tr(APP_CONFIG.academicTerm)}`,
      W / 2, fy + 12
    );
    ctx.font = `italic 9px ${F}`;
    ctx.fillText(t("footerNote"), W / 2, fy + 28);
    ctx.textAlign = rtl ? "right" : "left";

    /* -- download -- */
    cv.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `what-when-timetable-${mode}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  },
};