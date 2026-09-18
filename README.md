# What When | إيه امتا

An unofficial study-schedule planning tool for the Faculty of Computers & AI (Cairo University).
Arabic-first with an English toggle, RTL/LTR aware, ready for GitHub Pages.

> **Phase 1** — project foundation, data layer, student setup flow, course catalog
> with the course limit enforced (GPA / credit-hours / graduation-project rules).
> **Phase 2** — section picking, live timetable grid (days × numbered slots),
> conflict detection (red = lecture clash, yellow = section clash) with a
> warnings panel, catalog grid/list views, PNG export (full / occupied-only),
> floating WhatsApp button, AR/EN with RTL/LTR.
> Phase 3 adds the admin page (edit `data.js` values from a hidden UI).

## Run it

It's a fully static site — no build step, no dependencies.

```bash
# local preview
npx serve .

# or simply open index.html in a browser
```

## Deploy on GitHub Pages

1. Create a repository and push these files to the `main` branch.
2. In the repo: **Settings → Pages → Source: Deploy from a branch → `main` / root**.
3. The site goes live at `https://<username>.github.io/<repo>/`.

## Project structure

```
index.html              entry point
assets/
  css/styles.css        design tokens + all styles (palette lives in :root)
  js/data.js            ★ ALL editable data: courses, slots, GPA rules, WhatsApp, name
  js/i18n.js            every UI label in Arabic & English
  js/app.js             application logic (state + renderers)
```

## Editing the data (until the admin page ships in Phase 3)

Everything variable lives in `assets/js/data.js`:

- `APP_CONFIG.toolName` — the tool's name (Arabic + English)
- `APP_CONFIG.whatsapp` — the contact number / link
- `APP_CONFIG.gpaRules` — GPA ranges → max credit hours
- `APP_CONFIG.extraHours` — the optional 21-hour increase
- `APP_CONFIG.project` — graduation project credit hours
- `SLOTS` / `DAYS` — the numbered time grid (Slot 1..7)
- `COURSES` — every course: code, department, level, mandatory-for,
  lectures (`day + slots range + place + doctor`) and sections
  (`day + single slot + place + section labels`)

### Transcription flags

Entries marked with `[?]` in `data.js` were ambiguous in the source PDF
(scrambled two-column pages or repeated section numbers) — verify them
against the official schedule and correct them in `data.js` directly.

## Data notes

- Only courses present in the official schedule PDF are listed (the filter).
- Mandatory flags come from the bylaws excerpt (CS / IT / IS / DS).
  The AI mandatory list was not available yet — all AI courses are treated
  as optional until you add the flag in `data.js`.
- "Operating Systems" is listed as **CS342** (Advanced Operating Systems) in the bylaws.


