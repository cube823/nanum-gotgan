-- 시연 전 초기화 — 가입 계정과 그들이 만든 것을 모두 지우고 시연 데이터만 남긴다 (QA 1차 요청, 2026-09-30 00:00).
-- 남기는 것: 시드 기관(created_by 없음, db/orgs.sql) · 시연 담당자 3명(dev / demo-*) · 시연 물품 3개와 사진(db/demo-items.sql).
-- 지우는 것: 그 밖의 모든 사용자 · 그들의 물품·사진·스와이프·북마크·관심 · 모든 나눔 건·메시지 · 가입 때 새로 만든 기관.
--   psql "$NEON_URL" -v ON_ERROR_STOP=1 -f db/reset-to-demo.sql            -- 실행
--   psql "$NEON_URL" -v ON_ERROR_STOP=1 -v dry=1 -f db/reset-to-demo.sql   -- 미리보기(롤백)
-- 올린 사진 파일(Blob)은 지우지 않는다 — DB에서 끊기면 보이지 않는다.
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE keep_u ON COMMIT DROP AS
  SELECT id FROM users WHERE auth_provider = 'dev' AND auth_subject LIKE 'demo-%';
CREATE TEMP TABLE del_u ON COMMIT DROP AS SELECT id FROM users WHERE id NOT IN (SELECT id FROM keep_u);
CREATE TEMP TABLE del_i ON COMMIT DROP AS SELECT id FROM items WHERE created_by IN (SELECT id FROM del_u);
CREATE TEMP TABLE del_o ON COMMIT DROP AS
  SELECT id FROM organizations WHERE created_by IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM users u WHERE u.org_id = organizations.id AND u.id IN (SELECT id FROM keep_u));

SELECT (SELECT count(*) FROM del_u) AS users_del, (SELECT count(*) FROM keep_u) AS users_keep,
       (SELECT count(*) FROM del_i) AS items_del, (SELECT count(*) FROM items) - (SELECT count(*) FROM del_i) AS items_keep,
       (SELECT count(*) FROM transfers) AS transfers_del, (SELECT count(*) FROM messages) AS messages_del,
       (SELECT count(*) FROM del_o) AS orgs_del;

DELETE FROM messages;                                   -- 시연 물품의 대화도 테스트였다
DELETE FROM transfers;
DELETE FROM bookmarks WHERE user_id IN (SELECT id FROM del_u) OR item_id IN (SELECT id FROM del_i);
DELETE FROM swipes    WHERE user_id IN (SELECT id FROM del_u) OR item_id IN (SELECT id FROM del_i);
DELETE FROM user_interests WHERE user_id IN (SELECT id FROM del_u);
DELETE FROM item_photos WHERE item_id IN (SELECT id FROM del_i);
DELETE FROM items WHERE id IN (SELECT id FROM del_i);
UPDATE items SET status = 'open' WHERE status IN ('reserved', 'completed');   -- 시연 물품을 다시 나눔 중으로
UPDATE users SET verified_by = NULL WHERE verified_by IN (SELECT id FROM del_u);
UPDATE organizations SET created_by = NULL WHERE created_by IN (SELECT id FROM del_u) AND id NOT IN (SELECT id FROM del_o);
DELETE FROM users WHERE id IN (SELECT id FROM del_u);
DELETE FROM organizations WHERE id IN (SELECT id FROM del_o);

SELECT (SELECT count(*) FROM users) AS users_left, (SELECT count(*) FROM items) AS items_left,
       (SELECT count(*) FROM organizations) AS orgs_left, (SELECT count(*) FROM transfers) AS transfers_left;

\if :{?dry}
ROLLBACK;
\echo '(dry run — 롤백함)'
\else
COMMIT;
\endif
