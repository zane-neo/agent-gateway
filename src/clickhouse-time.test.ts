import assert from "node:assert/strict";
import test from "node:test";
import { toClickHouseDateTime64 } from "./clickhouse-time.js";

test("formats UTC dates for ClickHouse DateTime64 parameters", () => {
  assert.equal(
    toClickHouseDateTime64(new Date("1970-01-01T00:00:00.000Z")),
    "1970-01-01 00:00:00.000"
  );
  assert.equal(
    toClickHouseDateTime64(new Date("2026-08-27T08:36:17.174Z")),
    "2026-08-27 08:36:17.174"
  );
});

test("rejects invalid dates", () => {
  assert.throws(
    () => toClickHouseDateTime64(new Date("invalid")),
    /Invalid date/
  );
});
