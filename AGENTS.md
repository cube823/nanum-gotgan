# 나눔곳간 — 에이전트 진입점

서울시 청년공간·센터끼리 남는 소모품을 무상으로 나누는 서비스. pnpm 워크스페이스 모노레포.

## 구조

```
web/   @nanum/web   Next.js 16 앱 — MVP 본체. 규칙은 web/AGENTS.md
ai/    @nanum/ai    사진→게시글 초안. MVP 밖. 규칙은 ai/AGENTS.md
db/                 schema.sql, seed.sql — 패키지 아님, psql로 직접 적용
docs/               사람용 문서. 지도는 docs/README.md
```

## 명령 — 루트에서

```bash
pnpm install                # 한 번. 모든 패키지
pnpm dev | build | typecheck | lint    # web
pnpm smoke                  # web curl 한 바퀴 68건. dev 서버 필요
pnpm test                   # -r: test 스크립트 있는 패키지 전부 (지금은 ai)
pnpm --filter @nanum/ai try photo.jpg  # 특정 패키지 스크립트
```

DB: `createdb nanum_gotgan && psql -d nanum_gotgan -f db/schema.sql -f db/seed.sql`

## 불변 규칙 — 코드를 바꿀 때 지켜야 하는 것

1. **판정은 API가 DB를 보고 한다.** `web/src/proxy.ts`는 리다이렉트만. 쓰기 권한은 `requireVerified()`/`requireUser()`(`web/src/lib/session.ts`)가 DB를 읽어 결정한다. JWT 클레임으로 권한을 판정하지 않는다.
2. **상태 전이는 트랜잭션 + `FOR UPDATE`.** `items.status`·`transfers.status`를 바꾸는 코드는 읽기·검사·쓰기를 `sql.begin` 안에서 한다. 전이를 추가하면 `docs/design/DB-SCHEMA.md` §3 검산표에 화살표와 화면을 같이 적는다.
3. **🔴 카테고리(전기·소형비품)는 3중 방어.** UI 비활성 + API 400 + DB CHECK(`chk_red_needs_approval`). 카테고리·등급을 바꾸면 `db/seed.sql`과 `ai/schema.js`의 `CATEGORIES`를 같이 바꾼다 — 아직 한 곳으로 모으지 않았다.
4. **법적 필드(`on_ledger`·`approval_confirmed`·`funding_source`)는 사람이 입력한다.** AI가 채우지 않는다.
5. **SQL은 postgres.js 태그 템플릿만.** 문자열 이어붙이기 금지. 컬럼은 `postgres.camel`로 camelCase가 되어 온다 — TS 타입(`web/src/lib/types.ts`)과 맞춘다.
6. **실시간 없음.** 채팅은 5초 폴링. WebSocket을 붙이지 않는다.
7. **새 기능 = `web/scripts/smoke.sh`에 케이스 추가.** 통과 개수가 늘어야 끝난 것이다.

## 어디를 읽을지

| 하려는 일 | 읽을 것 |
|---|---|
| 기능 추가·수정 | `docs/guides/adding-a-feature.md` → 해당 `docs/features/*.md` |
| 용어가 헷갈림 (나눔 건? 예약? manager?) | `docs/glossary.md` |
| 요청이 어디를 거치는지 | `docs/architecture.md` |
| 왜 이렇게 정했는지 | `docs/decisions/` |
| 원래 설계·스키마 전문 | `docs/design/` |
| Next.js 16 API가 기억과 다름 | `web/AGENTS.md` → `web/node_modules/next/dist/docs/` |

## 하지 않는 것

- AI 토글(`여러 물건 글쓰기`·`AI로 작성해요`)을 MVP에 붙이지 않는다 — `docs/decisions/0005-ai-deferred.md`
- 기관 명단을 시딩하지 않는다 — `0001-no-org-seeding.md`
- 후기·북마크·약속 날짜 UI·프로필 수정·활동 점수 — 기획서 팀 코멘트대로 후순위
- Turborepo/Nx — 패키지 2~3개엔 과하다
