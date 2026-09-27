-- 테스트 계정이 만든 데이터를 지운다. 로컬 전용 — 프로덕션에 돌리지 않는다.
--
--   psql -d nanum_gotgan -v re='^[a-f][0-9]+@dev\.local$' -f db/cleanup-test-data.sql   -- smoke가 남긴 것 전부
--   (web/scripts/smoke.sh가 끝날 때 자기 실행 번호로 이걸 부른다: re='^[a-z]<SUF>@dev\.local$')
--
-- 지우는 것: 정규식에 맞는 사용자 · 그들이 만든 물품(사진·스와이프·북마크는 CASCADE) · 관련 나눔 건과 메시지 ·
--            그들이 만들었고 다른 사용자가 없는 기관.
-- 남기는 것: 시드 기관(created_by가 없다). 테스트 계정이 시드 기관에 합류했어도 기관은 그대로 둔다.
-- 대부분의 FK가 ON DELETE NO ACTION이라 순서가 중요하다: 메시지 → 나눔 건 → 물품 → 사용자 → 기관.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE u_del ON COMMIT DROP AS
  SELECT id FROM users WHERE email ~ :'re';

CREATE TEMP TABLE o_del ON COMMIT DROP AS
  SELECT o.id FROM organizations o
  WHERE o.created_by IN (SELECT id FROM u_del)
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.org_id = o.id AND u.id NOT IN (SELECT id FROM u_del));

CREATE TEMP TABLE i_del ON COMMIT DROP AS
  SELECT id FROM items WHERE created_by IN (SELECT id FROM u_del) OR org_id IN (SELECT id FROM o_del);

CREATE TEMP TABLE t_del ON COMMIT DROP AS
  SELECT id FROM transfers
  WHERE item_id IN (SELECT id FROM i_del) OR requester_id IN (SELECT id FROM u_del)
     OR requester_org IN (SELECT id FROM o_del);

DELETE FROM messages  WHERE transfer_id IN (SELECT id FROM t_del) OR sender_id IN (SELECT id FROM u_del);
DELETE FROM transfers WHERE id IN (SELECT id FROM t_del);
DELETE FROM items     WHERE id IN (SELECT id FROM i_del);
UPDATE users         SET verified_by = NULL WHERE verified_by IN (SELECT id FROM u_del);
UPDATE organizations SET created_by  = NULL WHERE created_by  IN (SELECT id FROM u_del);
DELETE FROM users         WHERE id IN (SELECT id FROM u_del);
DELETE FROM organizations WHERE id IN (SELECT id FROM o_del);

COMMIT;
