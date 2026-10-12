"use strict";

const assert = require("assert");
const path = require("path");

const TAKE_API = path.resolve(__dirname, "../js/take-api.js");

function loadApi() {
  delete require.cache[TAKE_API];
  return require(TAKE_API);
}

function jsonResponse(status, data) {
  return {
    status: status,
    headers: { get: function () { return "application/json"; } },
    text: async function () {
      return data == null ? "" : JSON.stringify(data);
    },
  };
}

function abortError() {
  const err = new Error("The operation was aborted.");
  err.name = "AbortError";
  return err;
}

async function throwsKind(fn, kind, status) {
  try {
    await fn();
  } catch (err) {
    assert.strictEqual(err.kind, kind, "kind");
    if (status !== undefined) assert.strictEqual(err.status, status, "status");
    return err;
  }
  assert.fail("expected throw kind=" + kind);
}

async function run() {
  const api = loadApi();
  const integrityOk = {
    rules_version: "display-version-must-not-be-sent",
    attested_no_ai: true,
    attested_at: "2026-10-12T15:04:05.000Z",
    fields: {},
  };

  assert.strictEqual(api.SUBMIT_TIMEOUT_MS, 60000);
  assert.strictEqual(api.REDEEM_TIMEOUT_MS, 20000);
  assert.strictEqual(api.NETWORK_AUTO_RETRIES, 1);

  assert.strictEqual(api.INTEGRITY_RULES_VERSION, "open-book-v1");
  assert.strictEqual(api.classify(400, { error: "attestation_required" }, false), "attestation_required");
  assert.strictEqual(api.classify(400, { code: "attestation_required" }, false), "attestation_required");
  assert.strictEqual(api.classify(400, "attestation_required", false), "attestation_required");
  assert.strictEqual(api.classify(400, { error: "malformed invite" }, false), "invalid");
  assert.strictEqual(api.classify(429, { error: "submit code limit" }, false), "rate_limited");
  assert.strictEqual(api.classify(429, null, false), "rate_limited");
  assert.strictEqual(api.classify(503, { error: "boom" }, false), "unavailable");
  assert.strictEqual(api.classify(0, null, true), "network");
  assert.strictEqual(api.classify(0, null, "timeout"), "timeout");
  assert.strictEqual(api.classify(0, null, "aborted"), "timeout");

  const attestMsg = api.userMessage("attestation_required");
  assert.match(attestMsg, /no-AI attestation is required/i);
  assert.match(attestMsg, /Start over/i);
  assert.match(attestMsg, /AI tools/i);
  assert.doesNotMatch(attestMsg, /invite code is not valid/i);
  assert.doesNotMatch(attestMsg, /open-book-v1/);

  const rateMsg = api.userMessage("rate_limited");
  assert.match(rateMsg, /Too many submit attempts/i);
  assert.match(rateMsg, /10 minutes/i);
  const timeoutMsg = api.userMessage("timeout");
  assert.match(timeoutMsg, /timed out/i);
  assert.match(timeoutMsg, /try again/i);
  assert.doesNotMatch(timeoutMsg, /^Network error/i);

  // 429 must not auto-retry (would burn the submit-code limiter).
  let calls = 0;
  const timeoutDelays = [];
  const realSetTimeout = setTimeout;
  global.setTimeout = function (fn, ms) {
    timeoutDelays.push(ms);
    return realSetTimeout(fn, ms);
  };
  global.fetch = async function () {
    calls += 1;
    return jsonResponse(429, { error: "submit code limit" });
  };
  const rateErr = await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: { A: "n/a" }, integrity: integrityOk });
  }, "rate_limited", 429);
  global.setTimeout = realSetTimeout;
  assert.strictEqual(calls, 1, "429 must not be retried");
  assert.ok(timeoutDelays.indexOf(60000) !== -1, "submit abort timer is 60s");
  assert.match(rateErr.message, /Too many submit attempts/i);

  timeoutDelays.length = 0;
  global.setTimeout = function (fn, ms) {
    timeoutDelays.push(ms);
    return realSetTimeout(fn, ms);
  };
  let lastBody = null;
  global.fetch = async function (_url, opts) {
    lastBody = JSON.parse(opts.body);
    return jsonResponse(200, { ok: true });
  };
  await api.redeem("X1");
  global.setTimeout = realSetTimeout;
  assert.ok(timeoutDelays.indexOf(20000) !== -1, "redeem abort timer stays 20s");
  assert.strictEqual(api.normalizeInviteCode(" p-7892 "), "P7892");
  lastBody = null;
  global.fetch = async function (_url, opts) {
    lastBody = JSON.parse(opts.body);
    return jsonResponse(200, { ok: true });
  };
  await api.redeem(" p-7892 ");
  assert.strictEqual(lastBody.inviteCode, "P7892");
  lastBody = null;
  global.fetch = async function (_url, opts) {
    lastBody = JSON.parse(opts.body);
    return jsonResponse(200, { ok: true });
  };
  await api.submit({ inviteCode: " p_78 92 ", answers: {}, integrity: integrityOk });
  assert.strictEqual(lastBody.inviteCode, "P7892");

  // Network: one auto-retry, then succeed.
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    if (calls === 1) throw new TypeError("Failed to fetch");
    return jsonResponse(200, { ok: true });
  };
  const ok = await api.submit({ inviteCode: "X1", answers: {}, integrity: integrityOk });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(calls, 2, "network gets exactly one retry");

  // Network: cap at one retry (two attempts total), then surface network.
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    throw new TypeError("Failed to fetch");
  };
  await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {}, integrity: integrityOk });
  }, "network", 0);
  assert.strictEqual(calls, 2, "network retry cap is 1");

  // Abort/timeout is not labeled as a generic network error; still retryable once.
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    throw abortError();
  };
  const timeoutErr = await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {}, integrity: integrityOk });
  }, "timeout", 0);
  assert.strictEqual(calls, 2, "timeout gets exactly one retry");
  assert.match(timeoutErr.message, /timed out/i);
  assert.doesNotMatch(timeoutErr.message, /^Network error/i);

  // Timeout then 429: second response must not trigger further retries.
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    if (calls === 1) throw abortError();
    return jsonResponse(429, { error: "submit code limit" });
  };
  await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {}, integrity: integrityOk });
  }, "rate_limited", 429);
  assert.strictEqual(calls, 2, "stop after 429; do not keep retrying");

  // Redeem uses the same no-retry-429 rule.
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    return jsonResponse(429, { error: "rate limit" });
  };
  await throwsKind(function () {
    return api.redeem("X1");
  }, "rate_limited", 429);
  assert.strictEqual(calls, 1);

  const integrity = {
    rules_version: "2026-10-12-open-book",
    attested_no_ai: true,
    attested_at: "2026-10-12T15:04:05.000Z",
    fields: {
      c1: { paste_events: 1, pasted_chars: 4, typed_chars: 2, max_single_paste: 4, active_ms: 10, final_len: 6 },
      d2: { paste_events: 0, pasted_chars: 0, typed_chars: 0, max_single_paste: 0, active_ms: 0, final_len: 0 },
      e1: { paste_events: 0, pasted_chars: 0, typed_chars: 3, max_single_paste: 0, active_ms: 5, final_len: 3 },
      f3: { paste_events: 0, pasted_chars: 0, typed_chars: 0, max_single_paste: 0, active_ms: 0, final_len: 0 },
      g3: { paste_events: 2, pasted_chars: 8, typed_chars: 1, max_single_paste: 5, active_ms: 20, final_len: 9 },
      soft_why: { paste_events: 0, pasted_chars: 0, typed_chars: 7, max_single_paste: 0, active_ms: 4, final_len: 7 },
    },
  };

  lastBody = null;
  global.fetch = async function (_url, opts) {
    lastBody = JSON.parse(opts.body);
    return jsonResponse(200, { ok: true });
  };
  const wireIntegrity = Object.assign({}, integrity, { rules_version: "open-book-v1" });
  await api.submit({
    inviteCode: "X1",
    answers: { c1: "abcdef" },
    constraints: { hours: "3" },
    integrity: integrity,
  });
  assert.deepStrictEqual(lastBody, {
    inviteCode: "X1",
    answers: { c1: "abcdef" },
    constraints: { hours: "3" },
    integrity: wireIntegrity,
  });
  assert.strictEqual(lastBody.integrity.rules_version, "open-book-v1");
  assert.notStrictEqual(integrity.rules_version, "open-book-v1");

  calls = 0;
  global.fetch = async function () {
    calls += 1;
    return jsonResponse(200, { ok: true });
  };
  await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {} });
  }, "attestation_required", 0);
  assert.strictEqual(calls, 0, "missing integrity must not be posted");
  await throwsKind(function () {
    return api.submit({
      inviteCode: "X1",
      answers: {},
      integrity: Object.assign({}, integrityOk, { attested_no_ai: false }),
    });
  }, "attestation_required", 0);
  assert.strictEqual(calls, 0, "attested_no_ai false must not be posted");

  calls = 0;
  global.fetch = async function () {
    calls += 1;
    return jsonResponse(400, { error: "attestation_required" });
  };
  const attestErr = await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {}, integrity: integrityOk });
  }, "attestation_required", 400);
  assert.strictEqual(calls, 1, "400 attestation_required must not be retried");
  assert.match(attestErr.message, /no-AI attestation is required/i);
  assert.match(attestErr.message, /Start over/i);
  assert.doesNotMatch(attestErr.message, /invite code is not valid/i);

  calls = 0;
  let rateBody = null;
  global.fetch = async function (_url, opts) {
    calls += 1;
    rateBody = JSON.parse(opts.body);
    return jsonResponse(429, { error: "submit code limit" });
  };
  await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {}, integrity: integrity });
  }, "rate_limited", 429);
  assert.strictEqual(calls, 1, "429 with integrity still must not be retried");
  assert.deepStrictEqual(rateBody.integrity, wireIntegrity);
  assert.strictEqual(rateBody.integrity.rules_version, "open-book-v1");

  timeoutDelays.length = 0;
  global.setTimeout = function (fn, ms) {
    timeoutDelays.push(ms);
    return realSetTimeout(fn, ms);
  };
  global.fetch = async function () {
    return jsonResponse(200, { ok: true });
  };
  await api.submit({ inviteCode: "X1", answers: {}, integrity: integrity });
  global.setTimeout = realSetTimeout;
  assert.ok(timeoutDelays.indexOf(60000) !== -1, "integrity submit keeps the 60s abort timer");

  // 5xx is unavailable and is not auto-retried (only network/timeout).
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    return jsonResponse(502, { error: "bad gateway" });
  };
  await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {}, integrity: integrityOk });
  }, "unavailable", 502);
  assert.strictEqual(calls, 1, "5xx must not auto-retry");

  console.log("take-api.test.js: ok");
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
