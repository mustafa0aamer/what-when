/* ============================================================================
 * What When / هجدول — SCHEDULE OPTIMIZATION ENGINE (Operations Research Model)
 *
 * Mathematical Modeling:
 *   - Problem: Student Section Assignment & Timetabling Problem (CSP & COP)
 *   - Constants: Fixed lecture times & lecture halls for selected courses
 *   - Decision Variables: x_{i,j} in {0, 1} selecting section j for course i
 *   - Hard Constraints:
 *       1. Sum_j x_{i,j} = 1  for each course i (Exact Cover)
 *       2. No concurrent assignments at cell (day, slot) (No-clash)
 *   - Objectives (Scenarios):
 *       1. min_walking: Minimize transit distance between physical campus zones
 *       2. compact: Minimize idle gap hours between classes on the same day
 *       3. max_free_days: Minimize active university attendance days (maximize off days)
 *       4. early_bird: Prioritize morning slots, penalize afternoon/evening
 *       5. late_starter: Eliminate 8:00 AM slots, prioritize late start
 *       6. worst_case: Stress test (maximum idle gaps & maximum transit strain)
 *   - Infeasibility: Irreducible Inconsistent Subsystem (IIS) bottleneck detection
 * ========================================================================== */

"use strict";

const ScheduleOptimizer = {
  /* Campus Physical Zones */
  ZONES: {
    Z1: { id: "Z1", name: { ar: "مبنى الدراسات العليا للبحوث الإحصائية", en: "Graduate Studies (FSSR)" }, desc: "Hall 7, Hall 8" },
    Z2: { id: "Z2", name: { ar: "مبنى الكلية الرئيسي", en: "Main FCAI Building" }, desc: "Farag Hall, Shafei Hall, Labs 3, 5" },
    Z3: { id: "Z3", name: { ar: "المبنى الجديد ومعمل المكتبة", en: "New Building (NB) & Library" }, desc: "Labs 6, 7, 8, Library Lab" },
    Z4: { id: "Z4", name: { ar: "مجمع قاعات الامتحانات بالحرم الجامعي", en: "Central Exam Complex (Main Campus)" }, desc: "Exam Rooms 404, 408, 409, 410, 411 (~1.5 km)" },
    Z5: { id: "Z5", name: { ar: "مبنى بين السرايات", en: "Ben-ElSarayat Building" }, desc: "Ben-ElSarayat Labs 32, 35 (~1.1 km)" },
  },

  /* Distance & Walking Effort Matrix (in approximate minutes / strain units) */
  DISTANCE_MATRIX: {
    Z1: { Z1: 0,  Z2: 1,  Z3: 2,  Z4: 18, Z5: 14 },
    Z2: { Z1: 1,  Z2: 0,  Z3: 2,  Z4: 18, Z5: 14 },
    Z3: { Z1: 2,  Z2: 2,  Z3: 0,  Z4: 20, Z5: 15 },
    Z4: { Z1: 18, Z2: 18, Z3: 20, Z4: 0,  Z5: 8  },
    Z5: { Z1: 14, Z2: 14, Z3: 15, Z4: 8,  Z5: 0  },
  },

  /* Map room string to zone */
  getZone(place) {
    if (!place) return "Z2";
    const p = String(place).toLowerCase();
    if (p.includes("ben-elsarayat") || p.includes("ben el-sarayat") || p.includes("benelsarayat") || p.includes("32") || p.includes("35")) {
      return "Z5";
    }
    if (p.includes("exam") || p.includes("404") || p.includes("408") || p.includes("409") || p.includes("410") || p.includes("411")) {
      return "Z4";
    }
    if (p.includes("library") || p.includes("lab 6") || p.includes("lab 7") || p.includes("lab 8")) {
      return "Z3";
    }
    if (p.includes("hall 7") || p.includes("hall 8")) {
      return "Z1";
    }
    return "Z2";
  },

  /* Transit strain between two places given slot gap between them */
  getTransitCost(placeA, placeB, slotGap) {
    const zA = this.getZone(placeA);
    const zB = this.getZone(placeB);
    const baseMinutes = this.DISTANCE_MATRIX[zA][zB] ?? 0;
    if (baseMinutes === 0) return 0;

    // If back-to-back (slotGap === 0, only 15-min break) and distance >= 14 minutes:
    // This is a high-strain rush between distant locations!
    if (slotGap === 0 && baseMinutes >= 14) {
      return baseMinutes * 2.5; // heavy penalty
    }
    return baseMinutes;
  },

  /* Scenario Definitions */
  SCENARIOS: [
    {
      id: "min_walking",
      icon: "🚶",
      badge: "logistic",
      name: { ar: "أقل مجهود وتنقل بين المباني", en: "Minimal Campus Transit" },
      subtitle: { ar: "تقليل التنقلات البعيدة بين مجمع الامتحانات وبين السرايات والكلية", en: "Minimizes walking between distant venues" },
      desc: {
        ar: "يركز على إبقاء محاضراتك وسكاشنك في نفس المبنى وتجنب السفر بين الحرم ومبنى بين السرايات في نفس اليوم.",
        en: "Keeps your classes in the same zone and avoids stressful walks between Campus and Ben-ElSarayat.",
      },
    },
    {
      id: "compact",
      icon: "⚡",
      badge: "time",
      name: { ar: "أقل وقت فراغ (يوم مدمج)", en: "Compact Days (No Gaps)" },
      subtitle: { ar: "محاضرات وسكاشن متتالية دون فترات انتظار طويلة", en: "Back-to-back classes with minimal waiting" },
      desc: {
        ar: "يقلل الساعات الضائعة بين المحاضرات والسكاشن، لتنهي يومك الدراسي وتغادر الكلية في أقرب وقت.",
        en: "Eliminates idle waiting hours between classes so you can finish your day early and head home.",
      },
    },
    {
      id: "max_free_days",
      icon: "🏖️",
      badge: "days",
      name: { ar: "أقصى عدد أيام إجازة", en: "Maximum Days Off" },
      subtitle: { ar: "ضغط الجدول في أقل عدد من أيام الحضور الأسبوعية", en: "Compresses classes into fewer active days" },
      desc: {
        ar: "يجمع المواد في 3 أو 4 أيام حضور فقط، لمنحك أكبر عدد ممكن من الأيام الخالية تماماً من الدراسة.",
        en: "Packs your study load into the fewest days possible, giving you more free days during the week.",
      },
    },
    {
      id: "early_bird",
      icon: "🌅",
      badge: "schedule",
      name: { ar: "جدول صباحي (إنهاء مبكر)", en: "Early Bird (Morning Focus)" },
      subtitle: { ar: "تفضيل السكاشن المبكرة وتجنب فترات بعد الظهر والمساء", en: "Prefers morning slots and avoids late afternoons" },
      desc: {
        ar: "يختار السكاشن التي تبدأ مبكراً ويتجنب تماماً السلوتات المسائية (السلوت 5 و6 و7).",
        en: "Schedules sections in the morning so your afternoons remain free for projects and study.",
      },
    },
    {
      id: "late_starter",
      icon: "☕",
      badge: "schedule",
      name: { ar: "جدول مسائي (بدء متأخر)", en: "Late Starter (No 8 AMs)" },
      subtitle: { ar: "تجنب السلوت الأول (08:00 صباحاً) قدر الإمكان", en: "Avoids 8:00 AM slots as much as possible" },
      desc: {
        ar: "يناسب الطلاب القادمين من مسافات بعيدة أو من يفضلون عدم الاستيقاظ فجراً لحضور سلوت 8:00 صباحاً.",
        en: "Perfect for long commuters or students who prefer sleeping in and avoiding 8:00 AM classes.",
      },
    },
    {
      id: "worst_case",
      icon: "⚠️",
      badge: "stress",
      name: { ar: "سيناريو أسوأ الظروف (اختبار الضغط)", en: "Worst-Case Scenario (Stress Test)" },
      subtitle: { ar: "معرفة أسوأ جدول ممكن لو أغلقت السكاشن المفضلة في التسجيل", en: "Simulates the most exhausting feasible outcome" },
      desc: {
        ar: "يعرض لك أسوأ توزيعة سكاشن ممكنة (أكبر فترات فراغ، وأكبر مشقة تنقل بين المباني) لتكون مستعداً.",
        en: "Shows the most tiring feasible schedule so you know your fallback if sections fill up fast.",
      },
    },
  ],

  /* Core Solver: Finds all feasible section combinations using Backtracking CSP */
  solve(selectedCourseIndices) {
    if (!selectedCourseIndices || !selectedCourseIndices.length) {
      return { feasible: false, error: "no_courses_selected" };
    }

    const courses = selectedCourseIndices.map((idx) => ({
      idx,
      course: COURSES[idx],
    }));

    // Step 1: Extract fixed lecture cells and detect hard lecture-lecture clashes
    const lectureCells = new Map(); // "day:slot" -> [{ courseIdx, course, place }]
    const lectureClashes = [];

    for (const { idx, course } of courses) {
      course.lectures.forEach((lec) => {
        const lastSlot = lec.slots[1] ?? lec.slots[0];
        for (let s = lec.slots[0]; s <= lastSlot; s++) {
          const key = `${lec.day}:${s}`;
          if (!lectureCells.has(key)) lectureCells.set(key, []);
          lectureCells.get(key).push({
            courseIdx: idx,
            course,
            day: lec.day,
            slot: s,
            place: lec.place,
            doctor: lec.doctor,
          });
        }
      });
    }

    for (const [key, items] of lectureCells.entries()) {
      if (items.length > 1) {
        const [day, slot] = key.split(":");
        lectureClashes.push({
          day,
          slot: Number(slot),
          courses: items.map((it) => it.course),
          courseIndices: items.map((it) => it.courseIdx),
        });
      }
    }

    // Hard Infeasibility: Mandatory lectures clash directly!
    if (lectureClashes.length > 0) {
      return {
        feasible: false,
        bottleneck: {
          type: "lecture_clash",
          clashes: lectureClashes,
        },
      };
    }

    // Step 2: Filter candidate sections for each course (eliminate sections clashing with ANY lecture)
    const validSectionsPerCourse = [];
    const blockedSectionsInfo = [];

    for (const { idx, course } of courses) {
      const valid = [];
      const blocked = [];

      course.sections.forEach((sec, secIdx) => {
        const secKey = `${sec.day}:${sec.slot}`;
        if (lectureCells.has(secKey)) {
          const conflictingLec = lectureCells.get(secKey)[0];
          blocked.push({
            secIdx,
            section: sec,
            conflictingWithCourse: conflictingLec.course,
            day: sec.day,
            slot: sec.slot,
          });
        } else {
          valid.push({ secIdx, section: sec });
        }
      });

      if (valid.length === 0) {
        blockedSectionsInfo.push({
          courseIdx: idx,
          course,
          blocked,
        });
      }

      validSectionsPerCourse.push({
        courseIdx: idx,
        course,
        valid,
      });
    }

    if (blockedSectionsInfo.length > 0) {
      return {
        feasible: false,
        bottleneck: {
          type: "all_sections_blocked_by_lectures",
          blockedInfo: blockedSectionsInfo,
        },
      };
    }

    // Step 3: Backtracking search to find all feasible combinations
    const feasibleSolutions = [];
    const currentPicks = {};
    const occupiedCells = new Set();

    // Mark fixed lecture cells as occupied
    for (const key of lectureCells.keys()) {
      occupiedCells.add(key);
    }

    function search(cIdx) {
      if (cIdx >= validSectionsPerCourse.length) {
        feasibleSolutions.push({ ...currentPicks });
        return;
      }

      const { courseIdx, valid } = validSectionsPerCourse[cIdx];

      for (const { secIdx, section } of valid) {
        const secKey = `${section.day}:${section.slot}`;
        if (!occupiedCells.has(secKey)) {
          // Choose
          currentPicks[courseIdx] = secIdx;
          occupiedCells.add(secKey);

          // Recurse
          search(cIdx + 1);

          // Backtrack
          delete currentPicks[courseIdx];
          occupiedCells.delete(secKey);
        }
      }
    }

    search(0);

    // If no combination is feasible, analyze pairwise section bottlenecks
    if (feasibleSolutions.length === 0) {
      const pairwiseBottleneck = this.diagnosePairwiseBottlenecks(validSectionsPerCourse, lectureCells);
      return {
        feasible: false,
        bottleneck: pairwiseBottleneck,
      };
    }

    // Step 4: Evaluate and score all feasible solutions
    const evaluatedSolutions = feasibleSolutions.map((picks) =>
      this.evaluateSolution(picks, selectedCourseIndices, lectureCells)
    );

    return {
      feasible: true,
      count: evaluatedSolutions.length,
      solutions: evaluatedSolutions,
    };
  },

  /* Irreducible Inconsistent Subsystem (IIS) Diagnosis */
  diagnosePairwiseBottlenecks(validSectionsPerCourse, lectureCells) {
    const n = validSectionsPerCourse.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const cA = validSectionsPerCourse[i];
        const cB = validSectionsPerCourse[j];

        // Check if any valid pair exists between cA and cB
        let hasAnyNonClashingPair = false;
        for (const sA of cA.valid) {
          for (const sB of cB.valid) {
            const keyA = `${sA.section.day}:${sA.section.slot}`;
            const keyB = `${sB.section.day}:${sB.section.slot}`;
            if (keyA !== keyB) {
              hasAnyNonClashingPair = true;
              break;
            }
          }
          if (hasAnyNonClashingPair) break;
        }

        if (!hasAnyNonClashingPair) {
          return {
            type: "pairwise_section_clash",
            courseA: cA.course,
            courseB: cB.course,
            details: "all_sections_overlap",
          };
        }
      }
    }

    return {
      type: "complex_multi_clash",
      message: "No schedule exists without overlapping sections across 3 or more courses.",
    };
  },

  /* Evaluates a single feasible solution against all metrics */
  evaluateSolution(picks, selectedCourseIndices, lectureCells) {
    // Collect all schedule events grouped by day
    const scheduleByDay = {
      sat: [], sun: [], mon: [], tue: [], wed: [], thu: [],
    };

    // Add lectures
    selectedCourseIndices.forEach((cIdx) => {
      const course = COURSES[cIdx];
      course.lectures.forEach((lec) => {
        const lastSlot = lec.slots[1] ?? lec.slots[0];
        for (let s = lec.slots[0]; s <= lastSlot; s++) {
          scheduleByDay[lec.day].push({
            kind: "lecture",
            courseIdx: cIdx,
            course,
            day: lec.day,
            slot: s,
            place: lec.place,
          });
        }
      });

      // Add chosen section
      const secIdx = picks[cIdx];
      if (secIdx != null && course.sections[secIdx]) {
        const sec = course.sections[secIdx];
        scheduleByDay[sec.day].push({
          kind: "section",
          courseIdx: cIdx,
          course,
          day: sec.day,
          slot: sec.slot,
          place: sec.place,
          labels: sec.label,
        });
      }
    });

    let activeDaysCount = 0;
    let totalGapSlots = 0;
    let totalTransitCost = 0;
    let tightTransitsCount = 0;
    let morningSlotsCount = 0; // slot 1 (8:00 AM)
    let slot2Count = 0;        // slot 2 (9:30 AM)
    let lateSlotsCount = 0;    // slot 5, 6, 7 (after 2:30 PM)
    const dayStats = {};

    for (const [dayKey, events] of Object.entries(scheduleByDay)) {
      if (!events.length) continue;
      activeDaysCount++;

      // Sort events by slot number
      events.sort((a, b) => a.slot - b.slot);

      const slots = events.map((e) => e.slot);
      const minSlot = Math.min(...slots);
      const maxSlot = Math.max(...slots);

      // Idle slots between first and last class
      const occupiedUniqueSlots = new Set(slots);
      const span = maxSlot - minSlot + 1;
      const dayIdleSlots = span - occupiedUniqueSlots.size;
      totalGapSlots += Math.max(0, dayIdleSlots);

      // Track slot preferences
      occupiedUniqueSlots.forEach((s) => {
        if (s === 1) morningSlotsCount++;
        if (s === 2) slot2Count++;
        if (s >= 5) lateSlotsCount++;
      });

      // Compute transit strain between consecutive classes on this day
      let dayTransitCost = 0;
      for (let i = 0; i < events.length - 1; i++) {
        const ev1 = events[i];
        const ev2 = events[i + 1];
        if (ev1.slot === ev2.slot) continue;

        const slotGap = ev2.slot - ev1.slot - 1;
        const transit = this.getTransitCost(ev1.place, ev2.place, slotGap);
        dayTransitCost += transit;

        if (slotGap === 0 && this.DISTANCE_MATRIX[this.getZone(ev1.place)][this.getZone(ev2.place)] >= 14) {
          tightTransitsCount++;
        }
      }
      totalTransitCost += dayTransitCost;

      dayStats[dayKey] = {
        classesCount: events.length,
        minSlot,
        maxSlot,
        idleSlots: dayIdleSlots,
        transitCost: dayTransitCost,
      };
    }

    // Walking strain qualitative label
    let transitStrain = "low";
    if (tightTransitsCount > 0 || totalTransitCost >= 50) {
      transitStrain = "very_high";
    } else if (totalTransitCost >= 30) {
      transitStrain = "high";
    } else if (totalTransitCost >= 12) {
      transitStrain = "medium";
    }

    const totalGapHours = Number((totalGapSlots * 1.25).toFixed(1));

    return {
      picks,
      activeDays: activeDaysCount,
      totalGapSlots,
      totalGapHours,
      totalTransitCost,
      tightTransitsCount,
      transitStrain,
      morningSlotsCount,
      slot2Count,
      lateSlotsCount,
      dayStats,
    };
  },

  /* Scores a solution for a specific scenario (lower score = better, except worst_case) */
  scoreSolution(sol, scenarioId) {
    switch (scenarioId) {
      case "min_walking":
        // Prioritize minimum transit cost and eliminate tight transits between distant buildings
        return (sol.totalTransitCost * 12) + (sol.tightTransitsCount * 120) + (sol.totalGapSlots * 2);

      case "compact":
        // Prioritize minimum idle gaps, then minimum active days
        return (sol.totalGapSlots * 25) + (sol.activeDays * 6) + (sol.totalTransitCost * 0.4);

      case "max_free_days":
        // Prioritize fewest active attendance days
        return (sol.activeDays * 150) + (sol.totalGapSlots * 8) + (sol.totalTransitCost * 0.3);

      case "early_bird":
        // Penalize late slots heavily (5, 6, 7)
        return (sol.lateSlotsCount * 50) + (sol.totalGapSlots * 6) + (sol.totalTransitCost * 0.5);

      case "late_starter":
        // Penalize slot 1 (8 AM) and slot 2 (9:30 AM)
        return (sol.morningSlotsCount * 80) + (sol.slot2Count * 25) + (sol.totalGapSlots * 5);

      case "worst_case":
        // Invert: higher stress is "selected" as the worst case
        return (sol.totalTransitCost * 8) + (sol.totalGapSlots * 20) + (sol.activeDays * 35) + (sol.tightTransitsCount * 80);

      default:
        return sol.totalGapSlots + sol.activeDays;
    }
  },

  /* Get the optimal solution for a specific scenario */
  optimizeForScenario(selectedCourseIndices, scenarioId) {
    const res = this.solve(selectedCourseIndices);
    if (!res.feasible) return res;

    const solutions = res.solutions;
    const isWorstCase = scenarioId === "worst_case";

    solutions.sort((a, b) => {
      const scoreA = this.scoreSolution(a, scenarioId);
      const scoreB = this.scoreSolution(b, scenarioId);
      return isWorstCase ? scoreB - scoreA : scoreA - scoreB;
    });

    const best = solutions[0];
    return {
      feasible: true,
      totalSolutions: solutions.length,
      scenarioId,
      scenario: this.SCENARIOS.find((s) => s.id === scenarioId),
      best,
    };
  },

  /* Run comparison across ALL 6 scenarios */
  compareAllScenarios(selectedCourseIndices) {
    const res = this.solve(selectedCourseIndices);
    if (!res.feasible) return res;

    const solutions = res.solutions;
    const comparison = this.SCENARIOS.map((sc) => {
      const isWorstCase = sc.id === "worst_case";
      const sorted = [...solutions].sort((a, b) => {
        const scoreA = this.scoreSolution(a, sc.id);
        const scoreB = this.scoreSolution(b, sc.id);
        return isWorstCase ? scoreB - scoreA : scoreA - scoreB;
      });
      return {
        scenario: sc,
        best: sorted[0],
      };
    });

    return {
      feasible: true,
      totalSolutions: solutions.length,
      comparison,
    };
  },
};
