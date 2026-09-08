-- 카테고리 시드. 법적 검토 §4 그대로. 실행: psql -d nanum_gotgan -f db/seed.sql
INSERT INTO categories (code, label, risk_level, notice, sort_order) VALUES
  ('stationery',  '문구·사무용품',     'green',  NULL, 10),
  ('packaging',   '포장·박스류',       'green',  NULL, 20),
  ('craft',       '공예 재료',         'green',  NULL, 30),
  ('disposable',  '일회용품·위생용품', 'green',  NULL, 40),
  ('printed',     '폐홍보물·인쇄물',   'green',  NULL, 50),
  ('banner',      '폐현수막·배너',     'green',  NULL, 60),
  ('event',       '행사·파티용품',     'yellow', '반복 사용하는 물품이면 비품으로 관리될 수 있어요. 확인해 주세요.', 70),
  ('interior',    '인테리어·소품',     'yellow', '반복 사용하는 물품이면 비품으로 관리될 수 있어요. 확인해 주세요.', 80),
  ('electronics', '전기·소형비품',     'red',    '물품 대장 등재 여부를 확인하고, 내부 처분 승인을 받은 뒤 등록해 주세요.', 90),
  ('etc',         '기타',              'yellow', NULL, 100)
ON CONFLICT (code) DO UPDATE
  SET label = EXCLUDED.label, risk_level = EXCLUDED.risk_level,
      notice = EXCLUDED.notice, sort_order = EXCLUDED.sort_order;
