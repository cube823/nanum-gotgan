# 아키텍처 — 한 장

Next.js 16 (App Router) + PostgreSQL. 서버 하나, DB 하나, 실시간 없음.

## 요청 하나가 거치는 곳

```
브라우저
  │
  ▼
src/proxy.ts ─── 세션 없음 → /login │ org 없음 → /onboarding │ /admin은 권한자만
  │              (JWT만 본다. DB 안 본다. 리다이렉트만 한다)
  ▼
페이지 (서버 컴포넌트)          API route (src/app/api/**)
  │ currentUser() → DB            │ requireUser() / requireVerified() → DB   ← 진짜 판정
  ▼                               ▼
src/lib/items.ts 쿼리           sql.begin + FOR UPDATE (상태를 바꿀 때)
  │                               │
  ▼                               ▼
PostgreSQL ◄────────────────────┘
```

**왜 둘로 나뉘나**: 미들웨어는 edge라 DB를 못 본다. 그래서 JWT에 `orgId`·`orgStatus`·`isAdmin`을 싣고 리다이렉트만 한다. 승인되면 토큰이 낡으므로 클라이언트가 `session.update()`로 다시 받는다. **낡은 토큰이 권한을 줄 수 없도록** 쓰기 API는 항상 DB를 읽는다 (`lib/session.ts`).

## 게이트 4개 — 전부 API에서

| 게이트 | 어디 | 어긴 요청 |
|---|---|---|
| verified만 쓰기 | `lib/session.ts` `requireVerified` | 403 |
| 같은 기관 물품 신청 | `api/transfers/route.ts` | 400 |
| 승인은 운영자 또는 우리 기관 manager | `api/admin/approvals/route.ts` `scope()` | 403 |
| 예약·완료·내리기는 등록자만 | `api/transfers/[id]`, `api/items/[id]` | 403 |

## 상태기계

```
items:      open ⇄ reserved ──→ completed
              └──────┴────────→ withdrawn

transfers:  requested ⇄ scheduled ──→ completed
                └──────────┴────────→ cancelled
```

- `completed`는 **반드시** `scheduled`를 거친다. 예약 없이 완료되면 다른 신청자가 예고 없이 잘린다.
- 전이는 `api/transfers/[id]/route.ts`(schedule / unschedule / complete)와 `api/items/[id]/route.ts`(withdraw) 두 파일에만 있다. 둘 다 트랜잭션 + `FOR UPDATE`.
- 화살표별 화면·파일은 `design/DB-SCHEMA.md` §3 검산표. **화살표를 추가하면 표도.**

## 데이터 — 테이블 9개

`organizations` ⇄ `users` (순환 FK, `ALTER TABLE`로 뒤늦게) · `categories` · `items` → `item_photos` · `transfers` → `messages` · `bookmarks` · `swipes`

`transfers`가 채팅방이다 — `(item_id, requester_id)` UNIQUE. 방 테이블을 따로 두면 같은 걸 두 번 관리한다.

## 실시간 대신 폴링

채팅방 5초 (`ChatRoom.tsx`, `?after=` 증분), 승인 대기 5초 (`pending/page.tsx`), 메시지 목록은 진입 시 1회. 담당자끼리 하루 몇 통 — WebSocket 인프라를 세울 값어치가 없다.

## 인증

Auth.js v5, JWT 전략. 구글·카카오는 env에 클라이언트 ID가 있을 때만 켜진다. 개발용 `dev` 프로바이더(이메일만)는 `NODE_ENV !== production`에서만 존재한다. 카카오는 이메일이 선택 동의라 `users.email`이 NULL일 수 있다.

## 사진

`lib/storage.ts` `putImage` 하나. 지금은 로컬 `public/uploads` — **프로덕션 빌드에선 안 보인다.** 배포 전 Blob/S3로 이 함수만 교체. 매직 바이트로 판별하고 클라이언트 `file.type`은 믿지 않는다.

## 모노레포에서 이 앱의 위치

`web/`은 자기 완결이다 — `ai/`를 아직 import하지 않는다. 붙일 때 `"@nanum/ai": "workspace:*"`. 배포는 `web`을 Root Directory로, 설치는 리포 루트에서 (Vercel이 `pnpm-workspace.yaml`을 보고 자동).
