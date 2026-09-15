"use strict";

const assert = require("assert");
const path = require("path");

const INVITE_LINK = path.resolve(__dirname, "../js/invite-link.js");

function load() {
  delete require.cache[INVITE_LINK];
  return require(INVITE_LINK);
}

function run() {
  const api = load();

  assert.strictEqual(api.normalizeInviteCode("P7892"), "P7892");
  assert.strictEqual(api.normalizeInviteCode("  p7892  "), "P7892");
  assert.strictEqual(api.normalizeInviteCode("p-78 92"), "P7892");
  assert.strictEqual(api.normalizeInviteCode("p_7892"), "P7892");
  assert.strictEqual(api.normalizeInviteCode(""), "");
  assert.strictEqual(api.normalizeInviteCode(null), "");
  assert.strictEqual(api.normalizeInviteCode(undefined), "");

  assert.strictEqual(api.readInviteParam("?invite=P7892", ""), "P7892");
  assert.strictEqual(api.readInviteParam("?INVITE=p7892", ""), "P7892");
  assert.strictEqual(api.readInviteParam("?Invite=p-7892", ""), "P7892");
  assert.strictEqual(api.readInviteParam("invite=P7892", ""), "P7892");
  assert.strictEqual(api.readInviteParam("?foo=1&invite=P7892&bar=2", ""), "P7892");
  assert.strictEqual(api.readInviteParam("?hitlApi=http://127.0.0.1:3456&invite=P7892", ""), "P7892");

  assert.strictEqual(api.readInviteParam("", "#invite=P7892"), "P7892");
  assert.strictEqual(api.readInviteParam("", "#?invite=P7892"), "P7892");
  assert.strictEqual(api.readInviteParam("", "#INVITE=p7892"), "P7892");
  assert.strictEqual(api.readInviteParam("", "#/path?invite=P7892"), "P7892");

  // Query string wins over hash.
  assert.strictEqual(api.readInviteParam("?invite=FROMQUERY", "#invite=FROMHASH"), "FROMQUERY");

  // Missing / empty stay empty (do not invent a code).
  assert.strictEqual(api.readInviteParam("", ""), "");
  assert.strictEqual(api.readInviteParam("?invite=", ""), "");
  assert.strictEqual(api.readInviteParam("?code=P7892", ""), "");
  assert.strictEqual(api.readInviteParam("?other=P7892", "#section"), "");

  const fromLoc = api.readInviteFromLocation({
    search: "?Invite= p-7892 ",
    hash: "",
  });
  assert.strictEqual(fromLoc, "P7892");

  console.log("invite-link.test.js: ok");
}

run();
