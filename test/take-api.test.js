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

  assert.strictEqual(api.SUBMIT_TIMEOUT_MS, 60000);
  assert.strictEqual(api.REDEEM_TIMEOUT_MS, 20000);
  assert.strictEqual(api.NETWORK_AUTO_RETRIES, 1);

  assert.strictEqual(api.classify(429, { error: "submit code limit" }, false), "rate_limited");
  assert.strictEqual(api.classify(429, null, false), "rate_limited");
  assert.strictEqual(api.classify(503, { error: "boom" }, false), "unavailable");
  assert.strictEqual(api.classify(0, null, true), "network");
  assert.strictEqual(api.classify(0, null, "timeout"), "timeout");
  assert.strictEqual(api.classify(0, null, "aborted"), "timeout");

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
    return api.submit({ inviteCode: "X1", answers: { A: "n/a" } });
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
  await api.submit({ inviteCode: " p_78 92 ", answers: {} });
  assert.strictEqual(lastBody.inviteCode, "P7892");

  // Network: one auto-retry, then succeed.
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    if (calls === 1) throw new TypeError("Failed to fetch");
    return jsonResponse(200, { ok: true });
  };
  const ok = await api.submit({ inviteCode: "X1", answers: {} });
  assert.strictEqual(ok.ok, true);
  assert.strictEqual(calls, 2, "network gets exactly one retry");

  // Network: cap at one retry (two attempts total), then surface network.
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    throw new TypeError("Failed to fetch");
  };
  await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {} });
  }, "network", 0);
  assert.strictEqual(calls, 2, "network retry cap is 1");

  // Abort/timeout is not labeled as a generic network error; still retryable once.
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    throw abortError();
  };
  const timeoutErr = await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {} });
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
    return api.submit({ inviteCode: "X1", answers: {} });
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

  // 5xx is unavailable and is not auto-retried (only network/timeout).
  calls = 0;
  global.fetch = async function () {
    calls += 1;
    return jsonResponse(502, { error: "bad gateway" });
  };
  await throwsKind(function () {
    return api.submit({ inviteCode: "X1", answers: {} });
  }, "unavailable", 502);
  assert.strictEqual(calls, 1, "5xx must not auto-retry");

  console.log("take-api.test.js: ok");
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
