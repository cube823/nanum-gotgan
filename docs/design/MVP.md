# 나눔곳간 — MVP 구현 설계 (AI 제외)

스택: **Next.js (App Router) + PostgreSQL**
범위: **등록 → 스와이프 → 채팅 → 양도 완료** 한 바퀴.
데이터 구조는 `DB-SCHEMA.md`.

---

## 0. 왜 이 범위인가

기획서에 화면이 78개 있다. 전부 만들면 9월 결과공유회를 못 맞춘다.
**나눔이 한 바퀴 도는 최소 경로**만 만든다:

```
담당자 A: 물품 등록  →  담당자 B: 스와이프로 발견  →  채팅  →  양도 완료
```

이 한 바퀴가 안 돌면 나머지 74개 화면은 의미가 없다. 돌면 그때 붙인다.

**AI 토글 2개(`여러 물건 글쓰기` / `AI로 작성해요`)는 뺀다.** 부가 기능이고,
없어도 사진 찍고 손으로 입력하면 등록이 된다. 붙일 때 필요한 건 §부록.

---

## 1. 화면 — 13개

기획서 78개 중 이것만.

### 인증·소속 (4)
| # | 화면 | 기획서 | 핵심 |
|---|---|---|---|
| 1 | 로그인 | 01 | 구글 / 카카오 |
| 2 | 소속 선택 | 01 | 자동완성 + 신규 기관 입력 |
| 3 | 승인 대기 | — | pending 상태 안내 (신규) |
| 4 | 승인 관리 | — | 운영자·매니저용 목록 (신규) |

3·4번은 기획서에 없다. 소속 확인을 자기신고+승인으로 정하면서 생긴 화면이다
(`DB-SCHEMA.md` §1.5).

### 등록 (3)
| # | 화면 | 기획서 | 핵심 |
|---|---|---|---|
| 5 | 사진 선택 | 03 | 최대 10장. **AI 토글 없음** |
| 6 | 정보 입력 | 03 | 카테고리·이름·수량·상태·설명 + 법적 필드 |
| 7 | 등록 완료 | 03 | |

### 스와이프·탐색 (3)
| # | 화면 | 기획서 | 핵심 |
|---|---|---|---|
| 8 | 스와이프 카드 | 02 | 좌/우 = 이전/다음, X = 넘김, ↑ = 상세. 우상단 돋보기 → 13 |
| 9 | 물품 상세 | 02 | 전체 정보 + 채팅하기 |
| 13 | 물품 목록 | 99 | 전체 `open` 물품 그리드 + 카테고리 필터. **재방문용** — 스와이프는 발견용 |

13번 컴포넌트를 12번(내 정보)의 등록/신청/수령 목록이 그대로 쓴다. 05 기획서가 그렇게
정의했다 ("물품 제시 화면의 화면구성을 따라감 + 필터 조건"). 화면은 1개 늘지만 컴포넌트는 1개다.

### 메시지 (2)
| # | 화면 | 기획서 | 핵심 |
|---|---|---|---|
| 10 | 메시지 목록 | 04 | 안 읽음 닷 + 물품 상태(예약됨/완료) |
| 11 | 채팅방 | 04 | 상단 물품 정보 + 등록자용 버튼 2개: **드리기로 함** / **양도 완료** |

### 내 정보 (1)
| # | 화면 | 기획서 | 핵심 |
|---|---|---|---|
| 12 | 내 정보 | 05 | 프로필 + 등록/신청/수령 목록. 등록 목록에 **내리기** 버튼 |

### 뺀 것

기획서에 있지만 MVP에 없는 것 — **뺀 이유를 남긴다:** (북마크(하트)는 여기 있다가 2026-09-27에 붙였다 — 스와이프 ♡, 프로필 > 북마크)

| 뺀 화면 | 기획서 | 이유 |
|---|---|---|
| 카메라 직접 촬영 | 03 | `<input type="file" accept="image/*" capture>`로 OS 카메라를 부른다. 자체 카메라 UI(줌·전후면·재촬영)를 만들 이유가 없다 |
| 사진 편집 (자르기·회전·그리기) | 03 | 나눔 사진에 편집이 필요한 경우가 드물다. 필요하면 담당자가 갤러리에서 하고 온다 |
| 약속 잡기 (날짜 선택 UI) | 04 | 채팅으로 "내일 2시에 오세요"라고 쓰면 된다. **예약 상태 표시**는 별개라 넣는다 (§4.4) |
| 후기 | 04 · 05 | 팀이 직접 "후기 보내는 기능 없을 시 삭제"라고 달아둠 |
| 프로필 수정 | 05 | OAuth에서 온 닉네임·사진을 그대로 쓴다 |
| 활동 점수 | 05 | 기획서에도 "점수? 같은거"로 물음표가 붙어 있다 |
| 우리 기관 구성원/후기 | 05 | 팀이 "제작 후순위"로 표시 |
| 타인 프로필 상세 | 02 · 05 | 채팅방 상단에 이름·기관명만 보여준다 |

---

## 2. 라우트

```
app/
  (auth)/login/page.tsx              1. 로그인
  onboarding/page.tsx                2. 소속 선택
  pending/page.tsx                   3. 승인 대기
  admin/approvals/page.tsx           4. 승인 관리

  (tabs)/
    swipe/page.tsx                   8. 스와이프  ← 기본 진입
    items/page.tsx                   13. 물품 목록
    items/[id]/page.tsx              9. 물품 상세
    new/page.tsx                     5·6. 등록 (사진 → 정보, 한 페이지 2스텝)
    new/done/page.tsx                7. 등록 완료
    messages/page.tsx                10. 메시지 목록
    messages/[transferId]/page.tsx   11. 채팅방
    me/page.tsx                      12. 내 정보

api/
  items/route.ts                     POST 등록 / GET 목록·피드 (?mode=swipe|list&category=)
  items/[id]/route.ts                GET 상세 / PATCH 내리기 (status=withdrawn)
  transfers/route.ts                 POST 신청(=채팅 시작)
  transfers/[id]/route.ts            PATCH 상태 변경 (scheduled ↔ requested, completed)
  transfers/[id]/messages/route.ts   GET 이력 / POST 전송
  swipes/route.ts                    POST 넘김 기록
  orgs/search/route.ts               GET 자동완성
  admin/approvals/route.ts           GET 목록 / PATCH 승인
```

하단 네비게이션 4탭은 02 기획서 그대로: **스와이프 / 등록하기 / 메시지 / 내 정보**.

---

## 3. 미들웨어 — 게이트 3개

모든 접근 제어가 여기 모인다. 페이지마다 흩어놓지 않는다.

```ts
// middleware.ts
세션 없음                    → /login
org_id IS NULL               → /onboarding
org_status = 'pending'       → 통과 (조회는 허용)
```

**pending을 막지 않는다.** 빈 화면에 "승인 대기 중"만 띄우면 이탈한다.
스와이프로 구경하다 "이거 필요한데" 할 때 배너를 띄우는 게 낫다
(`DB-SCHEMA.md` §1.5).

**미들웨어는 DB를 못 본다.** Next.js 미들웨어는 edge에서 돌아서 매 요청마다
`users`를 조회할 수 없다. `org_id`·`org_status`·`is_admin`을 **세션 토큰에 넣는다.**
그러면 승인된 순간 토큰이 낡는다 — 승인 API가 성공하면 클라이언트가 세션을 다시
받아오게 하고(`/pending` 화면이 폴링하며 `session.update()`), 그래도 토큰이 낡을 수
있으니 **API에서는 세션이 아니라 DB의 `org_status`를 본다.** 미들웨어는 리다이렉트만,
진짜 판정은 API.

쓰기는 API에서 막는다 — 네 가지:

```ts
// api/items POST, api/transfers POST
if (dbUser.org_status !== 'verified') → 403 '소속 승인 후 이용할 수 있어요.'

// api/transfers POST — 우리 기관 물품에 우리가 신청하는 것
if (item.org_id === dbUser.org_id) → 400 '같은 기관의 물품이에요.'
//   스와이프 피드에서만 걸러내면 /items/{id}로 직접 들어온 경우가 뚫린다

// api/admin/approvals — 운영자 또는 해당 기관 manager만
if (!dbUser.is_admin && !(dbUser.org_role === 'manager' && target.org_id === dbUser.org_id)) → 403

// api/transfers/[id] PATCH (드리기로 함 / 양도 완료) — 등록자만
// api/items/[id] PATCH (내리기) — 등록자만
if (item.created_by !== dbUser.id) → 403
```

`/admin/approvals` 페이지 자체도 미들웨어에서 `is_admin || org_role === 'manager'`가
아니면 `/swipe`로 돌린다. 페이지는 보여도 API가 막으니 안전하지만, 빈 화면을 보여줄 이유가 없다.

---

## 4. 핵심 플로우 6개

### 4.1 등록 (화면 5·6)

```
사진 선택 (최대 10장)
  → 업로드 → item_photos.url
  → 정보 입력
      카테고리 선택 → categories.risk_level 조회
        🟢 → 그대로
        🟡 → "반복 사용품이면 비품일 수 있어요" 안내만
        🔴 → 법적 필드 3개 입력 강제 + approval_confirmed 체크 없으면 등록 버튼 비활성
  → POST /api/items → status = 'open'
```

**🔴는 DB 제약으로도 막는다.** UI만 믿지 않는다 (`DB-SCHEMA.md` §items).

### 4.2 스와이프 (화면 8)

```sql
SELECT i.*, o.name AS org_name, o.lat, o.lng
FROM items i JOIN organizations o ON o.id = i.org_id
WHERE i.status = 'open'
  AND i.org_id <> $my_org                          -- 우리 기관 물건은 안 보여준다
  AND NOT EXISTS (SELECT 1 FROM swipes s
                  WHERE s.user_id = $me AND s.item_id = i.id)
ORDER BY i.created_at DESC
LIMIT 20;
```

20개씩 미리 받아두고 클라이언트에서 넘긴다. 한 장 넘길 때마다 요청하면 느리다.
`swipes` INSERT는 백그라운드로 보낸다 — 실패해도 넘기는 건 막지 않는다.

> 좌/우 스와이프는 **이전/다음 이동**이지 호불호가 아니다 (02 기획서).
> 틴더처럼 보이지만 like/nope가 아니다.

**피드가 비면** "다 보셨어요 — 전체 목록 보기" 카드 하나를 마지막에 둔다. 13번으로 간다.

### 4.2b 목록 (화면 13)

```sql
SELECT i.*, o.name AS org_name,
       (SELECT url FROM item_photos WHERE item_id = i.id ORDER BY sort_order LIMIT 1) AS thumb
FROM items i JOIN organizations o ON o.id = i.org_id
WHERE i.status IN ('open', 'reserved')            -- 예약된 것도 보인다. "예약됨" 뱃지
  AND i.org_id <> $my_org
  AND ($category IS NULL OR i.category = $category)
ORDER BY i.created_at DESC
LIMIT 30 OFFSET $page * 30;
```

`swipes`를 안 본다. 이건 재방문용이라 "이미 본 것"이 오히려 찾는 대상이다.
`reserved`를 보여주는 이유: 예약이 깨질 수 있고, 등록자가 "다음 분"을 찾을 때 신청이
쌓여 있는 게 낫다. 뱃지로 상태만 정직하게 표시한다.

### 4.3 채팅 시작 (화면 9 → 11)

```
[채팅하기] 터치
  → POST /api/transfers { item_id }
  → INSERT ... ON CONFLICT (item_id, requester_id) DO NOTHING
  → 기존 행이 있으면 그 id 반환 (04 기획서의 "검증" 규칙)
  → /messages/{transferId}로 이동
```

04 기획서: *"메시지 상대, 양도 항목의 키값이 동일한 대화 존재 시 TRUE"*
→ `UNIQUE (item_id, requester_id)` 하나로 구현된다. 재신청해도 방이 하나다.

### 4.4 드리기로 함 → 양도 완료 (화면 11)

등록자에게만 버튼 2개가 보인다. 순서가 있다.

```
[이 분께 드리기로 했어요] 터치
  → transfers.status = 'scheduled', scheduled_at = now()
  → items.status     = 'reserved'
  → 같은 물품의 다른 채팅방 상단 + 목록에 "예약됨" 표시
  → 같은 버튼이 [예약 취소]로 바뀐다 → 되돌리면 requested / open

[양도 완료] 터치 (scheduled 상태에서만 활성)
  → 트랜잭션:
      transfers.status  = 'completed', completed_at = now()
      items.status      = 'completed'
      나머지 transfers  = 'cancelled'
```

`scheduled`를 거치지 않고 바로 `completed`로 가는 경로는 **막는다.** 예약 없이 완료가
되면 다른 신청자들이 아무 예고 없이 `cancelled`를 받는다. 버튼 하나를 더 누르는 비용으로
헛걸음을 막는다.

**앱 레벨 트랜잭션.** 트리거로 넣으면 디버깅이 지옥이 된다.

이게 곧 **나눔 이력**이다 — 법적 검토 §5가 요구한 "누가·언제·무엇을·어느 기관에"가
`transfers` 한 행에 다 있다. 별도 로그 테이블을 만들지 않는다.

### 4.5 내리기 (화면 12)

```
내 정보 > 등록 물품 > [내리기] 터치
  → 확인 한 번 ("진행 중인 대화 N개가 종료돼요")
  → 트랜잭션:
      items.status      = 'withdrawn'
      진행 중 transfers = 'cancelled'
```

삭제가 아니라 상태 변경이다. 사진·대화·이력이 남는다. `completed`된 물품은 내릴 수 없다 —
이미 넘어간 것이라 버튼 자체가 안 보인다.

---

## 5. 실시간을 쓰지 않는다

채팅에 WebSocket을 붙이지 않는다. **폴링으로 시작한다.**

- 채팅방: 5초 폴링
- 메시지 목록: 화면 진입 시 1회

이유: 담당자끼리 하루에 몇 통 주고받는 서비스다. 실시간 인프라를 세울 값어치가
없고, Vercel에서 WebSocket을 유지하려면 별도 서비스가 필요하다. 느리다는 피드백이
나오면 그때 올린다.

---

## 6. 만드는 순서

각 단계마다 **돌아가는 것**이 남는다. 중간에 멈춰도 데모가 된다.

| # | 범위 | 끝나면 확인할 것 |
|---|---|---|
| 1 | 스키마 + 시드 | `categories` 10행, 테이블 생성 |
| 2 | 로그인 + 소속 + 승인 | 가입해서 verified까지 도달 |
| 3 | 등록 (5·6·7) | 물품이 DB에 들어감. 🔴이 막히는지 확인 |
| 4 | 스와이프 + 목록 (8·9·13) | 다른 기관 계정으로 그 물품이 보임. 다 넘긴 뒤 목록에서 다시 찾힘 |
| 5 | 채팅 (10·11) | 두 계정이 대화함 |
| 6 | 드리기로 함 → 양도 완료 | `reserved` 뱃지가 세 번째 계정에 보임 → `completed` 후 스와이프·목록에서 사라짐 |
| 7 | 내 정보 + 내리기 (12) | 등록/신청/수령 목록이 맞음. 내린 물품이 목록에서 사라지고 대화가 종료됨 |

**2번이 가장 지루하고 가장 중요하다.** OAuth·소속·승인이 안 되면 나머지를
테스트할 계정 자체가 안 만들어진다.

---

## 7. 결정 — 구현하면서 정한 것 (2026-09-08)

1. **사진 저장소** — 지금은 로컬 `public/uploads` (`web/src/lib/storage.ts` 한 함수 뒤).
   **Vercel 배포 시 사진이 전부 깨진다** — 빌드 시점 스냅샷이라. 배포 전에 `putImage`를
   Vercel Blob/S3로 바꾼다. 다른 코드는 안 건드린다.
2. **OAuth** — Auth.js v5. 구글·카카오는 env에 클라이언트 ID가 있을 때만 켜진다.
   개발 중엔 `dev` 프로바이더(이메일만 입력)로 전체 흐름을 돌린다 — 프로덕션 빌드에선 빠진다.
   **실제 구글·카카오 로그인은 아직 한 번도 안 돌았다.** 클라이언트 ID 발급은 사람 몫.
3. **운영자** — `ADMIN_EMAILS` env. 그 이메일로 로그인하면 `is_admin`. 팀 3인 전부 넣어도 된다.
4. **거리 표시** — 안 보여준다. `lat`/`lng` 컬럼은 남겨뒀다.

---

## 8. 검수 기록 (2026-09-08)

첫 설계에서 "한 바퀴"에 안 든다고 뺐다가 **셋 다 다시 넣었다.** 합쳐서 화면 1개 + 버튼 3개.
빼면 9월 인터뷰 5명이 첫 사용에서 셋 중 하나에 걸린다는 판단이었다.

| 넣은 것 | 뺐을 때 생기는 일 | 어디로 들어갔나 |
|---|---|---|
| 물품 목록 (화면 13) | `swipes`가 본 것을 영구 제외 → 물품 수십 개 서비스에서 며칠이면 피드가 빔. "아까 그거" 다시 못 찾음 | §1, §4.2b |
| 드리기로 함 (예약) | 세 명 채팅 중 한 명과 합의해도 나머지는 `open`인 줄 앎 → 헛걸음. 스키마의 `reserved`가 도달 불가 상태였음 | §4.4 |
| 내리기 | 오타·중복 등록을 못 지움. `withdrawn`도 도달 불가 상태였음 | §4.5 |

교훈: **스키마에 있는 상태에 도달하는 화면이 없으면 그 상태는 없는 것이다.** 상태 흐름표
(`DB-SCHEMA.md` §3)의 화살표마다 화면 번호를 붙여 검산하는 게 맞았다.

### 8.1 고칠 필요 없지만 알아둘 것

- **양도 완료를 등록자만 누른다.** 수령자가 안 받았는데 완료될 수 있다. 감사 대응
  근거로는 양쪽 확인이 낫지만 MVP에선 과하다. `completed_at`과 채팅 이력으로 충분.
- **사진은 등록 전에 업로드된다.** 중간에 나가면 저장소에 고아 파일이 남는다.
  초기 규모에선 무시. 쌓이면 주 1회 정리 잡.
- **카카오 로그인은 이메일이 안 올 수 있다.** 스키마에서 `email`을 nullable로 바꿨다.
  카카오 개발자 콘솔에서 이메일 항목은 "선택 동의"이고, 필수로 바꾸려면 비즈 앱
  전환이 필요하다. MVP는 선택 동의로 간다.

---

## 부록 — AI를 나중에 붙일 때

`ai/` 디렉토리에 이미 구현돼 있다 (`ai/README.md`). 붙일 때 필요한 것:

1. **스키마 추가** — `item_drafts` 테이블 (초안 보관), `items.created_from_draft`
2. **화면 추가** — 등록 화면에 토글 2개, REVIEW 화면 1개
3. **API 추가** — `POST /api/drafts` (사진 → 초안 M개)

지금 스키마와 충돌하지 않는다. `items`는 그대로 두고 앞단에 초안 단계만 얹는 구조라,
MVP를 다 만든 뒤에 얹어도 기존 코드를 고칠 일이 없다.

**검증되지 않은 전제**: AI가 물품 사진을 제대로 분류하고 쓸 만한 한국어 설명을
쓰는지 아직 실측하지 않았다. 골든셋 20장으로 확인해야 한다 (`ai/README.md`).
