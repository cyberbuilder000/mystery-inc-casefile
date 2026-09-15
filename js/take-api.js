/**
 * Public Mystery Inc take client. Dark responses only — never render scores,
 * bands, veto, or keys from the payload.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MysteryIncTakeApi = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const DEFAULT_BASE = "https://hitl-ops-portal.vercel.app";
  const REDEEM_TIMEOUT_MS = 20000;
  const SUBMIT_TIMEOUT_MS = 60000;
  /** Extra attempts after the first failure. Network/timeout only; never 429. */
  const NETWORK_AUTO_RETRIES = 1;

  const USER_MESSAGES = {
    invalid: "That invite code is not valid. Check it and try again.",
    used: "This invite code has already been used.",
    expired: "This invite code has expired. Ask for a new one.",
    already_submitted: "This case file was already received.",
    network: "Network error — check your connection and try again.",
    timeout: "The request timed out. Try again — do not close this page.",
    rate_limited:
      "Too many submit attempts for this code. Wait about 10 minutes or ask admin for a new invite.",
    unavailable: "Could not reach the case-file service. Try again in a moment.",
    unknown: "Could not complete that request. Try again.",
  };

  function apiBase() {
    if (typeof window !== "undefined" && window.location) {
      const host = window.location.hostname;
      if (host === "localhost" || host === "127.0.0.1") {
        try {
          const q = new URLSearchParams(window.location.search).get("hitlApi");
          if (q && /^https?:\/\//i.test(q)) return q.trim().replace(/\/+$/, "");
        } catch {
          /* ignore */
        }
      }
    }
    const raw =
      (typeof window !== "undefined" && window.MYSTERY_INC_HITL_API_BASE) ||
      DEFAULT_BASE;
    return String(raw || DEFAULT_BASE).trim().replace(/\/+$/, "") || DEFAULT_BASE;
  }

  function userMessage(kind) {
    return USER_MESSAGES[kind] || USER_MESSAGES.unknown;
  }

  function blobFromData(data) {
    if (!data || typeof data !== "object") return "";
    const parts = [];
    ["error", "code", "reason", "status", "type", "message"].forEach(function (k) {
      if (typeof data[k] === "string") parts.push(data[k]);
    });
    return parts.join(" ").toLowerCase();
  }

  function classify(status, data, networkFailed) {
    if (networkFailed === "timeout" || networkFailed === "aborted") return "timeout";
    if (networkFailed) return "network";
    if (status === 429) return "rate_limited";
    const blob = blobFromData(data);

    if (/already[_\s-]?submitted|duplicate submit|already received/.test(blob)) {
      return "already_submitted";
    }
    if (
      status === 409 ||
      /invite[_\s-]?used|already[_\s-]?used|already[_\s-]?redeemed|\bused\b|consumed|conflict/.test(blob)
    ) {
      return "used";
    }
    if (status === 410 || /\bexpir/.test(blob)) {
      return "expired";
    }
    if (status === 404) {
      return data ? "invalid" : "unavailable";
    }
    if (status === 401 || status === 403 || status === 400 || status === 422) {
      if (/\b(used|redeemed|consumed)\b/.test(blob)) return "used";
      return "invalid";
    }
    if (status >= 500 && status <= 599) {
      return "unavailable";
    }
    if (/invalid|not[_\s-]?found|unknown|malformed|missing|not open/.test(blob)) {
      return "invalid";
    }
    if (data && (data.ok === false || data.success === false)) {
      return "unknown";
    }
    if (status >= 400) return "unknown";
    return null;
  }

  function TakeError(kind, status) {
    const err = new Error(userMessage(kind));
    err.kind = kind;
    err.status = status || 0;
    return err;
  }

  function isAbortError(err) {
    if (!err) return false;
    if (err.name === "AbortError") return true;
    if (err.code === 20) return true;
    return false;
  }

  function canAutoRetry(err) {
    return !!(err && (err.kind === "network" || err.kind === "timeout"));
  }

  function parseBody(text, contentType) {
    const trimmed = (text || "").trim();
    if (!trimmed) return null;
    const looksJson =
      (contentType && contentType.indexOf("json") !== -1) ||
      trimmed.charAt(0) === "{" ||
      trimmed.charAt(0) === "[";
    if (!looksJson) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  async function postJsonOnce(path, body, timeoutMs) {
    const url = apiBase() + path;
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (err) {
      const aborted =
        isAbortError(err) || (ctrl && ctrl.signal && ctrl.signal.aborted);
      throw TakeError(aborted ? "timeout" : "network", 0);
    } finally {
      if (timer) clearTimeout(timer);
    }

    const text = await res.text();
    const ctype = res.headers && res.headers.get ? res.headers.get("content-type") : "";
    const data = parseBody(text, ctype);
    const kind = classify(res.status, data, false);
    if (kind) throw TakeError(kind, res.status);
    if (data && (data.ok === false || data.success === false)) {
      throw TakeError("unknown", res.status);
    }
    return data || { ok: true };
  }

  async function postJson(path, body, timeoutMs) {
    let lastErr;
    const attempts = 1 + NETWORK_AUTO_RETRIES;
    for (let i = 0; i < attempts; i++) {
      try {
        return await postJsonOnce(path, body, timeoutMs);
      } catch (err) {
        lastErr = err;
        if (!canAutoRetry(err) || i >= NETWORK_AUTO_RETRIES) throw err;
      }
    }
    throw lastErr;
  }

  function redeem(inviteCode) {
    return postJson("/api/mystery-inc/take/redeem", { inviteCode: inviteCode }, REDEEM_TIMEOUT_MS);
  }

  function submit(payload) {
    const body = { inviteCode: payload.inviteCode, answers: payload.answers };
    if (payload.constraints && typeof payload.constraints === "object") {
      body.constraints = payload.constraints;
    }
    return postJson("/api/mystery-inc/take/submit", body, SUBMIT_TIMEOUT_MS);
  }

  return {
    apiBase: apiBase,
    classify: classify,
    userMessage: userMessage,
    redeem: redeem,
    submit: submit,
    REDEEM_TIMEOUT_MS: REDEEM_TIMEOUT_MS,
    SUBMIT_TIMEOUT_MS: SUBMIT_TIMEOUT_MS,
    NETWORK_AUTO_RETRIES: NETWORK_AUTO_RETRIES,
  };
});
