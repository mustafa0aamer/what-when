/* ============================================================================
 * What When / إيه امتا — DATA CONFIGURATION
 * ----------------------------------------------------------------------------
 * This file is the single source of truth for the tool.
 * Edit values here (or later via the admin page, Phase 3) to update the app.
 *
 * Data conventions:
 *   - days:    'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu'
 *   - slots:   integers 1..7 (see SLOTS below for the time mapping)
 *   - lecture: { day, slots: [start, end], place, doctor }
 *   - section: { label: ['S1','S2'], day, slot, place }
 *
 * TRANSCRIPTION NOTES (verify against the official PDF):
 *   - Course codes verified against the official course-codes document are
 *     filled in; AI-department courses stay code-less this version (shows
 *     nothing anywhere).
 *   - The previously [?]-flagged entries (Learning From Data labs, Wireless
 *     labs, Image Processing S5, BCI labs, GAN/Unsupervised overlap) are kept
 *     EXACTLY as printed in the official schedule — duplicated section labels
 *     appear as multiple pickable options, and any genuine overlap is flagged
 *     by the tool automatically.
 *   - "Operating Systems" is listed as CS342 (Advanced Operating Systems)
 *     in the bylaws; names differ slightly between documents.
 * ========================================================================== */

const APP_CONFIG = {
  toolName: { ar: " هجدول وأكلمك", en: "What When" },
  academicTerm: { ar: "الفصل الدراسي الأول 2026–2027", en: "First Term 2026–2027" },

  whatsapp: {
    display: "+20 155 453 1921",
    link: "https://wa.me/201554531921",
  },

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
 * schedule (lecture-length / lab-length variants).
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
 * COURSES — every course appearing in the official schedule PDF.
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
      { label: ["S1", "S2"],  day: "sat", slot: 1, place: "Lab 3" },
      { label: ["S5", "S6"],  day: "sat", slot: 1, place: "Lab 3" },
      { label: ["S3", "S4"],  day: "sat", slot: 2, place: "Library Lab" },
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
      { label: ["S1", "S2"], day: "sat", slot: 1, place: "Lab 5" },
      { label: ["S3", "S4"], day: "mon", slot: 5, place: "Lab 5" },
      { label: ["S5", "S6"], day: "tue", slot: 1, place: "Lab 7" },
      { label: ["S7", "S8"], day: "tue", slot: 4, place: "Lab 7" },
      { label: ["S1", "S2"], day: "sun", slot: 3, place: "Lab 8" },
      { label: ["S5", "S6"], day: "sun", slot: 6, place: "Lab 8" },
      { label: ["S3", "S4"], day: "tue", slot: 1, place: "Lab 8" },
      { label: ["S3", "S4"], day: "sat", slot: 5, place: "Ben-ElSarayat Lab 35" },
      { label: ["S9"],       day: "sat", slot: 6, place: "Ben-ElSarayat Lab 32" },
      { label: ["S1", "S2"], day: "sun", slot: 1, place: "Library Lab" },
      { label: ["S7", "S8"], day: "mon", slot: 5, place: "Library Lab" },
      { label: ["S3", "S4"], day: "mon", slot: 1, place: "Lab 5" },
      { label: ["S1", "S2"], day: "mon", slot: 2, place: "Lab 5" },
      { label: ["S5", "S6"], day: "sun", slot: 3, place: "Lab 5" },
    ],
  },
  {
    code: "CS342", name: "Operating Systems",
    dept: "CS", level: 3, creditHours: 3, mandatoryFor: ["CS"],
    lectures: [ { day: "tue", slots: [5, 6], place: "Farag Hall", doctor: "Prof. Khaled Tawfik" } ],
    sections: [
      { label: ["S5", "S6"], day: "tue", slot: 1, place: "Lab 6" },
      { label: ["S3", "S4"], day: "tue", slot: 1, place: "Lab 5" },
      { label: ["S1", "S2"], day: "tue", slot: 2, place: "Lab 5" },
      { label: ["S7", "S8"], day: "tue", slot: 2, place: "Lab 3" },
      { label: ["S1", "S2"], day: "sat", slot: 6, place: "Lab 8" },
      { label: ["S3", "S4"], day: "tue", slot: 1, place: "Library Lab" },
      { label: ["S5", "S6"], day: "tue", slot: 2, place: "Library Lab" },
      { label: ["S7", "S8"], day: "tue", slot: 1, place: "Lab 3" },
      { label: ["S1", "S2"], day: "tue", slot: 2, place: "Lab 6" },
      { label: ["S5", "S6"], day: "wed", slot: 3, place: "Library Lab" },
      { label: ["S3", "S4"], day: "wed", slot: 4, place: "Lab 8" },
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
      { label: ["S5", "S6"], day: "mon", slot: 5, place: "Lab 7" },
      { label: ["S3", "S4"], day: "wed", slot: 1, place: "Lab 5" },
      { label: ["S7", "S8"], day: "wed", slot: 4, place: "Library Lab" },
      { label: ["S3", "S4"], day: "sun", slot: 1, place: "Lab 3" },
      { label: ["S7", "S8"], day: "mon", slot: 5, place: "Lab 8" },
      { label: ["S1", "S2"], day: "tue", slot: 4, place: "Lab 6" },
      { label: ["S5", "S6"], day: "wed", slot: 1, place: "Lab 7" },
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
      { label: ["S7", "S8"], day: "sat", slot: 1, place: "Ben-ElSarayat Lab 35" },
      { label: ["S1", "S2"], day: "sat", slot: 2, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "sun", slot: 6, place: "Lab 7" },
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
      { label: ["S1", "S2"], day: "mon", slot: 5, place: "Lab 3" },
    ],
  },
  {
    code: "DS341", name: "Learning From Data",
    dept: "DS", level: 3, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "sat", slots: [1, 2], place: "Exam Room 410", doctor: "Dr. Mohamed Saad" } ],
    sections: [
      { label: ["S3", "S4"], day: "sat", slot: 5, place: "Lab 3" },   // [?] verify
      { label: ["S1", "S2"], day: "sat", slot: 6, place: "Lab 3" },   // [?] verify
      { label: ["S5", "S6"], day: "sun", slot: 3, place: "Lab 6" },
    ],
  },
  {
    code: "DS331", name: "System Modeling and Simulation",
    dept: "DS", level: 3, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "tue", slots: [1, 2], place: "Hall 8", doctor: "Dr. Ayman Sabry" } ],
    sections: [
      { label: ["S1", "S2"], day: "sat", slot: 5, place: "Lab 7" },
      { label: ["S3", "S4"], day: "sat", slot: 6, place: "Lab 7" },
      { label: ["S5", "S6"], day: "sun", slot: 2, place: "Lab 7" },
    ],
  },
  {
    code: "DS321", name: "Linear and Integer Programming",
    dept: "DS", level: 3, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "sat", slots: [3, 4], place: "Exam Room 410", doctor: "Dr. Basma Mostafa" } ],
    sections: [
      { label: ["S1", "S2", "S3", "S4", "S5", "S6"], day: "sun", slot: 1, place: "Exam Room 404" },
    ],
  },
  {
    code: "DS312", name: "Decision Support and Future Studies Methodologies",
    dept: "DS", level: 3, creditHours: 3, mandatoryFor: ["DS"],
    lectures: [ { day: "wed", slots: [5, 6], place: "Hall 8", doctor: "Prof. Motaz Khorshid & Dr. Hayam Gamal & Dr. Basma Mostafa" } ],
    sections: [
      { label: ["S5", "S6"], day: "mon", slot: 4, place: "Lab 5" },
      { label: ["S1", "S2"], day: "wed", slot: 1, place: "Lab 8" },
      { label: ["S3", "S4"], day: "wed", slot: 2, place: "Lab 8" },
      { label: ["S1", "S2"], day: "wed", slot: 3, place: "Library Lab" },
      { label: ["S3", "S4"], day: "wed", slot: 4, place: "Library Lab" },
    ],
  },
  {
    code: null, name: "Introduction to Logic",
    dept: "AI", level: 3, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sat", slots: [1, 2], place: "Exam Room 411", doctor: "Dr. Nermeen" } ],
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
    lectures: [ { day: "sun", slots: [5, 6], place: "Exam Room 411", doctor: "Dr. Sabah El-Sayed" } ],
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
    lectures: [ { day: "sun", slots: [3, 4], place: "Exam Room 411", doctor: "Dr. Amin Alam" } ],
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
      { label: ["S5"],       day: "mon", slot: 4, place: "Ben-ElSarayat Lab 35" },  // [?] S5 repeated in source
      { label: ["S5", "S6"], day: "mon", slot: 5, place: "Ben-ElSarayat Lab 35" },
      { label: ["S1", "S2"], day: "mon", slot: 6, place: "Ben-ElSarayat Lab 35" },
    ],
  },
  {
    code: "IT424", name: "Wireless and Mobile Networks",
    dept: "IT", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "thu", slots: [3, 4], place: "Exam Room 409", doctor: "Prof. Imane Saroit & Prof. Amira Kotb" } ],
    sections: [
      { label: ["S1", "S2"], day: "mon", slot: 4, place: "Ben-ElSarayat Lab 32" },  // [?] inferred
      { label: ["S3", "S4"], day: "mon", slot: 5, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "mon", slot: 6, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: "IT416", name: "Robotics",
    dept: "IT", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "tue", slots: [1, 2], place: "Exam Room 410", doctor: "Prof. Reda Abdel-Wahab" } ],
    sections: [
      { label: ["S1", "S2"], day: "wed", slot: 3, place: "Ben-ElSarayat Lab 35" },
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
      { label: ["S3", "S4"], day: "sun", slot: 3, place: "Ben-ElSarayat Lab 35" },
      { label: ["S1", "S2"], day: "sun", slot: 5, place: "Ben-ElSarayat Lab 35" },
      { label: ["S7"],       day: "wed", slot: 6, place: "Ben-ElSarayat Lab 35" },
      { label: ["S1", "S2"], day: "wed", slot: 7, place: "Ben-ElSarayat Lab 35" },
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
      { label: ["S1", "S2"], day: "tue", slot: 5, place: "Ben-ElSarayat Lab 35" },
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
      { label: ["S1", "S2"], day: "wed", slot: 5, place: "Lab 8" },
    ],
  },
  {
    code: null, name: "Generative Adversarial Networks",
    dept: "AI", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "sat", slots: [5, 6], place: "Exam Room 404", doctor: "Dr. Ghada Dahy" } ],  // [?] overlaps Unsupervised Learning in source PDF
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
      { label: ["S1", "S2"], day: "tue", slot: 1, place: "Ben-ElSarayat Lab 32" },
      { label: ["S3", "S4"], day: "tue", slot: 2, place: "Ben-ElSarayat Lab 32" },
      { label: ["S5", "S6"], day: "tue", slot: 3, place: "Ben-ElSarayat Lab 32" },
    ],
  },
  {
    code: null, name: "Brain-Computer Interfacing",
    dept: "AI", level: 4, creditHours: 3, mandatoryFor: [],
    lectures: [ { day: "mon", slots: [3, 4], place: "Exam Room 408", doctor: "Dr. Mahmoud Eid" } ],
    sections: [
      { label: ["S1", "S2"], day: "tue", slot: 1, place: "Ben-ElSarayat Lab 32" },  // [?] verify
      { label: ["S3", "S4"], day: "tue", slot: 2, place: "Ben-ElSarayat Lab 35" },
    ],
  },
];
