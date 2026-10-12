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

  assert.strictEqual(rules.RULES_VERSION, "2026-10-12-open-book");
  assert.strictEqual(rules.ATTESTATION_DEFAULT_CHECKED, false);
  assert.strictEqual(text, rules.RULES_PARAGRAPHS.join("\n\n"));
  assert.strictEqual(rules.RULES_PARAGRAPHS[0], rules.RULES_HEADING);
  assert.ok(text.startsWith("Session rules\n\nRules version 2026-10-12-open-book."));

  assert.ok(text.includes("Google, web searches, references, and your own notes are allowed."));
  assert.ok(text.includes("No direct AI answers."));
  assert.ok(text.includes("ChatGPT, Grok, Claude, Copilot, Gemini, and similar tools must not generate or write your answers."));
  assert.ok(text.includes(rules.ATTESTATION_LABEL));
  assert.ok(text.includes(rules.ATTESTATION_HINT));
  assert.ok(text.includes(rules.DURING_REMINDER));
  assert.ok(
    text.includes(
      "The page counts paste events and how many characters are pasted versus typed in each written answer, and how long is spent."
    )
  );
  assert.ok(text.includes("It does not record keystrokes or clipboard contents."));
  assert.ok(text.includes("Any flag is advisory only, for a human reviewer, and never changes the score."));
  assert.ok(text.includes("The page does not block paste."));
  assert.ok(text.includes("case files C, D, E, F, and G"));
  assert.ok(text.includes("optional one-sentence why"));

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
