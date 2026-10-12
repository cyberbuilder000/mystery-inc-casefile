"use strict";

const assert = require("assert");
const path = require("path");

const INTEGRITY = path.resolve(__dirname, "../js/answer-integrity.js");
const RULES = path.resolve(__dirname, "../content/rules-2026-10-12-open-book.js");

function load() {
  delete require.cache[RULES];
  delete require.cache[INTEGRITY];
  return {
    rules: require(RULES),
    api: require(INTEGRITY),
  };
}

function field(name, value) {
  const el = {
    name: name,
    value: value == null ? "" : value,
    selectionStart: 0,
    selectionEnd: 0,
    getAttribute: function (attr) {
      return attr === "name" ? name : null;
    },
  };
  el.selectionStart = el.value.length;
  el.selectionEnd = el.value.length;
  return el;
}

function fakeDoc() {
  const listeners = {};
  const doc = {
    visibilityState: "visible",
    activeElement: null,
    listenerTypes: [],
    addEventListener: function (type, fn) {
      doc.listenerTypes.push(type);
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    dispatch: function (type, event) {
      (listeners[type] || []).forEach(function (fn) {
        fn(event);
      });
    },
  };
  return doc;
}

function keysOf(row) {
  return Object.keys(row);
}

const FIELD_KEYS = [
  "paste_events",
  "pasted_chars",
  "typed_chars",
  "max_single_paste",
  "active_ms",
  "final_len",
];

function assertFieldShape(row) {
  assert.deepStrictEqual(keysOf(row), FIELD_KEYS);
  FIELD_KEYS.forEach(function (key) {
    assert.strictEqual(typeof row[key], "number");
    assert.ok(row[key] >= 0);
  });
}

function tick() {
  return new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
}

async function run() {
  const loaded = load();
  const api = loaded.api;
  const rules = loaded.rules;

  assert.deepStrictEqual(api.TRACKED_FIELDS, ["c1", "d2", "e1", "f3", "g3", "soft_why"]);

  const clip = "ZZ-CLIP-9912";
  assert.strictEqual(
    api.pastedCharCount({
      clipboardData: {
        getData: function (kind) {
          assert.strictEqual(kind, "text/plain");
          return clip;
        },
      },
    }),
    clip.length
  );
  assert.strictEqual(api.pastedCharCount({ clipboardData: { getData: function () { return ""; } } }), 0);
  assert.strictEqual(api.pastedCharCount({ clipboardData: { getData: function () { throw new Error("denied"); } } }), null);
  assert.strictEqual(api.pastedCharCount({}), null);
  assert.strictEqual(api.pastedCharCount({ clipboardData: { getData: function () { return 12; } } }), null);
  assert.strictEqual(api.lastClipboard, undefined);

  const tracker = api.createTracker();
  tracker.notePaste("c1", 3);
  tracker.notePaste("c1", 10);
  tracker.notePaste("c1", 4);
  tracker.noteTyped("c1", 2);
  tracker.noteTyped("c1", 1);
  tracker.noteTyped("c1", -5);
  tracker.noteTyped("c1", NaN);
  tracker.notePaste("b3", 99);
  tracker.noteTyped("not-a-field", 8);
  const c1 = tracker.fieldsSnapshot().c1;
  assert.strictEqual(c1.paste_events, 3);
  assert.strictEqual(c1.pasted_chars, 17);
  assert.strictEqual(c1.max_single_paste, 10);
  assert.strictEqual(c1.typed_chars, 3);
  assert.deepStrictEqual(Object.keys(tracker.fieldsSnapshot()), api.TRACKED_FIELDS);
  assert.strictEqual(tracker.fieldsSnapshot().b3, undefined);
  assert.ok(!JSON.stringify(tracker.fieldsSnapshot()).includes("b3"));

  tracker.noteFocus("e1", 0);
  tracker.noteFocus("e1", 50);
  tracker.noteBlur("e1", 80);
  assert.strictEqual(tracker.fieldsSnapshot().e1.active_ms, 80);

  tracker.noteFocus("f3", 0);
  tracker.endAllFocus(40);
  tracker.noteBlur("f3", 90);
  assert.strictEqual(tracker.fieldsSnapshot().f3.active_ms, 40);

  tracker.noteFocus("g3", 100);
  tracker.noteBlur("g3", 50);
  assert.strictEqual(tracker.fieldsSnapshot().g3.active_ms, 0);

  tracker.notePaste("d2", 0);
  assert.strictEqual(tracker.fieldsSnapshot().d2.paste_events, 1);
  assert.strictEqual(tracker.fieldsSnapshot().d2.pasted_chars, 0);
  assert.strictEqual(tracker.fieldsSnapshot().d2.max_single_paste, 0);

  const secretAnswer = "ANSWER-SECRET-7781";
  const payload = tracker.buildPayload({
    attestedNoAi: true,
    attestedAt: "2026-10-12T15:04:05.000Z",
    answers: {
      c1: "hello",
      soft_why: "because",
      b3: secretAnswer,
      e1: "",
    },
  });
  assert.deepStrictEqual(Object.keys(payload), [
    "rules_version",
    "attested_no_ai",
    "attested_at",
    "fields",
  ]);
  assert.strictEqual(rules.RULES_VERSION, "2026-10-12-open-book-r2");
  assert.strictEqual(rules.PAYLOAD_RULES_VERSION, "open-book-v1");
  assert.strictEqual(payload.rules_version, "open-book-v1");
  assert.notStrictEqual(payload.rules_version, rules.RULES_VERSION);
  assert.strictEqual(payload.attested_no_ai, true);
  assert.strictEqual(payload.attested_at, "2026-10-12T15:04:05.000Z");
  assert.deepStrictEqual(Object.keys(payload.fields), api.TRACKED_FIELDS);
  api.TRACKED_FIELDS.forEach(function (id) {
    assertFieldShape(payload.fields[id]);
  });
  assert.strictEqual(payload.fields.c1.final_len, 5);
  assert.strictEqual(payload.fields.soft_why.final_len, "because".length);
  assert.strictEqual(payload.fields.e1.final_len, 0);
  assert.strictEqual(payload.fields.d2.final_len, 0);
  assert.strictEqual(payload.fields.c1.pasted_chars, 17);
  const packed = JSON.stringify(payload);
  assert.ok(!packed.includes(secretAnswer));
  assert.ok(!packed.includes("hello"));
  assert.ok(!packed.includes("because"));
  assert.ok(!packed.includes(clip));

  await assert.rejects(
    async function () {
      tracker.buildPayload({ attestedNoAi: false, attestedAt: "2026-10-12T15:04:05.000Z", answers: {} });
    },
    function (err) {
      assert.strictEqual(err.kind, "attestation_required");
      return true;
    }
  );
  await assert.rejects(async function () {
    tracker.buildPayload({ attestedNoAi: true, attestedAt: "", answers: {} });
  });

  let t = 1000;
  const doc = fakeDoc();
  const bound = api.createTracker({
    now: function () {
      return t;
    },
  });
  api.bind(doc, bound);
  assert.ok(!doc.listenerTypes.includes("keydown"));
  assert.ok(!doc.listenerTypes.includes("keypress"));
  assert.ok(!doc.listenerTypes.includes("keyup"));
  assert.deepStrictEqual(doc.listenerTypes, [
    "paste",
    "input",
    "focusin",
    "focusout",
    "compositionend",
    "visibilitychange",
  ]);

  const c1el = field("c1", "");
  let prevented = false;
  const seenKinds = [];
  doc.dispatch("paste", {
    target: c1el,
    preventDefault: function () {
      prevented = true;
    },
    clipboardData: {
      getData: function (kind) {
        seenKinds.push(kind);
        return clip;
      },
    },
  });
  c1el.value = clip;
  doc.dispatch("input", {
    target: c1el,
    inputType: "insertFromPaste",
    data: clip,
  });
  assert.strictEqual(prevented, false);
  assert.deepStrictEqual(seenKinds, ["text/plain"]);
  assert.strictEqual(bound.fieldsSnapshot().c1.paste_events, 1);
  assert.strictEqual(bound.fieldsSnapshot().c1.pasted_chars, clip.length);
  assert.strictEqual(bound.fieldsSnapshot().c1.max_single_paste, clip.length);
  assert.strictEqual(bound.fieldsSnapshot().c1.typed_chars, 0);
  assert.strictEqual(bound.fieldsSnapshot().c1.final_len, clip.length);
  assert.ok(!JSON.stringify(bound.fieldsSnapshot()).includes(clip));

  await tick();
  assert.strictEqual(bound.fieldsSnapshot().c1.paste_events, 1);
  assert.strictEqual(bound.fieldsSnapshot().c1.typed_chars, 0);

  c1el.value = clip + "Q";
  doc.dispatch("input", {
    target: c1el,
    inputType: "insertText",
    data: "Q",
  });
  assert.strictEqual(bound.fieldsSnapshot().c1.typed_chars, 1);
  assert.strictEqual(bound.fieldsSnapshot().c1.pasted_chars, clip.length);
  assert.strictEqual(bound.fieldsSnapshot().c1.final_len, clip.length + 1);

  const typedSecret = "QQ-TYPE-4481";
  c1el.value = clip + "Q" + typedSecret;
  doc.dispatch("input", {
    target: c1el,
    inputType: "insertText",
    data: typedSecret,
  });
  assert.strictEqual(bound.fieldsSnapshot().c1.typed_chars, 1 + typedSecret.length);
  assert.ok(!JSON.stringify(bound.fieldsSnapshot()).includes(typedSecret));

  const b3 = field("b3", "");
  doc.dispatch("paste", {
    target: b3,
    clipboardData: { getData: function () { return "IGNORE-ME"; } },
  });
  doc.dispatch("input", { target: b3, inputType: "insertText", data: "nope" });
  assert.ok(!JSON.stringify(bound.fieldsSnapshot()).includes("IGNORE-ME"));
  assert.strictEqual(bound.fieldsSnapshot().c1.paste_events, 1);

  const soft = field("soft_why", "");
  doc.activeElement = soft;
  doc.dispatch("focusin", { target: soft });
  t = 1600;
  doc.dispatch("focusout", { target: soft });
  assert.strictEqual(bound.fieldsSnapshot().soft_why.active_ms, 600);

  t = 2000;
  doc.activeElement = soft;
  doc.dispatch("focusin", { target: soft });
  t = 2500;
  doc.visibilityState = "hidden";
  doc.dispatch("visibilitychange", {});
  assert.strictEqual(bound.fieldsSnapshot().soft_why.active_ms, 1100);
  t = 9000;
  doc.visibilityState = "visible";
  doc.dispatch("visibilitychange", {});
  t = 9100;
  doc.dispatch("focusout", { target: soft });
  assert.strictEqual(bound.fieldsSnapshot().soft_why.active_ms, 1200);

  const g3 = field("g3", "");
  g3.selectionStart = 0;
  g3.selectionEnd = 0;
  doc.dispatch("paste", {
    target: g3,
    clipboardData: {
      getData: function () {
        throw new Error("denied");
      },
    },
  });
  g3.value = "abcd";
  await tick();
  assert.strictEqual(bound.fieldsSnapshot().g3.paste_events, 1);
  assert.strictEqual(bound.fieldsSnapshot().g3.pasted_chars, 4);
  assert.strictEqual(bound.fieldsSnapshot().g3.max_single_paste, 4);
  assert.strictEqual(bound.fieldsSnapshot().g3.typed_chars, 0);

  const replaced = field("e1", "HELLO");
  replaced.selectionStart = 0;
  replaced.selectionEnd = 5;
  doc.dispatch("paste", {
    target: replaced,
    clipboardData: {
      getData: function () {
        throw new Error("denied");
      },
    },
  });
  replaced.value = "yo";
  await tick();
  assert.strictEqual(bound.fieldsSnapshot().e1.paste_events, 1);
  assert.strictEqual(bound.fieldsSnapshot().e1.pasted_chars, 2);
  assert.strictEqual(bound.fieldsSnapshot().e1.typed_chars, 0);

  const grown = field("f3", "");
  grown.value = "ab";
  doc.dispatch("input", { target: grown, inputType: "insertText", data: null });
  assert.strictEqual(bound.fieldsSnapshot().f3.typed_chars, 2);
  assert.strictEqual(bound.fieldsSnapshot().f3.final_len, 2);

  grown.value = "ab\n";
  doc.dispatch("input", { target: grown, inputType: "insertLineBreak", data: null });
  assert.strictEqual(bound.fieldsSnapshot().f3.typed_chars, 3);

  const comp = field("d2", "");
  comp.value = "n";
  doc.dispatch("input", { target: comp, inputType: "insertCompositionText", data: "n" });
  comp.value = "ni";
  doc.dispatch("input", { target: comp, inputType: "insertCompositionText", data: "ni" });
  assert.strictEqual(bound.fieldsSnapshot().d2.typed_chars, 2);
  doc.dispatch("compositionend", { target: comp });
  comp.value = "nix";
  doc.dispatch("input", { target: comp, inputType: "insertText", data: "x" });
  assert.strictEqual(bound.fieldsSnapshot().d2.typed_chars, 3);
  assert.strictEqual(bound.fieldsSnapshot().d2.paste_events, 0);

  bound.reset();
  api.TRACKED_FIELDS.forEach(function (id) {
    const row = bound.fieldsSnapshot()[id];
    assert.strictEqual(row.paste_events, 0);
    assert.strictEqual(row.pasted_chars, 0);
    assert.strictEqual(row.typed_chars, 0);
    assert.strictEqual(row.active_ms, 0);
    assert.strictEqual(row.final_len, 0);
  });

  console.log("answer-integrity.test.js: ok");
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
