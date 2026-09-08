# 나눔곳간 — DB 스키마 설계

전제: PostgreSQL. 이 레포에서 새로 만든다 (Replit 목업은 참고용, DB가 사실상 없다).
근거 문서: 기획서 00·02·03·04·05, 법적 검토.

**AI 기능은 이 문서 범위 밖이다.** 등록 화면의 AI 토글 2개는 부가 기능이고, 없어도 서비스는
돌아간다 — 사진 찍고 손으로 입력하면 된다. 나중에 붙일 때 필요한 것은 `MVP.md` §부록 참조.

---

## 0. 설계 판단 3개

**① 계정은 개인, 소속은 기관.**
05 기획: "개인 위주로 정보가 보이고, 소속기관명이 상단에". 법적 검토 §5: "기관 단위 계정 + 담당자 소속 확인 (개인 수령 차단)".
→ `users`(개인) + `organizations`(기관), 담당자는 기관에 소속. 물품의 소유자는 **기관**이고 등록 행위자는 **개인**이다. 둘 다 남긴다.

기관 명단은 **시딩하지 않는다.** 자기신고 + 관리자 승인 (§1.5). 법적 검토가 요구한 건 명단의 정확성이 아니라 **개인 수령 차단**이므로, 필요한 건 마스터 데이터가 아니라 "이 사람이 그 기관 담당자가 맞다"는 승인 기록이다.

**② 나눔 1건 = `transfers` 1행.**
04에 "약속 잡기 / 양도 완료 / 후기", 05에 "신청 물품 / 수령 물품"이 나온다. 이건 채팅에 딸린 상태가 아니라 **독립 엔티티**다. 채팅방이 아니라 나눔 건이 상태를 가진다.
04 검증 규칙이 이걸 증명한다 — "메시지 상대, 양도 항목의 키값이 동일한 대화 존재 시 TRUE" → 대화는 `(상대, 물품)` 쌍으로 식별된다. 그 쌍이 곧 `transfers`다.

**③ 물품 등록은 한 번에 끝난다.**
사진 올리고 항목 채우고 등록. 중간 저장 상태(임시저장·초안)를 만들지 않는다. 03 기획서의 플로우가
그렇게 되어 있고, 상태가 하나 늘면 스와이프 쿼리가 매번 필터를 달고 다녀야 한다.

---

## 1. 테이블

### organizations — 기관

```sql
CREATE TABLE organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  name_norm     text NOT NULL UNIQUE,   -- 공백·특수문자 제거한 정규화 이름
  org_type      text NOT NULL CHECK (org_type IN ('위탁', '직영', '모름')),
  address       text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  created_by    uuid,                        -- 이 기관을 처음 만든 사람. FK는 아래에서 뒤늦게 건다
  verified      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- organizations.created_by → users, users.org_id → organizations 가 서로를 가리킨다.
-- 두 테이블을 다 만든 뒤에 이 FK를 건다. CREATE TABLE 안에 넣으면 어느 순서로도 실패한다.
ALTER TABLE organizations
  ADD CONSTRAINT fk_org_created_by FOREIGN KEY (created_by) REFERENCES users(id);
```

`org_type`이 여기 있는 이유: 법적 검토상 승인 체계가 위탁/직영에 따라 갈린다. 개인이 아니라 **기관의 속성**이다. `'모름'`을 허용하는 이유는 §1.5 참조 — 담당자가 본인 기관의 위탁/직영 구분을 모르는 경우가 실제로 있다.

`name_norm`: 공백·`(`·`)`·`-` 제거 후 소문자화해 UNIQUE. `"강남구 청년센터"`와 `"강남구청년센터"`는 여기서 합쳐진다.
**`"강남청년센터"`(글자가 빠진 경우)는 못 잡는다** — 정규화로 되는 건 띄어쓰기·기호 차이까지다. 글자가 다른 표기 흔들림은
자동완성이 막아야 한다: 두 글자만 쳐도 기존 기관이 먼저 뜨게 해서, "새로 만들기"가 마지막 선택지가 되게 한다.

`lat`/`lng`: 02 스와이프 카드에 `{0}km` 거리 표시가 있다. 거리는 저장하지 않고 조회 시 계산한다.

### users — 담당자

```sql
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id),   -- 가입 직후엔 NULL 가능
  email           text,                      -- 카카오는 이메일 동의가 선택이라 NULL 가능
  auth_provider   text NOT NULL CHECK (auth_provider IN ('google', 'kakao')),
  auth_subject    text NOT NULL,
  nickname        text NOT NULL,
  profile_image   text,

  -- 소속 확인 (§1.5)
  org_role        text NOT NULL DEFAULT 'member'
                  CHECK (org_role IN ('member', 'manager')),
  org_status      text NOT NULL DEFAULT 'pending'
                  CHECK (org_status IN ('pending', 'verified', 'rejected')),
  verified_by     uuid REFERENCES users(id),
  verified_at     timestamptz,
  is_admin        boolean NOT NULL DEFAULT false,

  last_seen_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, auth_subject)
);

CREATE INDEX idx_users_pending ON users (org_id) WHERE org_status = 'pending';
```

배포본 로그인 화면에 구글/카카오 두 개만 있다 — 실측대로 `CHECK`에 박았다.

계정의 정체성은 `(auth_provider, auth_subject)`다. `email`이 아니다. 카카오는 이메일 제공이
**선택 동의**라 비어 올 수 있고, 같은 사람이 구글과 카카오로 각각 가입하면 두 계정이 된다 —
MVP에서는 그걸 합치지 않는다. 이메일은 승인 화면의 판단 근거로만 쓴다 (§1.5).

`org_id`가 NULL 가능한 이유: OAuth 로그인 직후엔 아직 기관을 안 골랐다. 소속 선택 화면으로 보내는 조건이 `org_id IS NULL`이다.

`org_role`은 05 기획서의 "기관용 메뉴 구역"(우리 기관 구성원 / 우리 기관 후기)과 이미 맞물린다 — 기획서에 있던 구분이다.

`last_seen_at`: 05의 "최근 접속 시간 표시 규칙"(1일 이내 N시간 전 / 1주 이내 N일 전 / 1달 초과 N달 전). **표시 문자열은 저장하지 않는다.** 타임스탬프만 두고 렌더링 때 계산한다.

거래 횟수(02: "거래횟수(나눔 00회, 재활용 00회)")도 컬럼으로 두지 않는다 — `transfers`에서 센다. 비정규화는 느려지면 그때.

---

## 1.5 소속기관 확인 — 자기신고 + 승인

**시딩하지 않는다.** 서울시 청년공간 명단을 확보할 경로가 불확실하고, 확보해도 기관은 계속 생기고 없어진다. 관리 주체 없는 마스터 데이터는 썩는다.

대신 **첫 사용자가 기관을 만들고, 두 번째부터는 자동완성에서 고른다.** 명단이 사용자 손으로 쌓인다.

### 흐름

```
OAuth 로그인
  → org_id IS NULL → 소속 선택 화면
      ├─ 자동완성에 있음 → 그 기관 선택
      └─ 없음 → 새로 입력 (기관명 + 위탁/직영/모름)
                → organizations 신규 행 (verified = false)
                → 만든 사람이 org_role = 'manager'
  → org_status = 'pending'
      ├─ 조회·스와이프  ✅ 허용
      └─ 등록·신청      ❌ 차단
  → 승인 → org_status = 'verified'
```

### 승인 주체 — 2단계

| 상황 | 승인자 | 근거 |
|---|---|---|
| 기관의 **첫 담당자** | 운영자 (`is_admin`) | 기관 자체가 실재하는지 확인해야 한다 |
| 같은 기관 **2번째부터** | 그 기관의 `manager` | 이미 검증된 내부자가 동료를 안다 |

운영자 부담이 **기관 수만큼만** 남고 그 뒤로는 자율 운영된다. 참여 기관이 수십 곳 규모고 9월 인터뷰 대상이 5명이니, 초기엔 하루 몇 건이다.

```sql
-- 내가 승인할 수 있는 대기자
SELECT u.* FROM users u
WHERE u.org_status = 'pending'
  AND (
    $me_is_admin                                    -- 운영자: 전부
    OR (u.org_id = $my_org AND $my_role = 'manager') -- 매니저: 우리 기관만
  );
```

### 차단 지점은 두 곳뿐

```
items      INSERT  →  org_status = 'verified' 필수
transfers  INSERT  →  org_status = 'verified' 필수
그 외 조회         →  pending 허용
```

**조회를 막지 않는 이유**: 서비스를 먼저 보여줘야 가입 유인이 생긴다. 빈 화면에 "승인 대기 중"만 띄우면 이탈한다. 스와이프로 물건을 구경하다가 "이거 필요한데" 할 때 승인 요청 배너를 띄우는 게 낫다.

앱 레벨에서 건다. DB CHECK로 걸면 `users` 조인이 필요해 제약이 못 쓴다.

### 이 방식이 막지 못하는 것

**기관명 사칭.** 아무나 "강남구 청년센터"라고 입력할 수 있고, 관리자 승인이 유일한 방어선이다. 그래서 승인 화면에는 판단 근거가 필요하다 — 이메일 도메인, 담당자명, 가입 시각 정도는 보여줘야 한다.

이메일 도메인은 **보조 신호로만** 쓴다. `@seoul.go.kr` / `@*.or.kr`이면 승인 화면에 초록 뱃지를 달아 운영자 판단을 돕되, 자동 승인하지는 않는다. 위탁운영 담당자가 개인 gmail·카카오를 쓰는 경우가 흔해 이것만으로는 절반도 못 거른다.

---

### items — 물품

```sql
CREATE TABLE items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  created_by    uuid NOT NULL REFERENCES users(id),

  category      text NOT NULL REFERENCES categories(code),
  name          text NOT NULL,
  description   text,
  quantity      integer NOT NULL CHECK (quantity > 0),
  quantity_unit text NOT NULL DEFAULT '개',
  is_used       boolean NOT NULL,
  condition     text NOT NULL CHECK (condition IN ('상', '중', '하')),

  -- 법적 필드 (법적 검토 §5) — 등록 화면에서 담당자가 입력한다.
  on_ledger           boolean NOT NULL DEFAULT false,
  approval_confirmed  boolean NOT NULL DEFAULT false,
  funding_source      text CHECK (funding_source IN ('자체예산', '보조금', '기타', '모름')),

  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'reserved', 'completed', 'withdrawn')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_swipe ON items (status, created_at DESC) WHERE status = 'open';
CREATE INDEX idx_items_org   ON items (org_id, status);
```

`org_id`와 `created_by`를 **둘 다** 둔다. 물품 소유자는 기관(법적 검토: 소유자는 운영법인 또는 지자체)이고, 등록 행위자는 개인이다. 담당자가 퇴사해도 물품은 기관에 남는다.

`is_used`/`condition`은 02 카드 스펙 그대로다 (사용 여부 yes/no, 상태 상중하).

### categories — 카테고리 + 리스크 등급

```sql
CREATE TABLE categories (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  risk_level  text NOT NULL CHECK (risk_level IN ('green', 'yellow', 'red')),
  notice      text,
  sort_order  integer NOT NULL
);
```

**테이블로 두는 이유**: 법적 검토의 리스크 등급은 조례·협약 확인 결과에 따라 바뀔 수 있다(체크리스트 §5에 "확인 필요" 항목이 남아 있다). enum으로 박으면 마이그레이션이 필요하고, 테이블이면 한 행 수정이다.

시드 (법적 검토 §4 그대로):

| code | label | risk_level |
|---|---|---|
| `stationery` | 문구·사무용품 | green |
| `packaging` | 포장·박스류 | green |
| `craft` | 공예 재료 | green |
| `disposable` | 일회용품·위생용품 | green |
| `printed` | 폐홍보물·인쇄물 | green |
| `banner` | 폐현수막·배너 | green |
| `event` | 행사·파티용품 | **yellow** |
| `interior` | 인테리어·소품 | **yellow** |
| `electronics` | 전기·소형비품 | **red** |
| `etc` | 기타 | yellow |

`notice`: yellow는 "반복 사용품이면 비품일 수 있어요", red는 "대장 등재 여부를 확인하고 내부 승인을 받으세요".

**red 물품은 `approval_confirmed = true` 없이 `status = 'open'`이 될 수 없다.** 앱 레벨이 아니라 DB 제약으로 건다:

```sql
ALTER TABLE items ADD CONSTRAINT chk_red_needs_approval CHECK (
  status <> 'open' OR category <> 'electronics' OR approval_confirmed
);
```

PostgreSQL CHECK에는 서브쿼리를 못 쓴다. red 코드는 지금 `electronics` 하나뿐이라 하드코딩한다.
red 카테고리가 늘면 이 제약을 고친다 — `categories` 행 추가만으로는 방어선이 안 생긴다는 뜻이니, 시드 표 옆에 이 사실을 적어둔다.

### item_photos — 물품 사진

```sql
CREATE TABLE item_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  url         text NOT NULL,
  sort_order  integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, sort_order)
);
```

02에 "사진 우측 터치: 다음 사진 / 좌측 터치: 이전 사진"이 있으니 순서가 의미를 가진다. 03의 최대 10장 제한은 앱에서 건다 (DB 제약으로 걸면 나중에 늘릴 때 마이그레이션이다).

### transfers — 나눔 건 (신청 → 양도)

```sql
CREATE TABLE transfers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES items(id),
  requester_id  uuid NOT NULL REFERENCES users(id),
  requester_org uuid NOT NULL REFERENCES organizations(id),

  status        text NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'scheduled', 'completed', 'cancelled')),
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (item_id, requester_id)
);
```

`UNIQUE (item_id, requester_id)`가 04의 검증 규칙을 그대로 구현한다 — "메시지 상대, 양도 항목의 키값이 동일한 대화 존재 시 TRUE". 같은 사람이 같은 물품에 두 번 신청할 수 없고, 채팅방도 이 쌍으로 1개다.

`requester_org`: 05 피드백의 "한 기관에서 여러 명이 신청한 경우 [ㅇㅇ님이 이미 나눔 신청한 물품입니다]"를 지원한다. `users`로 조인해도 되지만, 기관 단위 중복 체크가 잦으므로 여기 둔다.
> 기획 코멘트상 이 기능은 "없어도 될 것 같아서 목업에 구현 안함"이다. 컬럼만 두고 기능은 나중에.

`scheduled_at`: 04의 "약속 잡기" 버튼 (양도 미완료 시에만 활성화 → `status = 'requested'`).
`completed_at`: 양도 완료. 05의 "수령 물품" 필터가 `status = 'completed' AND requester_id = me`다.

**나눔 이력 기록**(법적 검토 §5: "누가·언제·무엇을·어느 기관에 — 감사 대응 겸 운영 실적 보고")이 바로 이 테이블이다. 별도 로그 테이블을 만들지 않는다. `transfers`가 이미 그 네 가지를 전부 갖고 있다.

### messages — 채팅

```sql
CREATE TABLE messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id  uuid NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES users(id),
  body         text NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread ON messages (transfer_id, created_at);
```

**채팅방 테이블이 따로 없다.** `transfer_id`가 곧 방이다 — 04에서 대화가 `(상대, 물품)` 쌍으로 식별되고, 그게 `transfers`의 UNIQUE 키다. 방을 따로 만들면 같은 걸 두 번 관리하게 된다.

`read_at`: 04의 "새 메시지가 왔을 때 테마색 닷(dot)". 목록에서 `read_at IS NULL` 카운트.

`created_at` 오름차순 인덱스: 04에 "과거의 채팅을 상단에" 명시.

### bookmarks — 북마크

```sql
CREATE TABLE bookmarks (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
```

02의 하트 = 체크박스(TRUE 등록 / FALSE 해제), 05의 북마크 창. 복합 PK면 토글이 `INSERT ... ON CONFLICT DO NOTHING` / `DELETE` 두 줄로 끝난다.

### swipes — 스와이프 이력

```sql
CREATE TABLE swipes (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
```

이미 넘긴 물품을 다시 보여주지 않기 위한 것뿐이다. 좌/우 방향은 저장하지 않는다 — 02에서 좌/우 스와이프는 **이전/다음 물품 이동**이지 호불호가 아니다. 틴더처럼 보이지만 like/nope가 아니다. (호감 표시는 하트 = `bookmarks`가 담당한다.)

> 추천 모델용 데이터가 아니다. 초기엔 추천을 만들지 않는다 — 아이템이 수십 개면 정렬로 충분하다.

---

## 2. 후순위 — 지금 만들지 않는 것

05 기획서 코멘트에 담당자가 직접 "제작 후순위 / 개발 후순위"라고 달아둔 항목들이다. 스키마도 그에 맞춘다.

| 항목 | 근거 | 조치 |
|---|---|---|
| **후기(리뷰)** | 04·05 양쪽에 "후기 보내는 기능 없을 시 삭제" 코멘트 | `reviews` 테이블 **만들지 않음** |
| 활동 점수 | 05 "활동 관련한 척도 나타내는 점수? 같은거" — 물음표가 붙어 있다 | 미정의. 정해지면 그때 |
| 우리 기관 구성원/후기 | 05 "제작 후순위" | `users.org_id`로 조회 가능. 별도 테이블 불필요 |

후기가 살아나면 `transfers`에 1:1로 붙이면 된다. 지금 만들면 빈 테이블만 남는다.

---

## 3. 상태 흐름

```
items.status:     open ⇄ reserved ──→ completed
                    └──────┴────────→ withdrawn

transfers.status: requested ⇄ scheduled ──→ completed
                      └──────────┴────────→ cancelled
```

`completed`는 반드시 `scheduled`를 거친다. `requested`에서 바로 `completed`로 가는 경로는 **없다**
— 예약 없이 완료되면 다른 신청자가 예고 없이 `cancelled`를 받는다 (`MVP.md` §4.4).

**화살표마다 화면이 있는지 검산한 표.** 검수(2026-09-08)에서 `reserved`·`withdrawn`이
도달 불가 상태였던 게 드러났다 — 스키마에 있어도 가는 화면이 없으면 없는 상태다.

| 전이 | 누가 | 화면 | 함께 바뀌는 것 |
|---|---|---|---|
| `transfers` requested → scheduled | 등록자 | 11 채팅방 "드리기로 함" | `items` open → reserved |
| `transfers` scheduled → requested | 등록자 | 11 채팅방 "예약 취소" | `items` reserved → open |
| `transfers` scheduled → completed | 등록자 | 11 채팅방 "양도 완료" | `items` → completed, 나머지 `transfers` → cancelled |
| `items` open/reserved → withdrawn | 등록자 | 12 내 정보 "내리기" | 진행 중 `transfers` → cancelled |

**전부 앱 레벨 트랜잭션으로 처리한다.** 트리거로 넣으면 디버깅이 지옥이 된다.

04 피드백에 "현재 양도 완료 상태이면 등록한 물품으로 가도록 로직이 짜여져있는데 내가 등록한 물품을 구분할 수 있는 로직이 필요"라고 되어 있는데, `items.created_by = me` vs `transfers.requester_id = me`로 갈리므로 이 스키마에서 자연히 해결된다.

---

## 4. 주요 쿼리

**스와이프 피드** (02) — 안 본 것, 내 기관 것 제외:
```sql
SELECT i.*, o.name AS org_name, o.lat, o.lng
FROM items i
JOIN organizations o ON o.id = i.org_id
WHERE i.status = 'open'
  AND i.org_id <> $my_org
  AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.user_id = $me AND s.item_id = i.id)
ORDER BY i.created_at DESC
LIMIT 20;
```

**메시지 목록** (04) — 안 읽은 수 포함:
```sql
SELECT t.id, i.name, i.status,
       (SELECT body FROM messages WHERE transfer_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
       (SELECT count(*) FROM messages WHERE transfer_id = t.id AND read_at IS NULL AND sender_id <> $me) AS unread
FROM transfers t
JOIN items i ON i.id = t.item_id
WHERE t.requester_id = $me OR i.created_by = $me
ORDER BY t.created_at DESC;
```

**내 정보 3개 창** (05):
```sql
-- 북마크
SELECT i.* FROM bookmarks b JOIN items i ON i.id = b.item_id WHERE b.user_id = $me;
-- 신청 물품
SELECT i.* FROM transfers t JOIN items i ON i.id = t.item_id WHERE t.requester_id = $me;
-- 수령 물품
SELECT i.* FROM transfers t JOIN items i ON i.id = t.item_id
WHERE t.requester_id = $me AND t.status = 'completed';
```

---

## 5. 확인 필요

1. ~~기관 목록을 어디서 받는가~~ — **해소됨.** 시딩하지 않고 자기신고 + 승인 (§1.5).
2. **운영자 계정을 누가 갖는가** — `is_admin`을 팀 3인(백지영·윤민기·김효빈) 전부에게 줄지, 1인이 전담할지. 초기 승인 물량이 적으니 전원도 무방하다.
3. **`org_type = '모름'` 처리** — 담당자가 본인 기관의 위탁/직영을 모르면 red 카테고리 승인 흐름을 태울 수 없다. 일단 red 등록만 막고, 9월 인터뷰에서 "본인 기관이 위탁인지 직영인지 아느냐"를 물어 실제 빈도를 확인한다.
4. **`quantity_unit`** — 02에 "10개, 1묶음" 예시가 있다. 자유 텍스트로 둘지 enum(개/묶음/박스/세트)으로 둘지. 지금은 자유 텍스트. 실제로 어떤 값이 들어오는지 보고 정한다.
5. **사진 저장소** — `MVP.md` §7-1에서 정한다. `item_photos.url`이 text라 어느 쪽이든 받는다.
