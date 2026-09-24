/* ============================================================================
 * What When / هجدول وأكلمك — DATA CONFIGURATION
 * ----------------------------------------------------------------------------
 * This file is the single source of truth for the tool.
 * Edit values here (or later via the admin page, Phase 3) to update the app.
 *
 * Schedule source: "FCAI Timetable 2026-2027 (First Semester) — Publish V3"
 *
 * Data conventions:
 *   - days:    'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu'
 *   - slots:   integers 1..7 (see SLOTS below for the time mapping)
 *   - lecture: { day, slots: [start, end], place, doctor }
 *   - section: { label: ['S1','S2'], day, slot, place }
 *
 * V3 CHANGE LOG (vs the previous data file):
 *   - CS352 ASE: new lab Sat S2 (S1,S2 · Lab 7).
 *   - CS321 Algorithms: several labs moved/corrected — IS Sat S6 is now
 *     (S5,S6 · Ben-ElSarayat 32) [was S9]; new DS labs (S5,S6 Tue S4 Lab 3);
 *     the IT Tue S1 (S3,S4) slot is now an IT&DC lab; AI Sun lab is S4 (not S3);
 *     Mon labs corrected to slot 6. See course block for the full list.
 *   - IT351 IT&DC: new lab Tue S1 (S3,S4 · Lab 8) [IT page]; the old
 *     Sat S1 (S1,S2 · Lab 3) entry no longer appears in V3 and was removed.
 *   - IT313 Computer Architecture: new lab Sun S5 (S3,S4 · Lab 8).
 *   - IT352 Pattern Recognition: new lab Tue S4 (S1,S2 · Lab 5).
 *   - IS321 File Management: Sat S1 is now (S5,S6); labs regrouped —
 *     (S7,S8 Sun S5 Lab 5), (S3,S4 Mon S6 Lab 3); old Sun S6 entry removed.
 *   - IS312 DBMS: new lab Sun S5 (S1,S2 · Lab 7); old Mon S5 entry removed.
 *   - DS341 Learning From Data: full lab list confirmed by V3 — five labs.
 *   - DS331 SysMod: Sun S2 lab moved to Lab 8.
 *   - DS312 Decision Support: LECTURE MOVED to Mon S3–S4 (was Wed S5–S6);
 *     labs: (S5,S6 Sun S3 Lab 6) [was Mon S4 Lab 5]; Wed labs confirmed.
 *   - CS423 Compilers: LECTURE MOVED to Tue S1–S2 (was Sun S3–S4).
 *   - CS465 Soft Computing: LECTURE MOVED to Tue S4–S5 (was Sun S5–S6).
 *   - IT443 Image Processing: labs confirmed — S1,S2 / S3,S4 / S5,S6 at
 *     Mon S4 / S5 / S6 (the old duplicate "S5" ambiguity is resolved).
 *   - IT424 Wireless: labs confirmed — S1,S2 / S3,S4 / S5,S6 at Mon S4/S5/S6.
 *   - IT416 Robotics: lab moved to Mon S1 (S1,S2 · Lab 3) [was Wed S3].
 *   - IS417 Selected Topics in Database: new lab Sat S6 (S1,S2 · Library Lab);
 *     old Tue S5 lab no longer appears in V3 and was removed.
 *   - DS425 Network Modeling: (S1,S2) lab moved to Wed S4 · Library Lab.
 *   - Intro to Logic doctor: Dr. Samar Taha (was Dr. Nermeen).
 *   - Brain-Computer Interfacing doctors: Prof. Eid Emary & Dr. Mahmoud Eid;
 *     labs confirmed — (S1,S2 Tue S1 Ben 32) / (S3,S4 Tue S2 Ben 35).
 *   - 4th-level AI Saturday lectures no longer overlap (GAN S1–2 / IAR S3–4 /
 *     Unsupervised S5–6) — the old auto-conflict disappears.
 *
 * REMAINING AMBIGUITY (verify against the official PDF):
 *   - IS page Wed S1: "Advanced Software Engineering (Lab) (Lab 7)" — the
 *     section labels are missing in the flattened PDF text; kept as (S5,S6)
 *     as in the previous version. Fix the label array in this file if wrong.
 * ========================================================================== */

const APP_CONFIG = {
  toolName: { ar: " هجدول وأكلمك", en: "What When" },
  academicTerm: { ar: "الفصل الدراسي الأول 2026–2027", en: "First Term 2026–2027" },

  whatsapp: {
    display: "+20 155 453 1921",
    link: "https://wa.me/201554531921",
  },

  // Google Analytics 4 Measurement ID (e.g. "G-XXXXXXXXXX")
  // Paste your Measurement ID here to track private visitors, schedules, & PNG exports
  googleAnalyticsId: "G-PVJS7FP8DC",

  departments: ["CS", "IT", "IS", "DS", "AI"],

  // Minimum passed credit hours required to use the tool (level 4)
  minCreditHours: 96,

  // Maximum credit hours by GPA at the start of the term (from the bylaws)
  gpaRules: [
    { id: "high", minGpa: 2,    maxHours: 18,
      label: { ar: "2 أو أكثر", en: "2.00 or above" },
      desc:  { ar: "18 ساعة معتمدة", en: "18 credit hours" } },
    { id: "mid",  minGpa: 1,    maxHours: 15,
      label: { ar: "أكبر من 1 وأقل من 2", en: "1.00 – 1.99" },
      desc:  { ar: "15 ساعة معتمدة", en: "15 credit hours" } },
    { id: "low",  minGpa: 0,    maxHours: 12,
      label: { ar: "أقل من 1", en: "Below 1.00" },
      desc:  { ar: "12 ساعة معتمدة", en: "12 credit hours" } },
  ],

  // Optional increase to 21h for level-4 students with GPA >= 2 (bylaws cases)
  extraHours: {
    maxHours: 21,
    requiresGpa: 2,
    label: { ar: "تنطبق عليّ حالة زيادة الحد الأقصى إلى 21 ساعة", en: "I qualify for the increased 21-hour limit" },
    hint:  { ar: "لطلاب المستوى الرابع الحاصلين على معدل 2 أو أكثر في الحالات المنصوص عليها باللائحة", en: "For level-4 students with GPA 2.00+ in the cases listed in the bylaws" },
  },

  // Graduation project: counts 3h toward the limit, NOT shown in the grid
  project: {
    creditHours: 3,
    label: { ar: "مشروع التخرج", en: "Graduation Project" },
  },

  creditHoursPerCourse: 3,
};

/* ---------------------------------------------------------------------------
 * Days & time slots — numbered 1..7, both durations as printed in the official
 * schedule (lecture-length / lab-length variants). Unchanged in V3.
 * ------------------------------------------------------------------------- */
const DAYS = [
  { key: "sat", ar: "السبت",   en: "Saturday" },
  { key: "sun", ar: "الأحد",   en: "Sunday" },
  { key: "mon", ar: "الاثنين", en: "Monday" },
  { key: "tue", ar: "الثلاثاء",en: "Tuesday" },
  { key: "wed", ar: "الأربعاء",en: "Wednesday" },
  { key: "thu", ar: "الخميس", en: "Thursday" },
];

const SLOTS = [
  { n: 1, short: "08:00–09:15", long: "08:00–09:30" },
  { n: 2, short: "09:30–10:45", long: "09:30–11:00" },
  { n: 3, short: "11:15–12:30", long: "11:15–12:45" },
  { n: 4, short: "12:45–02:00", long: "12:45–02:15" },
  { n: 5, short: "02:30–03:45", long: "02:30–04:00" },
  { n: 6, short: "04:15–05:30", long: "04:15–05:45" },
  { n: 7, short: "06:00–07:15", long: "06:00–07:30" },
];


/* Faculty-wide activity block printed in the official tables */
const FACULTY_ACTIVITY = { day: "tue", slot: 3,
  label: { ar: "نشاط كلية", en: "Faculty Activity" } };


const DEPT_NAMES = {
  CS:  { ar: "علوم الحاسب",                    en: "Computer Science" },
  IT:  { ar: "تكنولوجيا المعلومات",            en: "Information Technology" },
  IS:  { ar: "نظم المعلومات",                  en: "Information Systems" },
  DS:  { ar: "بحوث العمليات ودعم القرار",       en: "Operations Research & Decision Support" },
  AI:  { ar: "الذكاء الاصطناعي",               en: "Artificial Intelligence" },
  GEN: { ar: "مقررات عامة",                    en: "General Courses" },
};

/* ---------------------------------------------------------------------------
 * COURSES — every course appearing in the official schedule PDF (V3).
 * mandatoryFor: departments for which the bylaws list this course as
 *               compulsory. Empty array = optional for everyone (so far).
 * dept: owning department (by course code prefix, or schedule page when the
 *       code is unknown). Used for grouping in the catalog.
 * ------------------------------------------------------------------------- */
const COURSES = [
  /* ============================ LEVEL 3 ============================ */
  {
    code: "CS316", name: "Advanced Data Structures",
    dept: "CS", level: 3, creditHours: 3, mandatoryFor: ["CS"],
    lectures: [ { day: "mon", slots: [1, 2], place: "Hall 8", doctor: "Dr. Amin Alam" } ],
    sections: [
      { label: ["S1", "S2"], day: "mon", slot: 3, place: "Lab 8" },
      { label: ["S3", "S4"], day: "tue", slot: 2, place: "Lab 7" },
      { label: ["S5", "S6"], day: "wed", slot: 4, place: "Lab 6" },
      { label: ["S7", "S8"], day: "wed", slot: 3, place: "Lab 8" },
    ],
  },
  {
    code: "IT351", name: "Information Theory and Data Compression",
    dept: "IT", level: 3, creditHours: 3, mandatoryFor: ["CS", "IT"],
    lectures: [ { day: "sat", slots: [3, 4], place: "Farag Hall", doctor: "Dr. Asmaa Ahmed" } ],
    sections: [
      { label: ["S5", "S6"],  day: "sat", slot: 1, place: "Lab 3" },
      { label: ["S3", "S4"],  day: "sat", slot: 2, place: "Library Lab" },
      { label: ["S1", "S2"],  day: "sat", slot: 5, place: "Lab 5" },
      { label: ["S5", "S6"],  day: "sat", slot: 6, place: "Lab 5" },
      { label: ["S3", "S4"],  day: "tue", slot: 1, place: "Lab 8" },
      { label: ["S3", "S4"],  day: "tue", slot: 4, place: "Library Lab" },
      { label: ["S7", "S8"],  day: "wed", slot: 3, place: "Lab 6" },
      { label: ["S9", "S10"], day: "wed", slot: 4, place: "Lab 3" },
    ],
  },
  {
    code: "CS331", name: "Computer Organization and Architecture",
    dept: "CS", level: 3, creditHours: 3, mandatoryFor: ["CS"],
    lectures: [ { day: "sat", slots: [5, 6], place: "Farag Hall", doctor: "Dr. Ahmed Shawky" } ],
    sections: [
      { label: ["S3", "S4"], day: "mon", slot: 3, place: "Lab 7" },
      { label: ["S1", "S2"], day: "wed", slot: 1, place: "Lab 6" },
      { label: ["S5", "S6"], day: "wed", slot: 2, place: "Lab 7" },
      { label: ["S7", "S8"], day: "wed", slot: 3, place: "Lab 5" },
      { label: ["S1", "S2"], day: "sun", slot: 3, place: "Library Lab" },
      { label: ["S3", "S4"], day: "mon", slot: 1, place: "Lab 6" },
      { label: ["S5", "S6"], day: "thu", slot: 3, place: "Lab 3" },
      { label: ["S7", "S8"], day: "thu", slot: 4, place: "Lab 6" },
    ],
  },
  {
    code: "CS321", name: "Algorithms Analysis and Design",
    dept: "CS", level: 3, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "mon", slots: [4, 5], place: "Farag Hall", doctor: "Dr. Basher Youssef" } ],
    sections: [
      /* CS page */
      { label: ["S1", "S2"], day: "sat", slot: 1, place: "Lab 5" },
      { label: ["S3", "S4"], day: "mon", slot: 6, place: "Lab 5" },
      { label: ["S5", "S6"], day: "tue", slot: 1, place: "Lab 7" },
      { label: ["S7", "S8"], day: "tue", slot: 4, place: "Lab 7" },
      { label: ["S7", "S8"], day: "wed", slot: 3, place: "Lab 8" },
      { label: ["S5", "S6"], day: "wed", slot: 4, place: "Lab 6" },
      /* IT page */
      { label: ["S1", "S2"], day: "sun", slot: 3, place: "Lab 8" },
      { label: ["S3", "S4"], day: "sun", slot: 5, place: "Lab 6" },
      { label: ["S5", "S6"], day: "sun", slot: 6, place: "Lab 8" },
      /* IS page */
      { label: ["S1", "S2"], day: "sun", slot: 1, place: "Library Lab" },
      { label: ["S3", "S4"], day: "sat", slot: 5, place: "Ben-ElSarayat Lab 35" },
      { label: ["S5", "S6"], day: "sat", slot: 6, place: "Ben-ElSarayat Lab 32" },
      { label: ["S7", "S8"], day: "mon", slot: 6, place: "Library Lab" },
      /* DS page */
      { label: ["S1", "S2"], day: "sat", slot: 5, place: "Lab 6" },
      { label: ["S3", "S4"], day: "sat", slot: 6, place: "Lab 6" },
      { label: ["S5", "S6"], day: "tue", slot: 4, place: "Lab 3" },
      /* AI page */
      { label: ["S5", "S6"], day: "sun", slot: 4, place: "Lab 5" },
      { label: ["S3", "S4"], day: "mon", slot: 1, place: "Lab 5" },
      { label: ["S1", "S2"], day: "mon", slot: 2, place: "Lab 5" },
    ],
  },
  {
    code: "CS342", name: "Operating Systems",
    dept: "CS", level: 3, creditHours: 3, mandatoryFor: ["CS"],
    lectures: [ { day: "tue", slots: [5, 6], place: "Farag Hall", doctor: "Prof. Khaled Tawfik" } ],
    sections: [
      /* CS page */
      { label: ["S5", "S6"], day: "tue", slot: 1, place: "Lab 6" },
      { label: ["S3", "S4"], day: "tue", slot: 1, place: "Lab 5" },
      { label: ["S1", "S2"], day: "tue", slot: 2, place: "Lab 5" },
      { label: ["S7", "S8"], day: "tue", slot: 2, place: "Lab 3" },
      /* IT page */
      { label: ["S1", "S2"], day: "sat", slot: 6, place: "Lab 8" },
      { label: ["S3", "S4"], day: "tue", slot: 1, place: "Library Lab" },
      { label: ["S5", "S6"], day: "tue", slot: 2, place: "Library Lab" },
      /* IS page */
      { label: ["S7", "S8"], day: "tue", slot: 1, place: "Lab 3" },
      { label: ["S1", "S2"], day: "tue", slot: 2, place: "Lab 6" },
      { label: ["S5", "S6"], day: "wed", slot: 3, place: "Library Lab" },
      { label: ["S3", "S4"], day: "wed", slot: 4, place: "Lab 8" },
      /* DS page */
      { label: ["S1", "S2"], day: "wed", slot: 1, place: "Lab 8" },
      { label: ["S3", "S4"], day: "wed", slot: 2, place: "Lab 8" },
      /* AI page */
      { label: ["S3", "S4"], day: "mon", slot: 1, place: "Lab 5" },
      { label: ["S1", "S2"], day: "thu", slot: 3, place: "Lab 7" },
      { label: ["S5", "S6"], day: "thu", slot: 4, place: "Lab 8" },
    ],
  },
  {
    code: "CS352", name: "Advanced Software Engineering",
    dept: "CS", level: 3, creditHours: 3, mandatoryFor: ["CS", "IS"],
    lectures: [ { day: "wed", slots: [5, 6], place: "Farag Hall", doctor: "Dr. Desoky Abdel-Kawy" } ],
    sections: [
      /* CS page */
      { label: ["S1", "S2"], day: "sat", slot: 2, place: "Lab 7" },
      { label: ["S5", "S6"], day: "mon", slot: 6, place: "Lab 7" },
      { label: ["S3", "S4"], day: "wed", slot: 1, place: "Lab 5" },
      { label: ["S7", "S8"], day: "wed", slot: 4, place: "Library Lab" },
      /* IS page */
      { label: ["S3", "S4"], day: "sun", slot: 1, place: "Lab 3" },
      { label: ["S7", "S8"], day: "mon", slot: 6, place: "Lab 8" },
      { label: ["S1", "S2"], day: "tue", slot: 4, place: "Lab 6" },
      { label: ["S5", "S6"], day: "wed", slot: 1, place: "Lab 7" },  // labels missing in V3 PDF text — verify
    ],
  },
  {
    code: "IT331", name: "Data Communication",
    dept: "IT", level: 3, creditHours: 3, mandatoryFor: ["IT"],
    lectures: [ { day: "sat", slots: [1, 2], place: "Exam Room 409", doctor: "Dr. Eman Sannad" } ],
    sections: [
      { label: ["S1", "S2", "S3"], day: "sun", slot: 1, place: "Exam Room 411" },
      { label: ["S4", "S5", "S6"], day: "sun", slot: 2, place: "Exam Room 411" },
    ],
  },
  {
    code: "IT313", name: "Computer Architecture",
    dept: "IT", level: 3, creditHours: 3, mandatoryFor: ["IT"],
    lectures: [ { day: "thu", slots: [5, 6], place: "Exam Room 408", doctor: "Prof. Neveen Aboel-Hadid" } ],
    sections: [
      { label: ["S1", "S2"], day: "sun", slot: 3, place: "Lab 3" },
      { label: ["S3", "S4"], day: "sun", slot: 5, place: "Lab 8" },
      { label: ["S5", "S6"], day: "sun", slot: 4, place: "Lab 6" },
      { label: ["S3", "S4"], day: "tue", slot: 4, place: "Lab 5" },
    ],
  },
  {
    code: "IT352", name: "Pattern Recognition",
    dept: "IT", level: 3, creditHours: 3, mandatoryFor: ["IT"],
    lectures: [ { day: "mon", slots: [2, 3], place: "Exam Room 410", doctor: "Prof. Reda Abdel-Wahab & Dr. Mona Soliman" } ],
    sections: [
      { label: ["S1", "S2"], day: "sun", slot: 5, place: "Lab 8" },
      { label: ["S1", "S2"], day: "tue", slot: 4, place: "Lab 5" },
    ],
  },
  {
    code: "IS332", name: "Analysis and Design of Information Systems",
    dept: "IS", level: 3, creditHours: 3, mandatoryFor: ["IS"],
    lectures: [ { day: "sat", slots: [3, 4], place: "Exam Room 409", doctor: "Dr. Sherif Zahran" } ],
    sections: [
      { label: ["S1", "S2"], day: "sat", slot: 1, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "sat", slot: 2, place: "Ben-ElSarayat Lab 35" },
      { label: ["S5", "S6"], day: "wed", slot: 1, place: "Lab 3" },
      { label: ["S7", "S8"], day: "wed", slot: 2, place: "Lab 3" },
    ],
  },
  {
    code: "IS321", name: "File Management and Processing",
    dept: "IS", level: 3, creditHours: 3, mandatoryFor: ["IS"],
    lectures: [ { day: "sun", slots: [2, 3], place: "Hall 8", doctor: "Dr. Ayman El-Kilany & Dr. Wafaa Momen" } ],
    sections: [
      { label: ["S5", "S6"], day: "sat", slot: 1, place: "Ben-ElSarayat Lab 35" },
      { label: ["S1", "S2"], day: "sat", slot: 2, place: "Ben-ElSarayat Lab 32" },
      { label: ["S7", "S8"], day: "sun", slot: 5, place: "Lab 5" },
      { label: ["S3", "S4"], day: "mon", slot: 6, place: "Lab 3" },
    ],
  },
  {
    code: "IS312", name: "Database Management Systems",
    dept: "IS", level: 3, creditHours: 3, mandatoryFor: ["IS"],
    lectures: [ { day: "mon", slots: [2, 3], place: "Exam Room 409", doctor: "Dr. Noha Nagy & Dr. Ali Zidan" } ],
    sections: [
      { label: ["S3", "S4"], day: "sat", slot: 5, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "sat", slot: 6, place: "Ben-ElSarayat Lab 35" },
      { label: ["S7", "S8"], day: "sun", slot: 1, place: "Lab 6" },
      { label: ["S1", "S2"], day: "sun", slot: 5, place: "Lab 7" },
    ],
  },
  {
    code: "DS341", name: "Learning From Data",
    dept: "DS", level: 3, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "sat", slots: [1, 2], place: "Exam Room 410", doctor: "Dr. Mohamed Saad" } ],
    sections: [
      { label: ["S3", "S4"], day: "sat", slot: 5, place: "Lab 3" },
      { label: ["S1", "S2"], day: "sat", slot: 6, place: "Lab 3" },
      { label: ["S3", "S4"], day: "sun", slot: 4, place: "Lab 3" },
      { label: ["S1", "S2"], day: "sun", slot: 5, place: "Lab 3" },
      { label: ["S5", "S6"], day: "sun", slot: 6, place: "Lab 6" },
    ],
  },
  {
    code: "DS331", name: "System Modeling and Simulation",
    dept: "DS", level: 3, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "tue", slots: [1, 2], place: "Hall 8", doctor: "Dr. Ayman Sabry" } ],
    sections: [
      { label: ["S1", "S2"], day: "sat", slot: 5, place: "Lab 7" },
      { label: ["S3", "S4"], day: "sat", slot: 6, place: "Lab 7" },
      { label: ["S5", "S6"], day: "sun", slot: 2, place: "Lab 8" },
    ],
  },
  {
    code: "DS321", name: "Linear and Integer Programming",
    dept: "DS", level: 3, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "sat", slots: [3, 4], place: "Exam Room 410", doctor: "Dr. Basma Mostafa" } ],
    sections: [
      { label: ["S1", "S2", "S3", "S4", "S5", "S6"], day: "sun", slot: 1, place: "Exam Room 409" },
    ],
  },
  {
    code: "DS312", name: "Decision Support and Future Studies Methodologies",
    dept: "DS", level: 3, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "mon", slots: [3, 4], place: "Hall 8", doctor: "Prof. Motaz Khorshid & Dr. Hayam Gamal & Dr. Basma Mostafa" } ],
    sections: [
      { label: ["S5", "S6"], day: "sun", slot: 3, place: "Lab 6" },
      { label: ["S1", "S2"], day: "wed", slot: 1, place: "Library Lab" },
      { label: ["S3", "S4"], day: "wed", slot: 2, place: "Library Lab" },
    ],
  },
  {
    code: null, name: "Introduction to Logic",
    dept: "AI", level: 3, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sat", slots: [1, 2], place: "Exam Room 411", doctor: "Dr. Samar Taha" } ],
    sections: [
      { label: ["S1", "S2"], day: "sat", slot: 3, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "sat", slot: 4, place: "Ben-ElSarayat Lab 32" },
      { label: ["S7", "S8"], day: "mon", slot: 2, place: "Lab 3" },
      { label: ["S5", "S6"], day: "mon", slot: 3, place: "Lab 3" },
    ],
  },
  {
    code: null, name: "Theoretical Foundations of Machine Learning",
    dept: "AI", level: 3, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sun", slots: [2, 3], place: "Exam Room 410", doctor: "Prof. Reda Abdel-Wahab" } ],
    sections: [
      { label: ["S1", "S2"], day: "sat", slot: 3, place: "Ben-ElSarayat Lab 35" },
      { label: ["S3", "S4"], day: "sat", slot: 4, place: "Ben-ElSarayat Lab 35" },
      { label: ["S5", "S6"], day: "mon", slot: 1, place: "Library Lab" },
    ],
  },
  {
    code: "IT341", name: "Signals and Systems",
    dept: "IT", level: 3, creditHours: 3, mandatoryFor: ["IT"],
    lectures: [ { day: "thu", slots: [5, 6], place: "Farag Hall", doctor: "Dr. Mohamed Refaay" } ],
    sections: [
      { label: ["S1", "S2", "S3"], day: "tue", slot: 1, place: "Exam Room 404" },
      { label: ["S4", "S5", "S6"], day: "tue", slot: 2, place: "Exam Room 404" },
    ],
  },

  /* ============================ LEVEL 4 ============================ */
  {
    code: "CS462", name: "Machine Learning",
    dept: "CS", level: 4, creditHours: 3, mandatoryFor: ["CS", "IS"],
    lectures: [ { day: "sat", slots: [1, 2], place: "Hall 7", doctor: "Prof. Khaled Tawfik & Dr. Basma Mokhtar" } ],
    sections: [
      { label: ["S1", "S2"], day: "sat", slot: 3, place: "Lab 8" },
      { label: ["S3", "S4"], day: "sat", slot: 4, place: "Lab 8" },
      { label: ["S5", "S6"], day: "thu", slot: 5, place: "Ben-ElSarayat Lab 35" },
      { label: ["S7", "S8"], day: "thu", slot: 6, place: "Ben-ElSarayat Lab 35" },
      { label: ["S1", "S2"], day: "sun", slot: 6, place: "Ben-ElSarayat Lab 35" },
      { label: ["S3", "S4"], day: "sun", slot: 7, place: "Ben-ElSarayat Lab 32" },
      { label: ["S7", "S8"], day: "wed", slot: 5, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "wed", slot: 6, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: "CS465", name: "Soft Computing",
    dept: "CS", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "tue", slots: [4, 5], place: "Exam Room 411", doctor: "Dr. Sabah El-Sayed" } ],
    sections: [
      { label: ["S1", "S2"], day: "sat", slot: 3, place: "Lab 7" },
      { label: ["S3", "S4"], day: "sat", slot: 4, place: "Lab 7" },
      { label: ["S5", "S6"], day: "thu", slot: 5, place: "Ben-ElSarayat Lab 32" },
      { label: ["S7", "S8"], day: "thu", slot: 6, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: "CS423", name: "Compilers",
    dept: "CS", level: 4, creditHours: 3, mandatoryFor: ["CS"],
    lectures: [ { day: "tue", slots: [1, 2], place: "Exam Room 411", doctor: "Dr. Amin Alam" } ],
    sections: [
      { label: ["S3", "S4"], day: "mon", slot: 1, place: "Ben-ElSarayat Lab 32" },
      { label: ["S1", "S2"], day: "mon", slot: 2, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "mon", slot: 3, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: "CS495", name: "Selected Topics in Computer Science-1",
    dept: "CS", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "thu", slots: [3, 4], place: "Exam Room 404", doctor: "Dr. Mohamed Abdel-Wahab" } ],
    sections: [
      { label: ["S1", "S2"], day: "mon", slot: 1, place: "Ben-ElSarayat Lab 35" },
      { label: ["S3", "S4"], day: "mon", slot: 2, place: "Ben-ElSarayat Lab 35" },
      { label: ["S5", "S6"], day: "mon", slot: 3, place: "Ben-ElSarayat Lab 35" },
    ],
  },
  {
    code: "IT432", name: "Communication Technology",
    dept: "IT", level: 4, creditHours: 3, mandatoryFor: ["IT"],
    lectures: [ { day: "tue", slots: [4, 5], place: "Hall 7", doctor: "Prof. Haitham Safwat" } ],
    sections: [
      { label: ["S1", "S2"], day: "mon", slot: 1, place: "Lab 3" },
      { label: ["S1", "S2"], day: "wed", slot: 1, place: "Ben-ElSarayat Lab 35" },
      { label: ["S3", "S4"], day: "wed", slot: 2, place: "Ben-ElSarayat Lab 35" },
    ],
  },
  {
    code: "IT443", name: "Image Processing",
    dept: "IT", level: 4, creditHours: 3, mandatoryFor: ["IT"],
    lectures: [ { day: "mon", slots: [2, 3], place: "Exam Room 411", doctor: "Prof. Hoda Onsy & Dr. Mona Soliman & Dr. Ghada Dahy" } ],
    sections: [
      { label: ["S1", "S2"], day: "mon", slot: 4, place: "Ben-ElSarayat Lab 35" },
      { label: ["S3", "S4"], day: "mon", slot: 5, place: "Ben-ElSarayat Lab 35" },
      { label: ["S5", "S6"], day: "mon", slot: 6, place: "Ben-ElSarayat Lab 35" },
    ],
  },
  {
    code: "IT424", name: "Wireless and Mobile Networks",
    dept: "IT", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "thu", slots: [3, 4], place: "Exam Room 409", doctor: "Prof. Imane Saroit & Prof. Amira Kotb" } ],
    sections: [
      { label: ["S1", "S2"], day: "mon", slot: 4, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "mon", slot: 5, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "mon", slot: 6, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: "IT416", name: "Robotics",
    dept: "IT", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "tue", slots: [1, 2], place: "Exam Room 410", doctor: "Prof. Reda Abdel-Wahab" } ],
    sections: [
      { label: ["S1", "S2"], day: "mon", slot: 1, place: "Lab 3" },
    ],
  },
  {
    code: "IT423", name: "Information and Computer Network Security",
    dept: "IT", level: 4, creditHours: 3, mandatoryFor: ["IT"],
    lectures: [ { day: "thu", slots: [1, 2], place: "Exam Room 409", doctor: "Prof. Sanaa Taha" } ],
    sections: [
      { label: ["S1", "S2"], day: "wed", slot: 1, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "wed", slot: 2, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "wed", slot: 3, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: "IS437", name: "Information Systems Development Methodologies",
    dept: "IS", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sat", slots: [3, 4], place: "Exam Room 411", doctor: "Dr. Hatem El-Kady" } ],
    sections: [
      { label: ["S3", "S4"], day: "sat", slot: 5, place: "Lab 3" },
      { label: ["S5", "S6"], day: "sun", slot: 1, place: "Ben-ElSarayat Lab 32" },
      { label: ["S7"],       day: "sun", slot: 2, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "sun", slot: 3, place: "Ben-ElSarayat Lab 32" },
      { label: ["S1", "S2"], day: "sun", slot: 6, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: "IS434", name: "Service-Oriented Architecture",
    dept: "IS", level: 4, creditHours: 3, mandatoryFor: ["IS"],
    lectures: [ { day: "tue", slots: [1, 2], place: "Exam Room 409", doctor: "Dr. Ehab Ezzat & Dr. Samar Taha" } ],
    sections: [
      { label: ["S5", "S6"], day: "sun", slot: 1, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "sun", slot: 4, place: "Ben-ElSarayat Lab 35" },
      { 
      { label: ["S7","S8"],       day: "wed", slot: 5, place: "Ben-ElSarayat Lab 35" },
      { label: ["S1", "S2"], day: "wed", slot: 6, place: "Ben-ElSarayat Lab 35" },
    ],
  },
  {
    code: "IS442", name: "Geographical Information Systems",
    dept: "IS", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "tue", slots: [4, 5], place: "Exam Room 409", doctor: "Prof. Mohamed Nour El-Din" } ],
    sections: [
      { label: ["S1", "S2"], day: "sun", slot: 1, place: "Ben-ElSarayat Lab 35" },
      { label: ["S3", "S4"], day: "sun", slot: 2, place: "Ben-ElSarayat Lab 35" },
      { label: ["S5", "S6"], day: "sun", slot: 3, place: "Ben-ElSarayat Lab 35" },
      { label: ["S7"],       day: "sun", slot: 6, place: "Ben-ElSarayat Lab 35" },
    ],
  },
  {
    code: "IS417", name: "Selected Topics in Database",
    dept: "IS", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "wed", slots: [3, 4], place: "Exam Room 411", doctor: "Dr. Wafaa Momen" } ],
    sections: [
      { label: ["S3", "S4"], day: "sat", slot: 5, place: "Lab 3" },
      { label: ["S1", "S2"], day: "sat", slot: 6, place: "Library Lab" },
    ],
  },
  {
    code: "DS456", name: "Project Management",
    dept: "DS", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sun", slots: [1, 2], place: "Exam Room 408", doctor: "Dr. Doaa Saleh" } ],
    sections: [
      { label: ["S1", "S2", "S3", "S4", "S5"],         day: "sun", slot: 5, place: "Exam Room 408" },
      { label: ["S6", "S7", "S8", "S9", "S10"],        day: "sun", slot: 6, place: "Exam Room 408" },
      { label: ["S11", "S12", "S13", "S14", "S15"],    day: "wed", slot: 3, place: "Exam Room 409" },
      { label: ["S16", "S17", "S18", "S19", "S20"],    day: "wed", slot: 4, place: "Exam Room 409" },
    ],
  },
  {
    code: "DS342", name: "Data Analytics",
    dept: "DS", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "thu", slots: [1, 2], place: "Exam Room 410", doctor: "Dr. Sally Kasem & Dr. Marwa Mostafa" } ],
    sections: [
      { label: ["S1", "S2", "S3", "S4"],           day: "sun", slot: 3, place: "Exam Room 408" },
      { label: ["S5", "S6", "S7", "S8"],           day: "sun", slot: 4, place: "Exam Room 408" },
      { label: ["S9", "S10", "S11", "S12"],        day: "wed", slot: 3, place: "Exam Room 404" },
      { label: ["S13", "S14", "S15", "S16"],       day: "wed", slot: 4, place: "Exam Room 404" },
    ],
  },
  {
    code: "DS344", name: "Forecasting and Predictive Analytics",
    dept: "DS", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "thu", slots: [3, 4], place: "Exam Room 410", doctor: "Dr. Olivia Mourad" } ],
    sections: [
      { label: ["S1", "S2", "S3", "S4", "S5"], day: "sun", slot: 3, place: "Exam Room 409" },
    ],
  },
  {
    code: "DS424", name: "Multi-objective Programming",
    dept: "DS", level: 4, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "tue", slots: [1, 2], place: "Exam Room 408", doctor: "Prof. Tarek Aboel-Enin" } ],
    sections: [
      { label: ["S1", "S2", "S3", "S4", "S5"], day: "tue", slot: 4, place: "Exam Room 408" },
    ],
  },
  {
    code: "DS425", name: "Network Modeling and Optimization",
    dept: "DS", level: 4, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "wed", slots: [2, 3], place: "Exam Room 404", doctor: "Dr. Ghada Soliman" } ],
    sections: [
      { label: ["S3", "S4"], day: "tue", slot: 5, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "tue", slot: 6, place: "Ben-ElSarayat Lab 32" },
      { label: ["S1", "S2"], day: "wed", slot: 4, place: "Library Lab" },
    ],
  },
  {
    code: null, name: "Generative Adversarial Networks",
    dept: "AI", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sat", slots: [1, 2], place: "Exam Room 404", doctor: "Dr. Ghada Dahy" } ],
    sections: [
      { label: ["S3", "S4"], day: "tue", slot: 1, place: "Ben-ElSarayat Lab 35" },
      { label: ["S1", "S2"], day: "tue", slot: 3, place: "Ben-ElSarayat Lab 35" },
    ],
  },
  {
    code: null, name: "Intelligent Autonomous Robotics",
    dept: "AI", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sat", slots: [3, 4], place: "Exam Room 404", doctor: "Dr. Mohamed Wahby" } ],
    sections: [
      { label: ["S1", "S2"], day: "tue", slot: 2, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "tue", slot: 4, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "tue", slot: 4, place: "Ben-ElSarayat Lab 35" },
    ],
  },
  {
    code: null, name: "Unsupervised Learning",
    dept: "AI", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sat", slots: [5, 6], place: "Exam Room 404", doctor: "Dr. Mahmoud Eid" } ],
    sections: [
      { label: ["S1", "S2"], day: "tue", slot: 1, place: "Ben-ElSarayat Lab 35" },
      { label: ["S3", "S4"], day: "tue", slot: 2, place: "Ben-ElSarayat Lab 35" },
      { label: ["S5", "S6"], day: "tue", slot: 3, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: null, name: "Selected Topics in Artificial Intelligence-1",
    dept: "AI", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "mon", slots: [1, 2], place: "Exam Room 408", doctor: "Dr. Eman Ahmed" } ],
    sections: [
      { label: ["S1", "S2"], day: "thu", slot: 1, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "thu", slot: 2, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "thu", slot: 3, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: null, name: "Brain-Computer Interfacing",
    dept: "AI", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "mon", slots: [3, 4], place: "Exam Room 408", doctor: "Prof. Eid Emary & Dr. Mahmoud Eid" } ],
    sections: [
      { label: ["S1", "S2"], day: "tue", slot: 1, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "tue", slot: 2, place: "Ben-ElSarayat Lab 35" },
    ],
  },
];
