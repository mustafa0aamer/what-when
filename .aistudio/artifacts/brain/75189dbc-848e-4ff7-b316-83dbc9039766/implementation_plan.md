# Logical Fixes, Grid Attendance Indicators & Phase 4 Smart Optimizer Integration

This plan resolves the five logical edge cases identified during the system audit, adds visual attendance status indicators directly to the timetable grid cells, and upgrades the Operations Research Smart Optimizer to factor student attendance preferences into scenario evaluations without permitting timetable clashes.

## User Review & Critical Decisions

> [!IMPORTANT]
> All four product decisions have been confirmed and incorporated into this plan:

- **Confirmed Scope**: Fix all 5 audited logical bugs and connect the Phase 4 Smart Optimizer to the Attendance Preferences state in a single cohesive update.
- **Confirmed "Rarely Attend" (`هحضر بشكل نادر`) Behavior**: Treated identically to **Mandatory** (`حضور إلزامي`) across all optimization metrics (walking distance, idle gaps, early morning, and late afternoon slots), **except** in the **Maximum Days Off (`max_free_days`)** scenario, where days containing only `Rarely Attend` classes do not count as full mandatory campus days.
- **Confirmed Timetable Grid Visuals**: Lectures and sections marked as **Will Not Attend** or **Rarely Attend** display a subtle status tag and slightly dimmed visual treatment on the timetable grid while keeping hard/soft conflict rules strictly enforced.
- **Confirmed Roadmap Sequencing**: The separate **Conflict Waiver (`فتح التعارض`)** feature remains scheduled for the next milestone immediately following this update.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Eliminates state and UI inconsistencies across course selection, setup re-entry, lecture-only courses, senior retakes, and summary bar badges.
  2. Visually distinguishes classes the student plans to skip or rarely attend directly inside the timetable grid.
  3. Upgrades the combinatorial schedule solver so that skipped classes (`مش هحضر`) do not artificially inflate campus walking strain, waiting gaps, or active attendance days, and rarely attended classes (`هحضر بشكل نادر`) allow the **Maximum Days Off** scenario to prioritize eliminating mandatory attendance days.
- **Target Audience**: Cairo University FCAI students across all 4 academic levels planning their semester timetables.
- **Key Value**: Produces realistic, personalized optimization recommendations that reflect which classes a student will physically commute to on campus, while preserving 100% clash-free registration integrity.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Attendance Configuration Flow**: When opening the Attendance Preferences modal, courses without lab sections (such as `HU111` and `HU113`) only display the **Lecture** preference row—preventing phantom section preferences.
  2. **Timetable Visual Feedback**: Selecting `مش هحضر` (Will Not Attend) or `هحضر بشكل نادر` (Rarely Attend) updates both the Registered Courses badge and the corresponding cells in the live Timetable Grid with a subtle dashed border, softened opacity (`0.72` for skipped, `0.88` for rare), and a compact status label.
  3. **Smart Optimizer Execution**: Opening the Smart Optimizer automatically evaluates candidate section combinations using the student's attendance preferences, updating active day counts, idle gap hours, and walking strain metrics in real time.
  4. **Senior Retake Lecture & Section Optimization**: When a Level 3 or Level 4 student selects a Level 1/2 retake course with Group A and Group B cohorts, the optimizer seamlessly evaluates both Group A and Group B lecture/section possibilities if not manually locked.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Utilitarian academic precision—high-contrast tabular data grid with clear semantic color coding and zero visual clutter.
  - *Color Palette & Mood*: Neutral slate canvas (`#f4f6f8`), crisp white structural surfaces (`#ffffff`), deep teal primary actions (`#0f766e`), muted slate dashed treatment for skipped slots, and warm amber accents (`#d97706`) for rare attendance indicators.
  - *Typography & Hierarchy*: **IBM Plex Sans Arabic** for Arabic UI and **Inter** with `tabular-nums` for slot timings, credit counters, and optimization metrics.
- **Interactive Feedback & Motion**:
  - Instant state synchronization across the Attendance Modal, Registered Courses list, Timetable Grid, and Smart Optimizer modal.
  - Non-blocking toast notification instead of native browser alerts if a user attempts to export an empty timetable.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Strict Separation of Attendance Preferences from Clash Detection**
  - *Chosen Approach*: Keep all time-slot occupancy constraints 100% strict during solver candidate generation (`solve()`), applying attendance preferences only during objective evaluation (`evaluateSolution()` and `scoreSolution()`).
  - *Why*: Ensures the optimizer never recommends a schedule with overlapping classes until the dedicated Conflict Waiver feature is explicitly enabled in the next phase.
- **Decision 2: Differentiated Weighting for "Will Not Attend" vs. "Rarely Attend"**
  - *Chosen Approach*:
    - **Will Not Attend (`skip`)**: Excluded from physical campus presence on that slot—zero walking transit cost to/from the class, zero idle gap creation, zero 8:00 AM / late afternoon penalty, and does not count as an active campus day.
    - **Rarely Attend (`rare`)**: Included identically to Mandatory classes in walking distance, idle gap, early bird, and late starter calculations so that when the student *does* attend, the slot is convenient and nearby. However, in the **Maximum Days Off (`max_free_days`)** scenario, a day containing only `rare` classes is weighted much lower than a day with `mandatory` classes so the optimizer prioritizes freeing up regular weekly attendance days.
  - *Why*: Matches real student behavior—a class attended only 2–3 times a term (e.g., for quizzes) still needs a reasonable time/location when attended, but should not prevent a student from getting a regular weekly day off.
- **Decision 3: State Sanitization Upon Editing Student Info**
  - *Chosen Approach*: When a returning student edits their Passed Hours or GPA in the Setup view, automatically remove any previously selected courses that are now locked by specialization rules (`< 45` hours) and trim excess courses if total credit hours exceed the newly calculated limit.
  - *Why*: Prevents impossible states where a student's selected courses exceed their allowed credit limit or include locked upper-level courses.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       Application State Store                           │
│  selected[] · picks{} · lecturePicks{} · attendance{ idx: {lec, sec} }  │
└───────────────┬─────────────────────────┬───────────────────────────────┘
                │                         │
                ▼                         ▼
┌───────────────────────────────┐ ┌───────────────────────────────────────┐
│   Timetable & Grid Builder    │ │     Operations Research Optimizer     │
│ ───────────────────────────── │ │ ───────────────────────────────────── │
│ • Resolves Group A/B cohorts  │ │ • Hard CSP: 100% Clash-Free Slots     │
│ • Attaches attendance status  │ │ • Senior Retake Lecture Group Flex    │
│ • Flags hard/soft conflicts   │ │ • Filters 'skip' from physical stats  │
│ • Renders dimmed/tagged cells │ │ • Distinguishes 'rare' in Free Days   │
└───────────────┬───────────────┘ └───────────────────┬───────────────────┘
                │                                     │
                ▼                                     ▼
┌───────────────────────────────┐ ┌───────────────────────────────────────┐
│   Registered & Grid Views     │ │     Scenario Comparison & Apply       │
│ • Hides section row if 0 labs │ │ • Updates picks{} & lecturePicks{}    │
│ • Unifies course removal      │ │ • Displays physical attendance stats  │
└───────────────────────────────┘ └───────────────────────────────────────┘
```

- **Data Model & State**:
  - `state.attendance[courseIdx]`: `{ lecture: 'mandatory' | 'skip' | 'rare', section: 'mandatory' | 'skip' | 'rare' }`.
  - Placement objects in `Timetable.build(state)` gain an `attendance: 'mandatory' | 'skip' | 'rare'` property derived from `state.attendance[courseIdx]`.
- **Interactive Component & State Mapping**:
  1. **Setup Form Submission (`bindSetup`)**: Validates returning student course selections against the new `isSpecialized` flag and `hoursLimit`, pruning disallowed or over-limit courses and cleaning up associated `picks`, `lecturePicks`, and `attendance` keys.
  2. **Catalog & Registered Course Removal**: Both unchecking `.course-check` and clicking `.reg-remove` invoke a unified cleanup routine that deletes `picks[idx]`, `lecturePicks[idx]`, and `attendance[idx]`.
  3. **Summary Bar Group Badge**: Renders the Cohort Group badge (`المجموعة A/B`) only when `state.isNewcomer || state.level <= 2`.
  4. **Attendance Modal (`renderAttendanceModal` & `countCustomAttendance`)**: Checks `sched.sections.length > 0` before rendering the section preference row or counting `att.section` toward the active custom preferences badge.
  5. **Timetable Grid & Canvas Export**: Applies `.tt-block--skip` and `.tt-block--rare` classes with a compact attendance label on screen and in exported PNG timetables.
  6. **Smart Optimizer (`ScheduleOptimizer`)**:
     - For Senior students (`level >= 3`) taking a course with `hasGroups: true`, evaluates valid lecture-group options (`A` or `B`) alongside sections, and persists the optimal `lecturePicks` when applied.
     - Filters out `skip` events when computing physical campus days, walking strain, idle gaps, and morning/late slot counts.
     - Tracks `mandatoryActiveDays` vs. `rareOnlyDays` so the `max_free_days` scenario prioritizes minimizing mandatory attendance days first.
