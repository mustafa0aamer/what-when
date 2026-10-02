# System Architecture, Business Logic & Development History
## Project: What When (إيه امتا / هجدول) — Cairo University FCAI Schedule Planner

> **Document Purpose:** This document serves as the single source of truth for the entire application. Anyone reading this document—even without prior knowledge of the codebase—will understand the project's background, academic rules, mathematical optimization models, technical architecture, and the complete chronological history of every development phase.

---

## 1. Executive Summary & Vision

### 1.1 The Real-World Problem
At the **Faculty of Computers and Artificial Intelligence (FCAI), Cairo University**, registering courses for upcoming academic terms is a stressful, multi-variable challenge for senior students:
- Each department (**CS, IT, IS, DS, AI**) has specific mandatory and elective courses according to official academic bylaws.
- Each course has fixed lecture times that cannot be altered, alongside multiple lab/section choices spread throughout the week.
- Students must juggle GPA-based credit hour limits, graduation project hour deductions, physical transit between distant university facilities, and potential schedule clashes.
- Before this tool, students spent hours cross-referencing messy multi-page PDFs, manually drafting timetables on paper, only to realize during official registration that their picked sections conflicted or required exhausting cross-campus commutes.

### 1.2 The Solution
**What When (إيه امتا / هجدول)** is a high-performance, client-side web application designed to empower FCAI students to plan, optimize, clash-check, and export their semester timetables with clarity and confidence.

### 1.3 Key Architectural Principles
1. **Zero-Backend Architecture:** 100% client-side execution (HTML5, Vanilla ES6+ JavaScript, CSS3). Requires no servers, no databases, and has zero running costs. Runs instantaneously on static hosts like **GitHub Pages**.
2. **Operations Research Inside the Browser:** Features an exact combinatorial optimization solver that searches thousands of schedule permutations in **less than 20 milliseconds** directly on the client's device.
3. **Bilingual & Culturally Native:** Native Arabic-first interface with an instant English toggle, complete RTL/LTR directional awareness, and domain-authentic Cairo University academic terminology.
4. **Zero-Dependency & Self-Contained:** Built with clean, vanilla web standards without heavy frameworks (no React/Angular/Vue bloat), ensuring instant initial page loads (< 200 KB total payload).
5. **Professional Vector UI:** Strict zero-emoji policy; all icons are bespoke, scalable inline SVGs with unified stroke geometry.

---

## 2. Technology Stack & File Organization

```
/
├── index.html                  # Single-page HTML entry point
├── assets/
│   ├── css/
│   │   └── styles.css          # Design tokens, typography, grid, and modal styling
│   └── js/
│       ├── data.js             # Course catalog, faculty schedule, bylaws, and GPA rules
│       ├── i18n.js             # Bilingual dictionary and localization helpers (AR/EN)
│       ├── timetable.js        # Timetable matrix model, clash detector, and Canvas PNG exporter
│       ├── optimizer.js        # Operations Research solver, distance matrix, and scenario evaluator
│       ├── analytics.js        # Privacy-preserving Google Analytics 4 event dispatcher
│       └── app.js              # State machine, reactive UI renderers, and event coordinators
├── DATA-GUIDE.md               # Quick manual for faculty staff to update semester schedules
└── README.md                   # Quick-start guide
```

### Module Responsibilities:
- **`data.js`**: Pure static data store containing faculty regulations (`APP_CONFIG`), period slot definitions (`SLOTS`), day metadata (`DAYS`), and the complete course repository (`COURSES`).
- **`i18n.js`**: Provides the `STRINGS` map, `t(key)` string retriever, and `tr(bilingualObj)` resolver.
- **`timetable.js`**: Transforms selected courses and student section choices into a 2D matrix of `(Day, Slot)`, tags conflict types, and generates high-resolution PNG image exports.
- **`optimizer.js`**: Formulates section selection as a Constraint Satisfaction Problem (CSP), computes campus walking costs, evaluates 6 optimization goals, and diagnoses bottlenecks.
- **`analytics.js`**: Wraps Google Analytics 4 (`gtag.js`) into typed, semantic telemetry calls (e.g. `trackCourseToggled`, `trackScheduleOptimized`).
- **`app.js`**: Implements single-source-of-truth state management (`state`, `optState`), local storage persistence (`Store`), reactive DOM rendering (`renderAll()`), and event delegators.

---

## 3. Academic Bylaws & Business Logic

The tool strictly enforces Cairo University FCAI credit hour bylaws:

### 3.1 Eligibility Check (Level Gating)
- **Level 4 Eligibility:** A student must have successfully passed **96 credit hours or more**.
- If a student indicates `< 96 hours`, the system transitions to a friendly `notready` screen explaining that the current system release is tailored for Level 4 schedules.

### 3.2 GPA Bands & Credit Limits
Each course at FCAI typically carries **3 credit hours**. The maximum allowed credit hours a student can register in a regular semester depends on their cumulative GPA:

| GPA Band | Condition | Base Credit Limit | Base Course Limit |
| :--- | :--- | :---: | :---: |
| **Excellence / Distinction** | $\text{GPA} \ge 3.00$ | **19 credit hours** | Up to 6 courses (18 hrs) |
| **Good Standing** | $2.00 \le \text{GPA} < 3.00$ | **18 credit hours** | Up to 6 courses (18 hrs) |
| **Probation 1** | $1.50 \le \text{GPA} < 2.00$ | **14 credit hours** | Up to 4 courses (12 hrs) |
| **Probation 2** | $\text{GPA} < 1.50$ | **12 credit hours** | Up to 4 courses (12 hrs) |

### 3.3 The Graduation Project Rule
- Senior Level 4 students registering their **Graduation Project** commit **3 credit hours** of their academic limit.
- The graduation project does not occupy fixed slots on the lecture timetable (meetings are scheduled privately with supervising professors).
- Therefore, if `project === true`:
  $$\text{Usable Hours} = \text{Base Limit} - 3$$
  $$\text{Max Registerable Courses} = \left\lfloor \frac{\text{Usable Hours}}{3} \right\rfloor$$
  *Example:* A student with GPA 3.2 (limit 19 hrs) taking the Graduation Project has $19 - 3 = 16$ usable hours, granting them $\lfloor 16 / 3 \rfloor = 5$ courses in the catalog.

### 3.4 The 21-Hour Increased Limit Petition
- Under special faculty bylaw cases (e.g. graduating seniors who require extra hours to graduate), students with $\text{GPA} \ge 2.00$ may petition to increase their maximum limit to **21 credit hours** ($\lfloor 21 / 3 \rfloor = 7$ courses, or 6 courses + project).

### 3.5 Departmental Mandatory vs. Elective Courses
The catalog groups courses by department:
- **CS** (Computer Science)
- **IT** (Information Technology)
- **IS** (Information Systems)
- **DS** (Decision Support)
- **AI** (Artificial Intelligence)

Each course contains a `mandatoryFor: string[]` array. When a student chooses their major:
- Courses where `mandatoryFor.includes(studentDept)` receive a prominent **"Mandatory for you" (إجباري لقسمك)** badge.
- Other offered courses receive an **"Optional" (اختياري)** badge.

---

## 4. Timetable Engine & Conflict Detection

### 4.1 Temporal Matrix Layout
The university operating week runs from **Saturday to Thursday** across **7 standard time slots**:

| Slot | Lecture Span (75 min) | Lab/Section Span (90 min) |
| :---: | :---: | :---: |
| **Slot 1** | 08:00 AM – 09:15 AM | 08:00 AM – 09:30 AM |
| **Slot 2** | 09:30 AM – 10:45 AM | 09:30 AM – 11:00 AM |
| **Slot 3** | 11:00 AM – 12:15 PM | 11:15 AM – 12:45 PM |
| **Slot 4** | 12:30 PM – 01:45 PM | 01:00 PM – 02:30 PM |
| **Slot 5** | 02:00 PM – 03:15 PM | 02:45 PM – 04:15 PM |
| **Slot 6** | 03:30 PM – 04:45 PM | 04:30 PM – 06:00 PM |
| **Slot 7** | 05:00 PM – 06:15 PM | 06:00 PM – 07:30 PM |

*Note on Slot Spans:* Lectures typically take 2 consecutive slots (e.g., Slots 1 and 2 = a 2.5-hour double lecture), while sections take a single 90-minute slot.

### 4.2 Conflict Detection Engine (`Timetable.build`)
The algorithm processes all scheduled events for the student's selected courses and section picks into an addressable hash map `cells["${day}:${slot}"] = Event[]`.

When two or more events land on the same `(day, slot)`, the clash is classified:
1. **Hard Clash — Red Alert (`lecture`):**
   - Occurs when two fixed lectures overlap.
   - *Resolution:* Fixed lectures cannot be moved. The student **must drop one of the conflicting courses**.
2. **Soft Clash — Yellow Warning (`section`):**
   - Occurs when a section overlaps with another section or lecture.
   - *Resolution:* Can be resolved by switching to an alternate section of the same course.

### 4.3 Reserved Faculty Activities
Tuesday Slot 3 (11:00 AM – 12:45 PM) is reserved faculty-wide for student activities, seminars, and meetings. The timetable engine flags this slot with a muted placeholder indicating university activity.

---

## 5. Operations Research (OR) Schedule Optimizer

The standout engineering feature of the application is the **Goal-Based Smart Optimizer** located in `assets/js/optimizer.js`.

### 5.1 Mathematical Problem Formulation
The student section assignment problem is formulated as a **Combinatorial Optimization Problem (COP)** and **Constraint Satisfaction Problem (CSP)**:

- Let $C = \{1, 2, \dots, n\}$ be the set of courses selected by the student.
- For each course $i \in C$, let $L_i$ be its fixed lecture slots (constants), and $S_i = \{1, \dots, m_i\}$ be the set of section options.
- **Decision Variables:**
  $$x_{i, j} \in \{0, 1\} \quad \forall i \in C, \, j \in S_i$$
  where $x_{i, j} = 1$ if the student is assigned to section option $j$ of course $i$.

- **Hard Constraints:**
  1. *Exact Cover:* Exactly one section must be assigned per registered course:
     $$\sum_{j \in S_i} x_{i, j} = 1 \quad \forall i \in C$$
  2. *Temporal Exclusion (No-Clash):* For any day $d$ and time slot $s$, at most one class may be scheduled:
     $$\sum_{i \in C} \left( \mathbb{I}(\text{Lecture}_{i} \text{ occupies } (d, s)) + \sum_{j \in S_i} x_{i, j} \cdot \mathbb{I}(\text{Section}_{i, j} \text{ occupies } (d, s)) \right) \le 1$$

### 5.2 Campus Physical Distance Matrix $D(Z_A, Z_B)$
FCAI Cairo University classes take place across multiple buildings that vary significantly in physical distance. The optimizer groups every venue into **5 Distinct Campus Zones**:

| Zone ID | Zone Name | Included Facilities |
| :---: | :--- | :--- |
| **$Z_1$** | Graduate Studies (FSSR) | Hall 7, Hall 8 |
| **$Z_2$** | Main FCAI Building | Farag Hall, Shafei Hall, Labs 3, 5 |
| **$Z_3$** | New Building (NB) | Labs 6, 7, 8, Library Lab |
| **$Z_4$** | Central Exam Complex | Exam Rooms 404, 408, 409, 410, 411 (~1.5 km walk) |
| **$Z_5$** | Ben-ElSarayat Building | Ben-ElSarayat Labs 32, 35 (~1.1 km walk) |

#### Walking Effort & Transit Cost Matrix (Minutes):
$$
\begin{pmatrix}
 & Z_1 & Z_2 & Z_3 & Z_4 & Z_5 \\
Z_1 & 0 & 1 & 2 & 18 & 14 \\
Z_2 & 1 & 0 & 2 & 18 & 14 \\
Z_3 & 2 & 2 & 0 & 20 & 15 \\
Z_4 & 18 & 18 & 20 & 0 & 8 \\
Z_5 & 14 & 14 & 15 & 8 & 0
\end{pmatrix}
$$

*Back-to-Back Rushing Penalty:* If two classes on the same day are in consecutive slots ($\text{slotGap} = 0$, meaning only a 15-minute break) and the transit distance between their zones is $\ge 14$ minutes, a **$2.5\times$ penalty multiplier** is applied because it is physically strenuous to arrive on time.

### 5.3 The 6 Optimization Scenarios

1. **Minimal Campus Transit (`min_walking`):**
   * *Objective:* Minimize total physical transit strain between distant zones across all days.
   * *Formula:* $\min \left( \text{TotalTransitCost} \times 12 + \text{TightTransits} \times 120 + \text{TotalGaps} \times 2 \right)$.
2. **Compact Days / Minimal Idle Gaps (`compact`):**
   * *Objective:* Eliminate dead waiting hours between classes so students finish their day and leave early.
   * *Formula:* $\min \left( \text{TotalGaps} \times 25 + \text{ActiveDays} \times 6 + \text{TotalTransitCost} \times 0.4 \right)$.
3. **Maximum Days Off (`max_free_days`):**
   * *Objective:* Compress the weekly schedule into the minimum number of active university days (e.g. 3 days instead of 5).
   * *Formula:* $\min \left( \text{ActiveDays} \times 150 + \text{TotalGaps} \times 8 + \text{TotalTransitCost} \times 0.3 \right)$.
4. **Early Bird / Morning Focus (`early_bird`):**
   * *Objective:* Prioritize morning slots (Slots 1, 2, 3) and heavily penalize late afternoon/evening slots (Slots 5, 6, 7).
   * *Formula:* $\min \left( \text{LateSlotsCount} \times 50 + \text{TotalGaps} \times 6 + \text{TotalTransitCost} \times 0.5 \right)$.
5. **Late Starter / No 8 AMs (`late_starter`):**
   * *Objective:* Avoid 8:00 AM classes (Slot 1) to accommodate long commuters.
   * *Formula:* $\min \left( \text{MorningSlotsCount} \times 80 + \text{Slot2Count} \times 25 + \text{TotalGaps} \times 5 \right)$.
6. **Worst-Case Scenario / Stress Test (`worst_case`):**
   * *Objective:* Inverts the objective function to find the most exhausting feasible outcome (maximum walking, maximum gaps), preparing the student for the worst-case scenario if sections fill up fast.

### 5.4 The Two Interactive Modes
1. **Focus on a Goal (اختيار هدف محدد):**
   - The user selects one of the 6 scenario cards.
   - The system displays a live **Metrics Preview Panel** showing exact numbers: Active attendance days, idle gap hours, qualitative walking strain (Low/Moderate/High/Very High), 8:00 AM count, and afternoon class count.
   - A single click on **"Apply This Schedule" (تطبيق هذا الجدول)** immediately injects the optimal section picks into the timetable grid.
2. **Comprehensive Scenario Comparison (عرض مقارنة شاملة):**
   - Renders a multi-scenario decision matrix.
   - Evaluates all 6 goals side-by-side with comparative metrics and direct 1-click **Apply** buttons on every card.

### 5.5 Irreducible Inconsistent Subsystem (IIS) Bottleneck Diagnostic
When a student selects an incompatible combination of courses where **zero** clash-free schedules exist:
- Instead of showing a generic error, the solver performs an IIS root-cause analysis:
  * **Lecture Clash:** Identifies the two courses whose fixed lectures collide, stating the exact day and slot.
  * **Blocked Sections:** Identifies if all sections of course $A$ are blocked by the fixed lectures of course $B$.
  * **Pairwise Deadlock:** Identifies when all sections of two courses mutually intersect.
- Presents actionable advice on which elective to swap.

---

## 6. High-Resolution Canvas PNG Exporter

Built into `timetable.js`, the export engine draws the student's timetable onto an HTML5 `<canvas>` element and exports a crisp PNG download:
- **Retina/High-DPI Support:** Multiplies canvas dimensions by `window.devicePixelRatio` (scale factor 2.0) to ensure zero blurriness on mobile and high-resolution displays.
- **Two Export Modes:**
  * **Full Timetable (`full`):** Renders all 6 days (Saturday to Thursday) and all 7 slots.
  * **Compact Occupied (`compact`):** Dynamically inspects the student's schedule, trims empty days, and removes unused late slots, saving image space.
- **Visual Branding:** Includes header metadata, term label, student department, and timestamp watermark.

---

## 7. Design System & Anti-Slop Discipline

The frontend follows strict aesthetic and accessibility guidelines:
- **Typography:** Dual font stack:
  * Arabic: **IBM Plex Sans Arabic** (high legibility and crisp letterforms).
  * English / Codes: **Inter** (clean tabular numbers and code readability).
- **Color Tokens:**
  * Primary Accent: Deep Teal (`#0f766e` / `#115e59`).
  * Surface & Background: Clean slate (`#f4f6f8` background, `#ffffff` surface, `#e2e8f0` border).
  * Danger / Lecture Clashes: `#dc2626` / Soft red `#fef2f2`.
  * Warning / Section Clashes: `#d97706` / Soft amber `#fffbeb`.
- **Zero-Emoji Discipline:**
  * All user-facing icons are implemented as clean, inline vector `<svg>` elements with a consistent `1.8px` stroke width and round linecaps.
  * Completely eliminates cross-platform emoji rendering disparities between Windows, macOS, Android, and iOS.

---

## 8. Privacy-First Analytics System

`assets/js/analytics.js` integrates with Google Analytics 4 (`G-PVJS7FP8DC`) in a strictly anonymized manner:
- Tracks user milestones: `setup_completed`, `course_toggled`, `section_picked`, `schedule_optimized`, `image_exported`, `whatsapp_clicked`.
- Collects **zero** personally identifiable information (PII). No names, student IDs, or IP addresses are recorded.

---

## 9. Chronological Development History & Changelog

### Phase 1: Project Foundation & Credit Hour Rules
- Created the project repository, base layout, and design system tokens.
- Structured `data.js` containing faculty courses, slot times, and GPA bylaws.
- Implemented Level 4 gating (96+ hours check) and credit limit calculators.
- Enforced the graduation project 3-hour deduction and 21-hour petition toggle.
- Built the bilingual Arabic/English engine (`i18n.js`).

### Phase 2: Live Grid & Clash Detection
- Transposed timetable matrix layout with days as rows and slots 1–7 as columns.
- Implemented two-tiered conflict detection (Red for lecture clashes, Yellow for section clashes).
- Added multi-slot continuation badge (`cont.`) for 2-slot lectures.
- Added catalog dual view toggles (Card Grid view vs Accordion List view).
- Developed the Canvas-based PNG export module with Full vs Compact occupied options.
- Added the sticky header, department filters, and WhatsApp floating contact button.

### Phase 3: UX Refinement & Telemetry
- Added the **Registered Courses Panel** allowing students to see their picked courses and change sections in one place.
- Implemented real-time limit-reached shake animations and toast notifications.
- Integrated privacy-friendly Google Analytics 4 event tracking.

### Phase 4: Operations Research (OR) Goal-Based Smart Optimizer
- Formulated the student section scheduling problem mathematically (CSP / COP).
- Mapped all FCAI venues into 5 physical campus zones ($Z_1$ to $Z_5$).
- Defined the walking distance cost matrix $D(Z_A, Z_B)$ with back-to-back penalty multipliers.
- Implemented the backtracking search algorithm solving feasible combinations in $\le 20\text{ ms}$.
- Created the 6 optimization objective scenarios (`min_walking`, `compact`, `max_free_days`, `early_bird`, `late_starter`, `worst_case`).
- Built the interactive modal with two distinct modes: **"Focus on a Goal"** and **"Comprehensive Comparison"**.
- Implemented the Irreducible Inconsistent Subsystem (IIS) bottleneck diagnostic.

### Phase 5: Vector SVG Modernization (Zero-Emoji Policy)
- Replaced all unicode emojis across the entire codebase with bespoke inline vector `<svg>` icons.
- Added consistent SVG icons for target, bar-chart, walking, lightning bolt, beach umbrella, sunrise, coffee cup, alert triangle, hourglass, and calendar.
- Synchronized styling and sizing in CSS for seamless rendering across all operating systems.

### Phase 6: AI Department Bylaw Integration
- Uploaded and cross-referenced official Cairo University bylaws for the Artificial Intelligence (AI) department.
- Updated `assets/js/data.js` with official course codes and mandatory designations:
  * **AI311:** Introduction to Logic (`mandatoryFor: ["AI"]`)
  * **AI321:** Theoretical Foundations of Machine Learning (`mandatoryFor: ["AI"]`)
  * **AI423:** Unsupervised Learning (`mandatoryFor: ["AI"]`)
  * **AI441:** Intelligent Autonomous Robotics (`mandatoryFor: ["AI"]`)
  * **CS331:** Computer Organization & Architecture (updated to `mandatoryFor: ["CS", "AI"]`)
  * **IT341:** Signals and Systems (updated to `mandatoryFor: ["IT", "AI"]`)
- Bumped cache-busting version strings to `?v=3.3`.

---

## 10. How to Run, Test, and Deploy

### Local Development
Because the application uses standard ES6 modules without compilation requirements, any static server works:
```bash
# Using Node.js
npx serve .

# Using Python
python3 -m http.server 3000

# Or simply double-click index.html in any modern browser
```

### Deploying to GitHub Pages
1. Push the repository to GitHub.
2. In the repository settings: **Settings → Pages → Build and deployment → Source: Deploy from a branch (`main` / root)**.
3. The site goes live immediately with zero configuration.
