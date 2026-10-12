/**
 * Numeric counters for open written answers.
 * Keeps counts only: paste events, pasted length, typed length, focus time.
 * Does not store clipboard text, does not log keystrokes, does not block paste.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MysteryIncAnswerIntegrity = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  const TRACKED_FIELDS = ["c1", "d2", "e1", "f3", "g3", "soft_why"];
  const FIELD_KEYS = [
    "paste_events",
    "pasted_chars",
    "typed_chars",
    "max_single_paste",
    "active_ms",
    "final_len",
  ];

  function loadRules() {
    if (root && root.MysteryIncRules && root.MysteryIncRules.RULES_VERSION) {
      return root.MysteryIncRules;
    }
    if (typeof require === "function") {
      return require("../content/rules-2026-10-12-open-book.js");
    }
    throw new Error("Session rules are not loaded.");
  }

  function asCount(n) {
    const x = Number(n);
    if (!isFinite(x) || x < 0) return 0;
    return Math.round(x);
  }

  function isTracked(id) {
    return TRACKED_FIELDS.indexOf(id) !== -1;
  }

  function blankField() {
    return {
      paste_events: 0,
      pasted_chars: 0,
      typed_chars: 0,
      max_single_paste: 0,
      active_ms: 0,
      final_len: 0,
    };
  }

  function copyField(src) {
    const out = blankField();
    FIELD_KEYS.forEach(function (key) {
      out[key] = asCount(src ? src[key] : 0);
    });
    return out;
  }

  /**
   * Length of clipboard text/plain only. The string is not stored.
   * Returns null when the clipboard cannot be read.
   */
  function pastedCharCount(event) {
    const cd = event && event.clipboardData;
    if (!cd || typeof cd.getData !== "function") return null;
    try {
      const raw = cd.getData("text/plain");
      if (typeof raw !== "string") return null;
      return raw.length;
    } catch (err) {
      return null;
    }
  }

  function selectionSpan(el) {
    if (!el) return 0;
    const a = el.selectionStart;
    const b = el.selectionEnd;
    if (typeof a !== "number" || typeof b !== "number") return 0;
    if (a < 0 || b < 0) return 0;
    return Math.max(0, b - a);
  }

  function dataLength(event) {
    if (!event || typeof event.data !== "string") return null;
    return event.data.length;
  }

  function isPasteInputType(inputType) {
    return inputType === "insertFromPaste" || inputType === "insertFromPasteAsQuotation";
  }

  function isIsoTimestamp(value) {
    if (typeof value !== "string" || !value) return false;
    const parsed = Date.parse(value);
    return isFinite(parsed) && /T\d{2}:\d{2}:\d{2}/.test(value);
  }

  function createTracker(options) {
    const now = function () {
      if (options && typeof options.now === "function") return options.now();
      return Date.now();
    };
    const stats = {};
    const focusStart = {};
    const compositionLen = {};
    const pasteMeasure = {};
    const skipTyped = {};

    function ensure(id) {
      if (!stats[id]) stats[id] = blankField();
      return stats[id];
    }

    function notePaste(id, charCount) {
      if (!isTracked(id)) return;
      const n = asCount(charCount);
      const row = ensure(id);
      row.paste_events += 1;
      row.pasted_chars += n;
      if (n > row.max_single_paste) row.max_single_paste = n;
    }

    function noteTyped(id, charCount) {
      if (!isTracked(id)) return;
      const n = asCount(charCount);
      if (!n) return;
      ensure(id).typed_chars += n;
    }

    function setFinalLen(id, len) {
      if (!isTracked(id)) return;
      ensure(id).final_len = asCount(len);
    }

    function noteFocus(id, at) {
      if (!isTracked(id)) return;
      if (focusStart[id] != null) return;
      focusStart[id] = at == null ? now() : at;
    }

    function noteBlur(id, at) {
      if (!isTracked(id)) return;
      if (focusStart[id] == null) return;
      const end = at == null ? now() : at;
      const delta = end - focusStart[id];
      focusStart[id] = null;
      if (delta > 0) ensure(id).active_ms += Math.round(delta);
    }

    function endAllFocus(at) {
      const end = at == null ? now() : at;
      TRACKED_FIELDS.forEach(function (id) {
        noteBlur(id, end);
      });
    }

    function armPasteMeasure(id, before, selected) {
      if (!isTracked(id)) return;
      pasteMeasure[id] = { before: asCount(before), selected: asCount(selected) };
    }

    function takePasteMeasure(id) {
      const pending = pasteMeasure[id] || null;
      pasteMeasure[id] = null;
      return pending;
    }

    function armSkipTyped(id) {
      if (!isTracked(id)) return;
      skipTyped[id] = true;
    }

    function consumeSkipTyped(id) {
      const armed = skipTyped[id] === true;
      skipTyped[id] = false;
      return armed;
    }

    function setCompositionLen(id, len) {
      if (!isTracked(id)) return;
      compositionLen[id] = asCount(len);
    }

    function compositionLength(id) {
      return asCount(compositionLen[id] || 0);
    }

    function resetComposition(id) {
      if (!isTracked(id)) return;
      compositionLen[id] = 0;
    }

    function applyAnswers(answers) {
      TRACKED_FIELDS.forEach(function (id) {
        const value = answers && typeof answers[id] === "string" ? answers[id] : "";
        ensure(id).final_len = value.length;
      });
    }

    function fieldsSnapshot() {
      const fields = {};
      TRACKED_FIELDS.forEach(function (id) {
        fields[id] = copyField(ensure(id));
      });
      return fields;
    }

    function buildPayload(opts) {
      const optionsIn = opts || {};
      endAllFocus(optionsIn.now);
      if (optionsIn.answers) applyAnswers(optionsIn.answers);
      const rules = loadRules();
      const payloadVersion = rules.PAYLOAD_RULES_VERSION;
      if (payloadVersion !== "open-book-v1") {
        throw new Error("rules version mismatch");
      }
      if (optionsIn.rulesVersion && optionsIn.rulesVersion !== payloadVersion) {
        throw new Error("rules version mismatch");
      }
      if (optionsIn.attestedNoAi !== true) {
        const missing = new Error("Attestation is required before submit.");
        missing.kind = "attestation_required";
        throw missing;
      }
      if (!isIsoTimestamp(optionsIn.attestedAt)) {
        const badTime = new Error("attested_at must be an ISO timestamp.");
        badTime.kind = "attestation_required";
        throw badTime;
      }
      return {
        rules_version: payloadVersion,
        attested_no_ai: true,
        attested_at: optionsIn.attestedAt,
        fields: fieldsSnapshot(),
      };
    }

    function reset() {
      TRACKED_FIELDS.forEach(function (id) {
        stats[id] = blankField();
        focusStart[id] = null;
        compositionLen[id] = 0;
        pasteMeasure[id] = null;
        skipTyped[id] = false;
      });
    }

    reset();

    return {
      notePaste: notePaste,
      noteTyped: noteTyped,
      setFinalLen: setFinalLen,
      noteFocus: noteFocus,
      noteBlur: noteBlur,
      endAllFocus: endAllFocus,
      armPasteMeasure: armPasteMeasure,
      takePasteMeasure: takePasteMeasure,
      armSkipTyped: armSkipTyped,
      consumeSkipTyped: consumeSkipTyped,
      setCompositionLen: setCompositionLen,
      compositionLength: compositionLength,
      resetComposition: resetComposition,
      applyAnswers: applyAnswers,
      fieldsSnapshot: fieldsSnapshot,
      buildPayload: buildPayload,
      reset: reset,
    };
  }

  function fieldId(target) {
    if (!target || typeof target.getAttribute !== "function") return "";
    const name = target.getAttribute("name") || "";
    return isTracked(name) ? name : "";
  }

  function valueLength(el) {
    if (!el || el.value == null) return 0;
    return String(el.value).length;
  }

  function typedCharsFromInput(tracker, id, event) {
    const inputType = String((event && event.inputType) || "");
    if (isPasteInputType(inputType)) return 0;
    if (inputType === "insertCompositionText") {
      const next = dataLength(event);
      const len = next == null ? 0 : next;
      const prev = tracker.compositionLength(id);
      tracker.setCompositionLen(id, len);
      return Math.max(0, len - prev);
    }
    if (inputType === "insertLineBreak" || inputType === "insertParagraph") {
      const br = dataLength(event);
      return br == null || br === 0 ? 1 : br;
    }
    const knownInsert =
      inputType === "insertText" ||
      inputType === "insertReplacementText" ||
      inputType === "insertFromAutocomplete" ||
      inputType === "insertFromYank";
    if (knownInsert) {
      const n = dataLength(event);
      if (n != null) return n;
      return growth(tracker, id, event);
    }
    if (!inputType) return growth(tracker, id, event);
    return 0;
  }

  function growth(tracker, id, event) {
    const next = valueLength(event && event.target);
    const prev = tracker.fieldsSnapshot()[id].final_len;
    return Math.max(0, next - prev);
  }

  function bind(doc, tracker) {
    function onPaste(event) {
      const id = fieldId(event.target);
      if (!id) return;
      const el = event.target;
      const plainLen = pastedCharCount(event);
      const before = valueLength(el);
      const selected = selectionSpan(el);
      if (plainLen != null && plainLen > 0) {
        tracker.notePaste(id, plainLen);
        tracker.armSkipTyped(id);
      } else {
        tracker.armPasteMeasure(id, before, selected);
      }
      setTimeout(function () {
        tracker.consumeSkipTyped(id);
        const pending = tracker.takePasteMeasure(id);
        if (!pending) {
          tracker.setFinalLen(id, valueLength(el));
          return;
        }
        const after = valueLength(el);
        let inserted = after - (pending.before - pending.selected);
        if (inserted < 0) inserted = 0;
        tracker.notePaste(id, inserted);
        tracker.setFinalLen(id, after);
      }, 0);
    }

    function onInput(event) {
      const id = fieldId(event.target);
      if (!id) return;
      const inputType = String(event.inputType || "");
      const measuring = tracker.takePasteMeasure(id);
      if (measuring) {
        const after = valueLength(event.target);
        let inserted = after - (measuring.before - measuring.selected);
        if (inserted < 0) inserted = 0;
        tracker.notePaste(id, inserted);
        tracker.setFinalLen(id, after);
        tracker.consumeSkipTyped(id);
        return;
      }
      const skip = tracker.consumeSkipTyped(id);
      if (isPasteInputType(inputType) || skip) {
        if (isPasteInputType(inputType) && !skip) {
          const fromData = dataLength(event);
          const n = fromData == null ? growth(tracker, id, event) : fromData;
          tracker.notePaste(id, n);
        }
        tracker.setFinalLen(id, valueLength(event.target));
        return;
      }
      const add = typedCharsFromInput(tracker, id, event);
      if (add > 0) tracker.noteTyped(id, add);
      tracker.setFinalLen(id, valueLength(event.target));
    }

    function onFocusIn(event) {
      const id = fieldId(event.target);
      if (!id) return;
      tracker.noteFocus(id);
    }

    function onFocusOut(event) {
      const id = fieldId(event.target);
      if (!id) return;
      tracker.noteBlur(id);
    }

    function onCompositionEnd(event) {
      const id = fieldId(event.target);
      if (!id) return;
      tracker.resetComposition(id);
    }

    function onVisibility() {
      if (doc.visibilityState === "hidden") {
        tracker.endAllFocus();
        return;
      }
      const id = fieldId(doc.activeElement);
      if (id) tracker.noteFocus(id);
    }

    doc.addEventListener("paste", onPaste, false);
    doc.addEventListener("input", onInput, false);
    doc.addEventListener("focusin", onFocusIn, false);
    doc.addEventListener("focusout", onFocusOut, false);
    doc.addEventListener("compositionend", onCompositionEnd, false);
    doc.addEventListener("visibilitychange", onVisibility, false);

    return tracker;
  }

  function createBoundTracker(doc, options) {
    const tracker = createTracker(options);
    bind(doc, tracker);
    return tracker;
  }

  return {
    TRACKED_FIELDS: TRACKED_FIELDS,
    FIELD_KEYS: FIELD_KEYS,
    pastedCharCount: pastedCharCount,
    createTracker: createTracker,
    bind: bind,
    createBoundTracker: createBoundTracker,
  };
});
