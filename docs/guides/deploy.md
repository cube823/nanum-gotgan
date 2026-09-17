# 배포 — Vercel + Neon + Blob + nanumgotgan.com

순서가 있다. 도메인 없이 `*.vercel.app`으로 먼저 올려 OAuth까지 확인한 뒤 도메인을 얹는다 —
DNS 전파를 기다리는 동안 다른 게 막히지 않는다.

## 0. 코드 준비 (끝남)

- `web/src/lib/storage.ts` — `BLOB_READ_WRITE_TOKEN`이 있으면 Vercel Blob, 없으면 로컬. 배포에서 사진이 깨지지 않는다.
- 로컬 git만 있고 리모트가 없다. Vercel은 GitHub 리포가 필요하다.

```bash
gh repo create nanum-gotgan --private --source=. --push   # cube823 계정, 프라이빗
```

## 1. Vercel 프로젝트

1. https://vercel.com/new → GitHub `nanum-gotgan` Import
2. **Root Directory: `web`** ← 모노레포라 필수. Vercel이 루트 `pnpm-workspace.yaml`을 보고 설치는 루트에서, 빌드는 `web`에서 한다. 안 바꾸면 "Next.js를 못 찾음"
3. Framework: Next.js (자동). Build/Install 명령은 건드리지 않는다
4. Environment Variables — 지금 넣을 것:

   | 이름 | 값 |
   |---|---|
   | `AUTH_SECRET` | `openssl rand -base64 32` 새로 |
   | `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | 로컬과 같음 |
   | `AUTH_KAKAO_ID` / `AUTH_KAKAO_SECRET` | 로컬과 같음 |
   | `ADMIN_EMAILS` | 운영자 이메일들 |

   `AUTH_URL`과 `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`은 **넣지 않는다** — 아래에서 자동으로 들어온다.
5. Deploy. 첫 배포는 DB가 없어 500이 나도 정상.

## 2. Storage 연결

프로젝트 → Storage 탭:

- **Neon** (Postgres) → Create → 연결. `DATABASE_URL`이 env에 자동 추가된다.
- **Blob** → Create → 연결. `BLOB_READ_WRITE_TOKEN` 자동 추가.

스키마 적용 — Neon 대시보드의 연결 문자열로:

```bash
psql "<NEON_CONNECTION_STRING>" -f db/schema.sql -f db/seed.sql
```

Redeploy → `https://<프로젝트>.vercel.app/login`이 뜨면 됨.

## 3. OAuth — `*.vercel.app` 주소로 먼저

로컬 URI는 **지우지 말고 추가**한다. 로컬 개발은 계속 쓴다.

- 구글 콘솔 → OAuth 클라이언트 → 승인된 리디렉션 URI: `https://<프로젝트>.vercel.app/api/auth/callback/google`
- 카카오 콘솔 → REST API 키 수정 → 리다이렉트 URI: `https://<프로젝트>.vercel.app/api/auth/callback/kakao`
- 구글 동의 화면이 "테스트" 상태면 **테스트 사용자**에 팀·인터뷰 대상 이메일 추가. 아니면 "게시"(심사 없음, "확인되지 않은 앱" 경고만)

여기서 실제 로그인이 되는지 본다. 되면 도메인.

## 4. 도메인 `nanumgotgan.com`

프로젝트 → Settings → Domains → `nanumgotgan.com` 입력 → **Buy** (Vercel이 등록·DNS·SSL·`www` 리다이렉트 전부 처리).
외부에서 샀다면 네임서버를 Vercel 것으로 바꾸거나 A 레코드 `76.76.21.21`.

붙은 뒤:

1. 구글·카카오에 `https://nanumgotgan.com/api/auth/callback/...` **추가** (3번 URI도 남겨둔다 — 프리뷰 배포용)
2. Vercel env에 `AUTH_URL=https://nanumgotgan.com` 추가 → Redeploy. 도메인 확정 전에 넣으면 프리뷰 배포가 깨진다.

## 5. 확인

- `https://nanumgotgan.com` → 로그인 → 구글·카카오 각각 → `/onboarding`
- 등록 화면에서 사진 업로드 → URL이 `https://…blob.vercel-storage.com/items/…` 인지 (로컬 `/uploads/`면 Blob 연결 실패)
- `ADMIN_EMAILS` 계정으로 `/admin/approvals`

## 알아둘 것

- **Hobby 플랜은 비상업용**이다. 공공·비영리 성격이라 해당하지만, 결제가 붙으면 Pro.
- Neon 무료 티어는 일정 시간 미사용 시 잠든다(cold start 1~2초). 인터뷰 데모 직전에 한 번 열어두면 된다.
- 프리뷰 배포(PR마다 생기는 URL)는 OAuth 콜백이 안 맞아 로그인이 안 된다. dev 프로바이더도 프로덕션 빌드엔 없다. 프리뷰는 화면 확인용으로만.
- 사진 정리: Blob에 고아 파일이 쌓이면 Vercel 대시보드에서 지운다. 초기엔 무시.
