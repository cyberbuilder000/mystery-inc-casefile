/**
 * Candidate invite deep-link helpers. Read `invite` from the URL and
 * normalize like admin-minted codes. No scores, bands, veto, or keys.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MysteryIncInviteLink = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  /**
   * Trim, drop spaces/dashes/underscores, uppercase.
   * Matches admin blind codes such as P7892.
   */
  function normalizeInviteCode(raw) {
    return String(raw == null ? "" : raw)
      .trim()
      .replace(/[\s\-_]+/g, "")
      .toUpperCase();
  }

  function paramCaseInsensitive(params, name) {
    const want = String(name || "").toLowerCase();
    if (!want || !params) return "";
    try {
      for (const pair of params.entries()) {
        if (String(pair[0]).toLowerCase() === want) {
          return pair[1] == null ? "" : String(pair[1]);
        }
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  function paramsFromQueryString(raw) {
    let s = String(raw == null ? "" : raw);
    if (s.charAt(0) === "#") s = s.slice(1);
    if (s.charAt(0) === "?") s = s.slice(1);
    const qMark = s.indexOf("?");
    if (qMark !== -1) s = s.slice(qMark + 1);
    try {
      return new URLSearchParams(s);
    } catch {
      return new URLSearchParams("");
    }
  }

  function readInviteParam(search, hash) {
    const fromSearch = paramCaseInsensitive(paramsFromQueryString(search), "invite");
    if (fromSearch) return normalizeInviteCode(fromSearch);
    const fromHash = paramCaseInsensitive(paramsFromQueryString(hash), "invite");
    return normalizeInviteCode(fromHash);
  }

  function readInviteFromLocation(loc) {
    const location = loc || (typeof window !== "undefined" ? window.location : null);
    if (!location) return "";
    return readInviteParam(location.search, location.hash);
  }

  return {
    normalizeInviteCode: normalizeInviteCode,
    readInviteParam: readInviteParam,
    readInviteFromLocation: readInviteFromLocation,
  };
});
