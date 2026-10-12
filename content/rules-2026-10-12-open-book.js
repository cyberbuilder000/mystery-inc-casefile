/**
 * Canonical candidate-facing session rules.
 * Legal reviews RULES_TEXT in this file. Do not copy these rules into other files.
 * Display version (on the page and in RULES_TEXT): 2026-10-12-open-book-r2
 * Submit payload integrity.rules_version: open-book-v1
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MysteryIncRules = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  /** Candidate-facing / legal display version. Not the submit token. */
  const RULES_VERSION = "2026-10-12-open-book-r2";
  /** integrity.rules_version. The HITL API requires this exact value. */
  const PAYLOAD_RULES_VERSION = "open-book-v1";
  const RULES_HEADING = "Session rules";

  const ATTESTATION_LABEL =
    "I will not use ChatGPT, Grok, Claude, Copilot, Gemini, or similar AI tools to generate or write my answers.";

  const ATTESTATION_HINT =
    "The box is unchecked by default. The case files cannot start until you tick it.";

  const ATTESTATION_BLOCK_MESSAGE =
    "Tick the attestation before starting. The case files cannot start until you confirm you will not use AI tools to generate or write your answers.";

  const DURING_REMINDER =
    "Open book: Google, web searches, references, and your own notes are allowed. AI tools must not generate or write your answers.";

  /** False: the attestation checkbox renders unchecked until the candidate ticks it. */
  const ATTESTATION_DEFAULT_CHECKED = false;

  const RULES_BODY_PARAGRAPHS = [
    "Rules version 2026-10-12-open-book-r2.",
    "This is an open-book case file. Google, web searches, references, and your own notes are allowed. You may look things up while you work.",
    "No direct AI answers. ChatGPT, Grok, Claude, Copilot, Gemini, and similar tools must not generate or write your answers. Do not ask an AI tool to write, rewrite, or complete an answer and then submit that text. What you submit must be your own writing. You may read AI summaries that appear in search results like any other source, but do not copy their text into your answers.",
    "Before you start, tick the attestation. " +
      ATTESTATION_HINT +
      " The attestation is: " +
      ATTESTATION_LABEL,
    "While you work, the page counts how often you paste into each written answer, how many characters were pasted versus typed, the largest single paste, and how long that answer box was active. This covers the open responses on case files C, D, E, F, and G and the optional one-sentence why. It does not record your keystrokes or your clipboard, and it does not block paste. After you submit, your written answers are also checked for patterns that are common in AI-written text. A reviewer may see a note such as 'review'. That note only prompts a person to look; it is not a finding that you broke the rules, and it never changes your score. If a note could affect a decision about you, your administrator will tell you and give you a chance to explain first. If you use dictation, a screen reader, or other assistive tools, tell your administrator before you start. It will not count against you. The counts and notes are deleted one year after the hiring decision.",
    "You will not see a score on this page. Your administrator follows up. There is no speed bonus. Continue when you are done early. Timed case files A through G take about 48 minutes, plus an optional question of about 2 minutes, and a short logistics form that is not timed. Start uses your invite code. Continue locks each finished file. Submit sends your answers at the end.",
    "The invite code is one-time and comes from your administrator. Starting uses it up. If the code is invalid, already used, or expired, stop and message them. Do not use Practice for a real hiring session. Practice never counts and never reaches hiring. Practice follows these same rules, including the attestation.",
    "You cannot return to a finished case file. Do not refresh during a live run. Inventing facts you were not given does not help you.",
    "During the case files, a reminder stays on screen: " + DURING_REMINDER,
  ];

  const RULES_PARAGRAPHS = [RULES_HEADING].concat(RULES_BODY_PARAGRAPHS);
  const RULES_TEXT = RULES_PARAGRAPHS.join("\n\n");

  function evaluateStartGate(attestedChecked) {
    if (attestedChecked === true) return { ok: true, message: "" };
    return { ok: false, message: ATTESTATION_BLOCK_MESSAGE };
  }

  return {
    RULES_VERSION: RULES_VERSION,
    PAYLOAD_RULES_VERSION: PAYLOAD_RULES_VERSION,
    RULES_HEADING: RULES_HEADING,
    RULES_BODY_PARAGRAPHS: RULES_BODY_PARAGRAPHS,
    RULES_PARAGRAPHS: RULES_PARAGRAPHS,
    RULES_TEXT: RULES_TEXT,
    ATTESTATION_LABEL: ATTESTATION_LABEL,
    ATTESTATION_HINT: ATTESTATION_HINT,
    ATTESTATION_BLOCK_MESSAGE: ATTESTATION_BLOCK_MESSAGE,
    ATTESTATION_DEFAULT_CHECKED: ATTESTATION_DEFAULT_CHECKED,
    DURING_REMINDER: DURING_REMINDER,
    evaluateStartGate: evaluateStartGate,
  };
});
