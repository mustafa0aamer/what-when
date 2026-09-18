/* ============================================================================
 * What When — ANALYTICS ENGINE (Google Analytics 4)
 * ----------------------------------------------------------------------------
 * Handles private telemetry for:
 *   - Page views / Unique visitors
 *   - Schedules configured (department, GPA rule, project status)
 *   - Courses & sections picked
 *   - PNG timetable exports (full vs compact)
 *   - WhatsApp developer inquiries
 *
 * All metrics are sent securely to your private GA4 property.
 * No visitors or users can see these metrics — only you on analytics.google.com
 * ========================================================================== */

"use strict";

const Analytics = {
  initialized: false,

  init() {
    if (typeof window.gtag === "function") {
      this.initialized = true;
      return;
    }

    const id = (APP_CONFIG && APP_CONFIG.googleAnalyticsId) ? APP_CONFIG.googleAnalyticsId.trim() : "";
    if (!id || id === "G-XXXXXXXXXX" || !id.startsWith("G-")) {
      // Analytics ID is not set yet. Running in silent no-op mode.
      return;
    }

    try {
      // 1. Inject gtag.js async script
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);

      // 2. Set up dataLayer and gtag function
      window.dataLayer = window.dataLayer || [];
      function gtag() {
        window.dataLayer.push(arguments);
      }
      window.gtag = gtag;

      gtag("js", new Date());
      gtag("config", id, {
        send_page_view: true,
        page_title: document.title,
        anonymize_ip: true,
      });

      this.initialized = true;
      console.log(`[Analytics] Google Analytics 4 connected (${id})`);
    } catch (err) {
      console.warn("[Analytics] Initialization error:", err);
    }
  },

  track(eventName, params = {}) {
    if (typeof window.gtag === "function") {
      try {
        window.gtag("event", eventName, params);
      } catch (err) {
        console.warn("[Analytics] Event track error:", err);
      }
    }
  },

  trackScheduleStarted(state) {
    this.track("schedule_started", {
      department: state.dept,
      gpa_rule: state.gpaRuleId,
      has_project: state.project ? "yes" : "no",
      extra_hours: state.extraHours ? "yes" : "no",
      hours_limit: state.hoursLimit,
    });
  },

  trackImageExported(mode, state, conflictCount) {
    this.track("image_exported", {
      export_mode: mode, // 'full' or 'compact'
      department: state.dept,
      courses_count: state.selected ? state.selected.length : 0,
      conflicts_count: conflictCount || 0,
    });
  },

  trackCourseToggled(courseCode, courseName, isSelected) {
    this.track(isSelected ? "course_selected" : "course_removed", {
      course_code: courseCode || "unknown",
      course_name: courseName,
    });
  },

  trackSectionPicked(courseName, sectionLabel) {
    this.track("section_picked", {
      course_name: courseName,
      section_label: sectionLabel,
    });
  },

  trackWhatsAppClick(source) {
    this.track("whatsapp_click", {
      source: source || "floating_button",
    });
  },
};
