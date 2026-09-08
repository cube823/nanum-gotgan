import assert from "node:assert/strict";
import { guard, CATEGORY_CODES } from "./schema.js";

const draft = (over = {}) => ({
  category: "stationery", name: "유성펜", quantity: 10, quantity_unit: "개",
  is_used: true, condition: "중", description: "…", confidence: 0.9,
  uncertain_fields: [], ...over,
});

// red는 사람 확인 없이 자동 등록 불가 — 법적 검토 §4의 핵심 방어선
const red = guard(draft({ category: "electronics" }));
assert.equal(red.risk, "red");
assert.equal(red.canAutoPublish, false);
assert.deepEqual(red.needsHumanInput,
  ["on_ledger", "approval_confirmed", "funding_source"]);

// yellow는 경고만 하고 통과
const yellow = guard(draft({ category: "event" }));
assert.equal(yellow.risk, "yellow");
assert.equal(yellow.canAutoPublish, true);
assert.equal(yellow.warnings.length, 1);

// green + 높은 신뢰도 = 경고 없이 통과
const green = guard(draft());
assert.equal(green.canAutoPublish, true);
assert.deepEqual(green.warnings, []);
assert.deepEqual(green.needsHumanInput, []);

// 신뢰도 0.6 미만이면 green이라도 막는다 (AI-LOOP-DESIGN §2)
assert.equal(guard(draft({ confidence: 0.59 })).canAutoPublish, false);
assert.equal(guard(draft({ confidence: 0.6 })).canAutoPublish, true);

// 모르는 카테고리는 etc(yellow)로 — 더 엄격한 쪽으로 떨어진다
const unknown = guard(draft({ category: "nonexistent" }));
assert.equal(unknown.risk, "yellow");

// 모든 카테고리가 등급을 갖는다
for (const c of CATEGORY_CODES) {
  assert.ok(["green", "yellow", "red"].includes(guard(draft({ category: c })).risk));
}

console.log("guard(): 모든 검사 통과");
