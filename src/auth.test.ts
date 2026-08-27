import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { deriveClientToken } from "./auth.js";

test("derives the documented client bearer token", () => {
  const expected = createHash("sha256")
    .update("admin:correct horse battery staple")
    .digest("hex");

  assert.equal(
    deriveClientToken("admin", "correct horse battery staple"),
    expected
  );
  assert.match(expected, /^[a-f0-9]{64}$/);
});
