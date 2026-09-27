# 나눔곳간 — web

Next.js 16 (App Router) + PostgreSQL. 설계는 `../docs/design/MVP.md`, `../docs/design/DB-SCHEMA.md`. 이 패키지 규칙은 `AGENTS.md`.

## 처음 한 번

```bash
# 1. DB
createdb nanum_gotgan
psql -d nanum_gotgan -f ../db/schema.sql
psql -d nanum_gotgan -f ../db/seed.sql        # 카테고리 10개

# 2. 환경
cp .env.example .env.local                     # DATABASE_URL, AUTH_SECRET 채우기
#   ADMIN_EMAILS 에 운영자 이메일을 넣으면 그 이메일로 로그인 시 승인 권한이 생긴다

# 3. 실행 — 설치는 리포 루트에서 (pnpm 워크스페이스)
cd .. && pnpm install && cd web
pnpm dev                                       # http://localhost:3000  (루트에서 `pnpm dev`도 같다)
```

로그인은 개발 중에도 구글·카카오 OAuth로 한다 (`.env.local`에 클라이언트 ID). 이메일만 받는 `dev` 프로바이더는 화면에 없고 `pnpm smoke`가 curl로만 쓴다.
프로덕션 빌드에선 이 로그인이 사라지고 구글/카카오만 남는다 — `AUTH_GOOGLE_ID`, `AUTH_KAKAO_ID`가 필요하다.

## 확인

```bash
pnpm smoke                     # dev 서버 떠 있을 때. 계정 3개로 한 바퀴 (96건)
pnpm typecheck
pnpm lint
pnpm build
```

## 구조

```
src/
  auth.ts               Auth.js 설정. 구글·카카오·(개발용) 로그인, JWT에 소속 상태
  proxy.ts              게이트 — 리다이렉트만. 진짜 판정은 API (MVP §3)
  lib/
    db.ts               postgres.js 클라이언트 (camelCase 변환)
    session.ts          requireUser / requireVerified — DB를 본다, 토큰 아님
    items.ts            스와이프·목록·상세·내 물품 쿼리
    storage.ts          사진 저장 — 로컬 public/uploads. Blob/S3로 바꾸려면 이 파일만
  app/
    login, onboarding, pending, admin/approvals     소속 확인 흐름
    (tabs)/swipe, items, new, messages, me          4탭 + 목록
    api/**                                          route handlers
scripts/smoke.sh        curl 한 바퀴
```

## 아직 사람이 해야 하는 것

- 구글/카카오 OAuth 앱 만들고 클라이언트 ID 받기 (카카오는 이메일 항목이 선택 동의 — 비즈 앱 전환 전엔 이메일이 비어 올 수 있다)
- 프로덕션 사진 저장소 (`lib/storage.ts` 교체)
- 배포 (Vercel이면 Postgres 연결 문자열만 env로)
