# 기능을 넣을 때

순서가 있다. 뒤에서 앞으로 가면 두 번 고친다.

## 0. 범위부터

- `design/MVP.md` §1 "뺀 것" 표에 있는가? 있다면 **뺀 이유가 아직 유효한지** 먼저 본다. 유효하면 안 넣는다.
- 기획서 번호(00~05, 99)를 찾는다. 없으면 팀 기획서에 먼저 올라가야 한다.
- 새 **상태**가 생기는가? 생기면 §3 검산표에 화살표 + 화면을 먼저 적는다. 도달 화면 없는 상태는 없는 상태다.

## 1. 스키마 (`db/schema.sql`)

- 컬럼·테이블 추가. 지금은 마이그레이션 도구가 없다 — `schema.sql`을 고치고 dev DB는 `dropdb && createdb`로 다시 만든다. 프로덕션 DB가 생기면 그때 마이그레이션을 도입한다.
- `web/src/lib/types.ts`에 타입. camelCase.
- 카테고리·등급을 바꾸면 `db/seed.sql` **과** `ai/schema.js` 둘 다.

## 2. API (`web/src/app/api/**`)

- `api()` 래퍼 안에서. 권한은 `requireUser()` 또는 `requireVerified()`.
- 상태를 바꾸면 `sql.begin` + `FOR UPDATE`. 검사도 트랜잭션 **안에서**.
- 에러는 `HttpError(코드, "사용자에게 보일 문장")`.
- 게이트가 늘면 `architecture.md` 게이트 표에 한 줄.

## 3. 화면 (`web/src/app/(tabs)/**`)

- 서버 컴포넌트가 기본. 폴링·폼·버튼만 `"use client"`.
- 기존 컴포넌트 먼저: `ItemGrid`(목록 그리드), `TabBar`, `ChatButton`, `WithdrawButton` 패턴.
- 카드 필드는 `lib/items.ts`의 `CARD` 조각을 쓴다. SELECT를 새로 쓰지 않는다.

## 4. 검증

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm dev & pnpm smoke
```

- **`web/scripts/smoke.sh`에 케이스를 넣는다.** 성공 경로 + 막혀야 하는 경로(권한 없는 사람, 잘못된 상태) 하나씩.
- 통과 개수가 늘지 않았으면 안 끝난 것이다.

## 5. 문서

| 바꾼 것 | 고칠 문서 |
|---|---|
| 상태·전이 | `design/DB-SCHEMA.md` §3, `architecture.md` 상태기계 |
| 게이트 | `architecture.md` 게이트 표 |
| 용어 | `glossary.md` |
| 피처 자체 | `features/<이름>.md` — 기획서 번호, 화면, 파일, smoke 단계, 열린 것 |
| 결정 | `decisions/NNNN-*.md` |
| 규칙 | `/AGENTS.md` 불변 규칙 (정말 불변일 때만) |

## 하지 말 것

- 페이지마다 권한 검사를 흩어놓기 → `proxy.ts`(리다이렉트)와 API(판정) 두 곳뿐
- 트리거로 상태 동기화 → 앱 트랜잭션
- 실시간 붙이기 → 폴링 유지. 느리다는 피드백이 실제로 온 뒤에
- 새 의존성 → 이미 있는 것으로 안 되는지 먼저
