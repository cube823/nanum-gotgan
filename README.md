# 나눔곳간

서울시 청년공간·센터끼리 남는 소모품을 나누는 서비스.

**문서**: AI는 `AGENTS.md`에서, 사람은 `docs/README.md`에서 시작한다. 설계 원본은 `docs/design/`.

## 구조 — pnpm 워크스페이스

```
sharing-space/
  pnpm-workspace.yaml   ← 이 파일이 "여기서부터 모노레포"라는 선언. packages: [web, ai]
  package.json          ← 루트. 의존성 없음. 하위 패키지로 명령을 넘기는 스크립트만
  pnpm-lock.yaml        ← lockfile은 리포에 하나. 하위 패키지엔 없다
  web/                  ← @nanum/web  — Next.js 앱 (MVP 본체)
  ai/                   ← @nanum/ai   — 사진→게시글 초안 (MVP 밖, 나중에 web이 import)
  db/                   ← schema.sql, seed.sql (패키지 아님 — psql로 직접 적용)
  docs/                 ← 사람용 문서: 용어·아키텍처·피처·결정·가이드
```

## 처음 한 번

```bash
pnpm install            # 루트에서 한 번. web·ai 의존성이 전부 설치된다
createdb nanum_gotgan && psql -d nanum_gotgan -f db/schema.sql && psql -d nanum_gotgan -f db/seed.sql
cp web/.env.example web/.env.local
pnpm dev                # = pnpm --filter @nanum/web dev
```

## 명령 — 전부 루트에서

| 명령 | 실제로 하는 것 |
|---|---|
| `pnpm dev` / `pnpm build` | web만 |
| `pnpm typecheck` / `pnpm lint` | web만 |
| `pnpm smoke` | web의 curl 한 바퀴 (dev 서버 필요) |
| `pnpm test` | `pnpm -r test` — test 스크립트가 있는 모든 패키지 (지금은 ai) |
| `pnpm --filter @nanum/ai try photo.jpg` | 특정 패키지의 스크립트를 직접 |

`--filter <패키지명>`이 "어느 패키지에서 실행할지"를 정한다. `-r`(recursive)은 전부.
`cd web && pnpm dev`도 똑같이 동작한다 — 필터는 편의일 뿐이다.

## 모노레포라서 다른 점

- **의존성은 루트 `node_modules/.pnpm`에 한 번만 깔리고**, 각 패키지의 `node_modules`는 거기로 가는 심볼릭 링크다. web과 ai가 같은 `zod`를 쓰면 디스크에 하나.
- **패키지끼리는 `workspace:*`로 참조한다.** web이 ai를 쓰게 되면 `web/package.json`에
  `"@nanum/ai": "workspace:*"` 한 줄 — npm publish 없이 로컬 폴더가 그대로 의존성이 된다.
- **한 패키지만 못 깬다.** `pnpm install`이 lockfile 하나를 갱신하므로, ai의 의존성을 바꿔도 web의 lockfile 상태가 같이 검증된다.
- **배포는 패키지 단위다.** Vercel에 올릴 땐 Root Directory를 `web`으로 지정하되, 설치는 리포 루트에서 일어나야 `workspace:*`가 풀린다 (Vercel은 pnpm-workspace.yaml을 보고 자동으로 그렇게 한다).
