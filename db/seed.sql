-- 카테고리. 순서·이름은 QA 1차(2026-09-29): 공예·만들기 재료, 행사·인테리어를 위로, 폐홍보물·폐현수막을 아래로.
-- 전기·소형비품(electronics, 🔴)은 뺐다 — decisions/0011. 안내 문구(notice)는 상세에서 지웠고 등록 화면은 공통 문구 하나.
INSERT INTO categories (code, label, risk_level, notice, sort_order) VALUES
  ('stationery',  '문구·사무용품',     'green',  NULL, 10),
  ('packaging',   '포장·박스류',       'green',  NULL, 20),
  ('craft',       '공예·만들기 재료',  'green',  NULL, 30),
  ('disposable',  '일회용품·위생용품', 'green',  NULL, 40),
  ('event',       '행사·파티용품',     'yellow', NULL, 50),
  ('interior',    '인테리어·소품',     'yellow', NULL, 60),
  ('printed',     '폐홍보물·인쇄물',   'green',  NULL, 70),
  ('banner',      '폐현수막·배너',     'green',  NULL, 80),
  ('etc',         '기타',              'yellow', NULL, 100)
ON CONFLICT (code) DO UPDATE
  SET label = EXCLUDED.label, risk_level = EXCLUDED.risk_level,
      notice = EXCLUDED.notice, sort_order = EXCLUDED.sort_order;

-- 이미 만든 DB에서 전기·소형비품을 지운다 (물품·관심이 없을 때만 — FK가 막는다)
DELETE FROM categories WHERE code = 'electronics';
