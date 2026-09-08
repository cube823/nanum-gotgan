/**
 * 실사진으로 파이프라인을 돌려본다.
 *   node ai/try.js ai/fixtures/*.jpg
 *
 * 실제 API를 호출하므로 비용이 든다. 사진 N장이면 haiku 1콜 + sonnet M콜.
 */
import fs from "node:fs";
import path from "node:path";
import { generateDrafts } from "./pipeline.js";

const MEDIA = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

const files = process.argv.slice(2);
if (!files.length) {
  console.error("사용법: node ai/try.js <사진 경로...>");
  process.exit(1);
}

const photos = files.map((f) => {
  const mediaType = MEDIA[path.extname(f).toLowerCase()];
  if (!mediaType) throw new Error(`지원하지 않는 형식: ${f}`);
  return { mediaType, base64: fs.readFileSync(f).toString("base64") };
});

console.log(`사진 ${photos.length}장 → 초안 생성 중…\n`);
const t0 = Date.now();
const { groupFellBack, drafts } = await generateDrafts(photos);

if (groupFellBack) console.log("⚠ 그룹 분류 실패 — 전체를 한 물건으로 처리했습니다.\n");

drafts.forEach((r, i) => {
  const names = r.photoIndices.map((n) => path.basename(files[n])).join(", ");
  console.log(`── 초안 ${i + 1} ── (${names})`);
  if (r.error) {
    console.log(`  ✗ 실패: ${r.error}  → 빈 폼으로 넘어갑니다\n`);
    return;
  }
  const d = r.draft, g = r.guard;
  const mark = { green: "🟢", yellow: "🟡", red: "🔴" }[g.risk];
  console.log(`  ${mark} ${g.categoryLabel}  |  ${d.name}`);
  console.log(`  ${d.quantity}${d.quantity_unit} · ${d.is_used ? "사용" : "미사용"} · 상태 ${d.condition}`);
  console.log(`  ${d.description}`);
  console.log(`  confidence ${d.confidence}${d.uncertain_fields.length ? ` · 불확실: ${d.uncertain_fields.join(", ")}` : ""}`);
  g.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  if (g.needsHumanInput.length) console.log(`  ✍ 담당자 입력 필요: ${g.needsHumanInput.join(", ")}`);
  console.log(`  자동 등록 ${g.canAutoPublish ? "가능" : "불가 — 확인 필요"}\n`);
});

console.log(`${((Date.now() - t0) / 1000).toFixed(1)}초`);
