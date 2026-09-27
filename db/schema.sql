-- 나눔곳간 스키마. 근거: DB-SCHEMA.md
-- 실행: psql -d nanum_gotgan -f db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid (PG14)

-- ─── 기관·담당자 ────────────────────────────────────────────────────────────

CREATE TABLE organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  name_norm     text NOT NULL UNIQUE,
  org_type      text NOT NULL CHECK (org_type IN ('위탁', '직영', '모름')),
  -- 회원가입 STEP 2. '-' 없는 10자리. 국세청 상태조회로 실재·휴폐업만 본다 —
  -- 상호(기관명)는 그 API가 검증하지 않으므로 소속 판정은 여전히 사람이 승인한다.
  biz_no        text,
  address       text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  created_by    uuid,                        -- FK는 users 생성 후 아래에서
  verified      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id),
  email           text,                      -- 카카오는 선택 동의라 NULL 가능
  auth_provider   text NOT NULL CHECK (auth_provider IN ('google', 'kakao', 'dev')),
  auth_subject    text NOT NULL,
  nickname        text NOT NULL,
  profile_image   text,

  -- 회원가입 STEP 1 (기획 정의서). nickname은 OAuth 프로필이라 실명이 아닐 수 있다.
  real_name       text,
  phone           text,

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

-- organizations ⇄ users 순환 참조. 둘 다 만든 뒤에 건다.
ALTER TABLE organizations
  ADD CONSTRAINT fk_org_created_by FOREIGN KEY (created_by) REFERENCES users(id);

-- ─── 카테고리 ──────────────────────────────────────────────────────────────

CREATE TABLE categories (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  risk_level  text NOT NULL CHECK (risk_level IN ('green', 'yellow', 'red')),
  notice      text,
  sort_order  integer NOT NULL
);

-- ─── 물품 ──────────────────────────────────────────────────────────────────

CREATE TABLE items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  created_by    uuid NOT NULL REFERENCES users(id),

  category      text NOT NULL REFERENCES categories(code),
  name          text NOT NULL,
  description   text,
  history       text,           -- 물품 히스토리(선택, 단답). 등록하기 기획(Notion 03) — "어떤 히스토리가 있는지"
  quantity      integer NOT NULL CHECK (quantity > 0),
  quantity_unit text NOT NULL DEFAULT '개',
  is_used       boolean NOT NULL,
  condition     text NOT NULL CHECK (condition IN ('상', '중', '하')),

  -- 법적 필드 (법적 검토 §5). 담당자가 입력.
  on_ledger           boolean NOT NULL DEFAULT false,
  approval_confirmed  boolean NOT NULL DEFAULT false,
  funding_source      text CHECK (funding_source IN ('자체예산', '보조금', '기타', '모름')),

  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'reserved', 'completed', 'withdrawn')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- red(전기·소형비품)는 승인 확인 없이 open 불가. red 코드가 늘면 여기도 고친다.
  CONSTRAINT chk_red_needs_approval
    CHECK (status <> 'open' OR category <> 'electronics' OR approval_confirmed)
);

CREATE INDEX idx_items_swipe ON items (status, created_at DESC) WHERE status = 'open';
CREATE INDEX idx_items_org   ON items (org_id, status);

CREATE TABLE item_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  url         text NOT NULL,
  sort_order  integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, sort_order)
);

-- ─── 나눔 건·채팅 ───────────────────────────────────────────────────────────

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

  UNIQUE (item_id, requester_id)   -- 04 기획서 "검증" 규칙. 채팅방도 이 쌍으로 1개.
);

CREATE INDEX idx_transfers_requester ON transfers (requester_id, status);
CREATE INDEX idx_transfers_item      ON transfers (item_id, status);

CREATE TABLE messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id  uuid NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL REFERENCES users(id),
  body         text NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_thread ON messages (transfer_id, created_at);

-- ─── 북마크·스와이프 ────────────────────────────────────────────────────────

CREATE TABLE bookmarks (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE swipes (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- ─── 관심 자원 키워드 ───────────────────────────────────────────────────────
-- 가입 때 4개 이상 고른다 (기획 정의서 STEP 3). 스와이프 피드 정렬에 쓴다.
-- 🔴 카테고리는 추천 대상이 아니다 — 등록은 승인 확인을 거쳐 가능하지만,
-- "관심 자원"으로 먼저 들이밀지는 않는다.

CREATE TABLE user_interests (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    text NOT NULL REFERENCES categories(code),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);
