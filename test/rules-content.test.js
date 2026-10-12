"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const RULES_PATH = path.join(ROOT, "content/rules-2026-10-12-open-book.js");

function loadRules() {
  delete require.cache[RULES_PATH];
  return require(RULES_PATH);
}

function run() {
  const rules = loadRules();
  const text = rules.RULES_TEXT;

  const aiParagraph =
    "No direct AI answers. ChatGPT, Grok, Claude, Copilot, Gemini, and similar tools must not generate or write your answers. Do not ask an AI tool to write, rewrite, or complete an answer and then submit that text. What you submit must be your own writing. You may read AI summaries that appear in search results like any other source, but do not copy their text into your answers.";
  const countsParagraph =
    "While you work, the page counts how often you paste into each written answer, how many characters were pasted versus typed, the largest single paste, and how long that answer box was active. This covers the open responses on case files C, D, E, F, and G and the optional one-sentence why. It does not record your keystrokes or your clipboard, and it does not block paste. After you submit, your written answers are also checked for patterns that are common in AI-written text. A reviewer may see a note such as 'review'. That note only prompts a person to look; it is not a finding that you broke the rules, and it never changes your score. If a note could affect a decision about you, your administrator will tell you and give you a chance to explain first. If you use dictation, a screen reader, or other assistive tools, tell your administrator before you start. It will not count against you. The counts and notes are deleted one year after the hiring decision.";

  assert.strictEqual(rules.RULES_VERSION, "2026-10-12-open-book-r2");
  assert.strictEqual(rules.PAYLOAD_RULES_VERSION, "open-book-v1");
  assert.ok(!text.includes("open-book-v1"));
  assert.strictEqual(rules.ATTESTATION_DEFAULT_CHECKED, false);
  assert.strictEqual(text, rules.RULES_PARAGRAPHS.join("\n\n"));
  assert.strictEqual(rules.RULES_PARAGRAPHS[0], rules.RULES_HEADING);
  assert.ok(text.startsWith("Session rules\n\nRules version 2026-10-12-open-book-r2."));
  assert.strictEqual(rules.RULES_BODY_PARAGRAPHS[2], aiParagraph);
  assert.strictEqual(rules.RULES_BODY_PARAGRAPHS[4], countsParagraph);

  assert.ok(text.includes("Google, web searches, references, and your own notes are allowed."));
  assert.ok(text.includes("No direct AI answers."));
  assert.ok(text.includes("ChatGPT, Grok, Claude, Copilot, Gemini, and similar tools must not generate or write your answers."));
  assert.ok(text.includes(rules.ATTESTATION_LABEL));
  assert.ok(text.includes(rules.ATTESTATION_HINT));
  assert.ok(text.includes(rules.DURING_REMINDER));
  assert.ok(text.includes(countsParagraph));
  assert.ok(text.includes("You may read AI summaries that appear in search results like any other source, but do not copy their text into your answers."));

  assert.ok(!/no web search/i.test(text));
  assert.ok(!/no phones/i.test(text));
  assert.ok(!/unless your administrator says otherwise/i.test(text));

  assert.strictEqual(rules.evaluateStartGate(true).ok, true);
  assert.strictEqual(rules.evaluateStartGate(false).ok, false);
  assert.strictEqual(rules.evaluateStartGate(undefined).ok, false);
  assert.strictEqual(rules.evaluateStartGate("true").ok, false);
  assert.strictEqual(rules.evaluateStartGate(1).ok, false);
  assert.match(rules.evaluateStartGate(false).message, /cannot start/i);
  assert.match(rules.evaluateStartGate(false).message, /AI tools/i);

  const app = fs.readFileSync(path.join(ROOT, "js/app.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");

  assert.ok(!/no web search/i.test(app));
  assert.ok(!/no phones/i.test(app));
  assert.ok(!app.includes("autoRedeem"));
  assert.ok(!app.includes("ChatGPT"), "AI tool names stay in the rules file");
  assert.ok(!app.includes("2026-10-12-open-book"), "rules version stays in the content file");
  assert.ok(app.includes("PAYLOAD_RULES_VERSION"));
  assert.ok(!app.includes("open-book-v1"));
  assert.ok(app.includes("evaluateStartGate"));
  assert.ok(app.includes("integrity: state.integrityPayload"));
  assert.ok(app.includes('id="attestNoAi"'));
  assert.ok(!/id="attestNoAi"[^>\n]*\bchecked\b/.test(app));
  assert.match(app, /state\.attestedNoAi === true \? " checked" : ""/);
  assert.match(app, /id="btnStart"\$\{startDisabled\}/);
  assert.match(app, /id="btnPractice"\$\{practiceDisabled\}/);
  assert.ok(app.includes("RULES_BODY_PARAGRAPHS"));
  assert.ok(app.includes("DURING_REMINDER"));

  assert.ok(html.indexOf("content/rules-2026-10-12-open-book.js") < html.indexOf("js/app.js"));
  assert.ok(html.indexOf("js/answer-integrity.js") < html.indexOf("js/app.js"));

  assert.ok(readme.includes("content/rules-2026-10-12-open-book.js"));
  assert.ok(readme.includes("rules_version"));
  assert.ok(readme.includes("does not auto-redeem"));
  assert.ok(!/no web search/i.test(readme));

  console.log("rules-content.test.js: ok");
}

run();
