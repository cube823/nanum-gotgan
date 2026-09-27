<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# @nanum/web

리포 전체 규칙은 `../AGENTS.md`. 여기는 이 패키지에서만 유효한 것.

## 이 버전에서 이미 밟은 것 (Next 16.3 / React 19 / Tailwind 4)

- 미들웨어 파일은 `src/proxy.ts`, export 이름은 `proxy`. `middleware.ts`가 아니다.
- `params`·`searchParams`는 **Promise**다. `const { id } = await params`.
- `react-hooks/set-state-in-effect`: effect 본문에서 setState를 직접 부르면 lint 에러. Promise `.then` 콜백 안에서 하거나 `void load()` 형태로.
- 내부 이동에 `window.location.assign` 쓰면 lint 에러. `useRouter().push()`.
- Tailwind 4: 커스텀 클래스를 `@apply`하려면 `@utility`로 선언해야 한다 (`globals.css`).
- `<img>`는 의도적으로 raw다 (`next/image` 안 씀). 줄마다 `eslint-disable-next-line @next/next/no-img-element`.

## 파일이 사는 곳

```
src/auth.ts             Auth.js. 프로바이더·JWT 콜백. 개발용 dev 프로바이더는 prod에서 빠진다
src/proxy.ts            게이트. 리다이렉트만
src/lib/session.ts      requireUser / requireVerified / api() 래퍼 — DB를 본다
src/lib/items.ts        카드 SELECT 조각(CARD)과 피드·목록·상세·내 물품 쿼리
src/lib/storage.ts      putImage — 로컬 public/uploads. 배포 전 Blob/S3로 이 함수만 교체
src/lib/types.ts        DB 행 타입. 컬럼을 추가하면 여기도
src/app/api/**          route handler. 전부 api() 래퍼 안에서 HttpError를 던진다
src/app/(tabs)/         4탭 + 목록. layout.tsx가 pending 배너와 TabBar
src/components/         ItemGrid, TabBar
scripts/smoke.sh        curl 한 바퀴. 기능 추가 시 여기에 케이스
scripts/geocode-orgs.mjs 기관 주소→좌표(카카오 로컬). 결과 UPDATE문을 db/orgs.sql 끝에 붙인다. KAKAO_REST_KEY 필요
```

## API 라우트를 추가할 때

```ts
export const POST = api(async (req, { params }) => {
  const u = await requireVerified();          // 또는 requireUser()
  const { id } = await params;
  // ... 상태를 바꾸면 sql.begin + FOR UPDATE
  throw new HttpError(400, "사용자에게 보여줄 한국어 문장");
});
```

에러 문장은 사용자에게 그대로 보인다 — "~해요" 체, 내부 정보 없이.

## 검증

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm dev &  pnpm smoke      # 107건
```

smoke는 끝날 때 자기 실행 번호의 계정·기관·물품을 지운다(`db/cleanup-test-data.sql`, 로컬 DB일 때만). 남겨서 보려면 `SMOKE_KEEP=1 pnpm smoke`. 예전에 쌓인 smoke 데이터는 `psql -d nanum_gotgan -v re='^[a-f][0-9]+@dev\.local$' -f db/cleanup-test-data.sql`.

`.env.local`이 없으면 `.env.example`을 복사. `ADMIN_EMAILS`에 있는 이메일로 OAuth 로그인하면 운영자. 로그인 화면에 개발용 폼은 없다 — `dev` 프로바이더는 smoke가 curl로 `/api/auth/callback/dev`를 직접 부르는 데만 쓴다.
