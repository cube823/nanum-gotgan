# 0006 — pnpm 워크스페이스 모노레포

**맥락** — `ai/`(npm, ESM .js)와 `web/`(pnpm, Next.js)가 따로 만들어져 lockfile이 둘, 패키지 매니저가 둘이었다. 카테고리 정의(`ai/schema.js` ↔ `db/seed.sql`)가 두 곳에 있다. web이 나중에 ai를 import한다.

**결정** — 루트 `pnpm-workspace.yaml`(`packages: [web, ai]`), lockfile 하나, 패키지 이름 `@nanum/web`·`@nanum/ai`. 루트 `package.json`은 의존성 없이 `--filter` 위임 스크립트만. Turborepo/Nx는 안 얹는다.

**결과** —
- 설치는 루트에서 한 번. 의존성은 `node_modules/.pnpm`에 한 번 깔리고 패키지별 `node_modules`는 심볼릭 링크.
- web이 ai를 쓸 때 `"@nanum/ai": "workspace:*"` 한 줄 — publish 없음.
- 문서도 스코프가 생겼다: 루트 `AGENTS.md`는 리포 규칙, `web/`·`ai/`의 `AGENTS.md`는 그 패키지 규칙. Claude Code가 작업 디렉토리 위로 올라가며 읽는다.
- 대가: Vercel 배포 시 Root Directory를 `web`으로 지정해야 하고, `ai/`를 TS로 옮기거나 `.d.ts`를 붙여야 web에서 타입이 맞는다.
- 카테고리 정의는 아직 두 곳이다 — 셋째 패키지(`packages/shared`)로 뽑을 첫 후보.
