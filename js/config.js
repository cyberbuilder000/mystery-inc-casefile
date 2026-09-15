/**
 * HITL public take API base (candidate app → redeem/submit only).
 *
 * Staging (default): https://hitl-ops-portal.vercel.app
 * Production: set this constant to the prod origin when it exists, or assign
 *   window.MYSTERY_INC_HITL_API_BASE
 * before this script (e.g. a local index override). Do not point the live
 * Pages app at a host candidates should not use.
 *
 * Trailing slashes are stripped by the take client.
 */
window.MYSTERY_INC_HITL_API_BASE =
  window.MYSTERY_INC_HITL_API_BASE || "https://hitl-ops-portal.vercel.app";
