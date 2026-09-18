# Updating the data when a new schedule version is published

Everything the site shows comes from ONE file: `assets/js/data.js`.
When the faculty publishes a new schedule (or bylaws) version, edit only this
file — no other code changes are needed. Then commit & push; GitHub Pages
updates within a minute.

## What to edit

1. `APP_CONFIG.academicTerm` — the term label shown in the header/export.
2. `SLOTS` — only if the faculty changes the period times.
   `short` = lecture length (75 min), `long` = lab length (90 min).
3. `COURSES` — one block per course:
   - `code`: course code string, or `null` to show nothing at all.
   - `dept`: "CS" | "IT" | "IS" | "DS" | "AI" (grouping key in the catalog).
   - `mandatoryFor`: array of departments for which the bylaws make this
     course compulsory, e.g. `["CS","IT"]`. Empty = optional for everyone.
   - `lectures`: `[{ day: "sat", slots: [1,2], place, doctor }]`
     (slots are inclusive; [1,2] = a double lecture covering Slot 1 + 2).
   - `sections`: `[{ label: ["S1","S2"], day, slot, place }]`
     one entry per timeslot option. If the official table shows the same
     section labels in two different cells, add TWO entries — the student
     picks whichever suits them.

## Rules
- Days: "sat" | "sun" | "mon" | "tue" | "wed" | "thu".
- Never reorder courses inside `COURSES` mid-term (saved student picks are
  index-based). Only append new courses at the end, or bump the Store key
  in `app.js` (`whatwhen-state-vN`) to reset saved state.
- Keep names in English exactly as printed in the official PDF.
- After editing, hard-refresh the page (Ctrl+Shift+R) to bypass cache.
