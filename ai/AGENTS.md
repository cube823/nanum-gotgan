# @nanum/ai

사진 N장 → 게시글 초안 M개. **MVP 밖** — web이 아직 import하지 않는다. 설계는 `../docs/design/AI-LOOP-DESIGN.md`.

```
schema.js          CATEGORIES(리스크 등급), Zod 스키마, guard() — 규칙 코드, LLM 아님
prompts/group.js   사진을 물건별로 묶기 (haiku)
prompts/extract.js 그룹 → 초안 (sonnet)
pipeline.js        엮은 것. 재시도·폴백
guard.test.js      키 없이 실행되는 검사
try.js             실사진 CLI. ANTHROPIC_API_KEY 필요
```

## 규칙

- `guard()`는 LLM을 부르지 않는다. 등급을 **낮추는** 방향의 판단은 무시한다 (fail-safe는 엄격한 쪽).
- 법적 필드는 프롬프트에서 명시적으로 금지돼 있다. 풀지 않는다.
- `CATEGORIES`는 `db/seed.sql`과 같은 내용이어야 한다. 아직 한 곳으로 안 모았다 — 바꾸면 둘 다.
- 모델 ID는 `claude-haiku-4-5` / `claude-sonnet-5`. 날짜 접미사 붙이지 않는다.

## 검증

```bash
pnpm --filter @nanum/ai test                      # guard() 검사
pnpm --filter @nanum/ai try fixtures/*.jpg        # 실제 호출 (비용)
```

**프롬프트 품질은 아직 미검증이다.** 골든셋 20장(문구·포장·전기류 섞어서)이 필요하다.

## web에 붙일 때

`web/package.json`에 `"@nanum/ai": "workspace:*"` → `import { generateDrafts } from "@nanum/ai"`.
스키마에 `item_drafts` 테이블, 등록 화면에 토글 2개, REVIEW 화면 1개가 필요하다 — `docs/design/MVP.md` §부록.
이 패키지는 `.js`(ESM)라 web(TS)에서 쓰려면 `.d.ts`를 붙이거나 `.ts`로 옮긴다.
