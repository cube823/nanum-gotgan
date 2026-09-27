-- 시연용 물품 3개 — Replit 목업(기획팀) 화면에서 옮겼다. 사진은 아직 없다 (원본 파일을 받으면 item_photos에 넣는다).
--
--   psql -d nanum_gotgan -f db/demo-items.sql
--
-- 담당자(김나래·박준영·이서현)는 목업의 **가상 인물**이다. 이메일이 없는 dev 계정이라 로그인할 수 없다.
-- 기관은 시드 명단(db/orgs.sql)의 실제 청년센터 — 지도·거리는 목업 주소가 아니라 실제 기관 주소로 나온다.
-- DB에 "크기" 칸이 없어 설명 끝에 적는다. 여러 번 돌려도 같은 결과 (계정은 auth_subject, 물품은 기관+이름으로 거른다).
\set ON_ERROR_STOP on
BEGIN;

INSERT INTO users (auth_provider, auth_subject, nickname, real_name, org_id, org_role, org_status)
SELECT 'dev', v.subject, v.name, v.name, o.id, 'manager', 'verified'
FROM (VALUES
  ('demo-kim-narae',   '김나래', '청년공간길이음'),
  ('demo-park-junyoung', '박준영', '서울광역청년센터'),
  ('demo-lee-seohyun', '이서현', '동작청년센터')
) AS v(subject, name, org_norm)
JOIN organizations o ON o.name_norm = v.org_norm
ON CONFLICT (auth_provider, auth_subject) DO NOTHING;

INSERT INTO items (org_id, created_by, category, name, description, quantity, quantity_unit,
                   is_used, condition, on_ledger, approval_confirmed, funding_source, created_at)
SELECT u.org_id, u.id, v.category, v.name, v.description, v.quantity, v.unit, v.is_used, v.condition,
       false, false, NULL, now() - interval '2 days'
FROM (VALUES
  ('demo-kim-narae', 'packaging', '크래프트 박스 5박스',
   E'행사 답례품 포장용으로 샀으나, 행사 이후 남아서 양도합니다. 사용감이 조금 있습니다.\n직접 방문 수령을 희망해요.\n\n박스당 100매 · 크기 10(가로) × 15(세로) × 5(높이)',
   5, '박스', false, '중'),
  ('demo-park-junyoung', 'packaging', '지관통 20개',
   E'포스터 배송용으로 쓰다 남은 지관통입니다. 뚜껑 포함 새것과 다름없어요.\n택배·방문 수령 모두 가능해요.\n\n크기 12cm × 30cm',
   20, '개', false, '상'),
  ('demo-lee-seohyun', 'interior', '조화 식물 3개',
   E'공간 인테리어용으로 쓰던 조화 화분입니다. 바구니 화분 포함이며 상태 양호해요.\n부피가 커서 직접 수령만 가능합니다.\n\n크기 화분 포함 높이 약 120cm',
   3, '개', true, '하')
) AS v(subject, category, name, description, quantity, unit, is_used, condition)
JOIN users u ON u.auth_provider = 'dev' AND u.auth_subject = v.subject
WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.org_id = u.org_id AND i.name = v.name AND i.status <> 'withdrawn');

COMMIT;
