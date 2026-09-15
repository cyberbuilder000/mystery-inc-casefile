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
  const TIMEOUT_MS = 20000;

  const USER_MESSAGES = {
    invalid: "That invite code is not valid. Check it and try again.",
    used: "This invite code has already been used.",
    expired: "This invite code has expired. Ask for a new one.",
    already_submitted: "This case file was already received.",
    network: "Network error — check your connection and try again.",
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
    if (networkFailed) return "network";
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
    if (status === 429 || (status >= 500 && status <= 599)) {
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

  async function postJson(path, body) {
    const url = apiBase() + path;
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
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
    } catch {
      throw TakeError("network", 0);
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

  function redeem(inviteCode) {
    return postJson("/api/mystery-inc/take/redeem", { inviteCode: inviteCode });
  }

  function submit(payload) {
    const body = { inviteCode: payload.inviteCode, answers: payload.answers };
    if (payload.constraints && typeof payload.constraints === "object") {
      body.constraints = payload.constraints;
    }
    return postJson("/api/mystery-inc/take/submit", body);
  }

  return {
    apiBase: apiBase,
    classify: classify,
    userMessage: userMessage,
    redeem: redeem,
    submit: submit,
  };
});
