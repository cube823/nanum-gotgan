# 용어 — 코드 이름과 1:1

| 용어 | 코드 | 뜻 |
|---|---|---|
| **기관** | `organizations` | 청년공간·청년센터. 물품의 **소유자**. 담당자가 퇴사해도 물품은 기관에 남는다 |
| **담당자** | `users` | 기관에 소속된 개인. 로그인 주체. 정체성은 `(auth_provider, auth_subject)`이지 이메일이 아니다 |
| 위탁 / 직영 / 모름 | `organizations.org_type` | 운영 형태. 법적 승인 체계가 갈린다. 담당자가 모르는 경우가 실제로 있어 `모름` 허용 |
| **소속 확인** | `users.org_status` = pending → verified | 자기신고 + 승인. pending은 조회만, verified만 등록·신청 |
| manager / member | `users.org_role` | 기관의 첫 담당자가 manager. 같은 기관 다음 사람을 승인할 수 있다 |
| 운영자 | `users.is_admin` | 모든 기관의 첫 담당자를 승인. `ADMIN_EMAILS` env |
| **물품** | `items` | 나눔 대상. 소모품 중심 |
| 카테고리 / 리스크 등급 | `categories.code` / `.risk_level` | 🟢 자유 · 🟡 확인 · 🔴 주의(전기·소형비품). 법적 검토 §4 그대로 |
| 법적 필드 | `on_ledger`, `approval_confirmed`, `funding_source` | 대장 등재 / 내부 승인 / 취득 재원. **사람이 입력** |
| **나눔 건** | `transfers` | 한 담당자가 한 물품에 신청한 것. `(item_id, requester_id)`로 유일. **채팅방이 곧 이것** — 방 테이블은 없다 |
| 신청 | `transfers` 생성 (`requested`) | 상세에서 "채팅하기" |
| **예약** | `transfers.scheduled` + `items.reserved` | 등록자가 "이 분께 드리기로 했어요". 되돌릴 수 있다 |
| 양도 완료 | `transfers.completed` + `items.completed` | 예약을 거쳐야만 간다. 나머지 신청은 `cancelled` |
| 내리기 | `items.withdrawn` | 삭제가 아니다. 이력은 남고 조회에서 빠진다 |
| 스와이프 | `swipes` | **본 것 기록**. 좌/우는 이전/다음 이동이지 호불호가 아니다 (틴더 아님). 호감은 북마크 |
| 목록 | 화면 13, `listFeed()` | 재방문용. `swipes`를 안 본다 |
| 나눔 이력 | = `transfers` | 법적 검토가 요구한 "누가·언제·무엇을·어느 기관에". 별도 로그 테이블 없음 |
| 기획서 00~05, 99 | Notion | 00 개요·브랜딩, 01 로그인, 02 스와이프, 03 등록, 04 메시지, 05 내 정보, 99 물품 제시(목록 컴포넌트) |
