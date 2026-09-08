# 내 정보 · 내리기

**무엇**: 프로필과 등록/신청/수령 목록. 등록 물품을 내린다.
**기획서**: 05 내 정보 탭. 프로필 수정·활동 점수·북마크 창·우리 기관 구성원은 뺐다 — 팀 코멘트 "제작 후순위" 그대로.

## 파일

| | |
|---|---|
| 화면 | `web/src/app/(tabs)/me/page.tsx` — 3탭(`?tab=registered|requested|received`), `WithdrawButton.tsx`, `SignOutButton.tsx` |
| 쿼리 | `web/src/lib/items.ts` `myItems(userId, kind)` |
| API | `api/items/[id]` PATCH `{action: "withdraw"}` |

## 규칙

- 등록 목록은 `withdrawn` 제외. 신청 목록은 `cancelled` 제외. 수령은 `completed`만.
- 내리기는 등록자만, `completed`는 못 내린다. 진행 중 `transfers`는 `cancelled`. **삭제가 아니다** — 이력·사진·대화 남는다.
- 나눔/수령 횟수는 `transfers`에서 센다. 컬럼으로 두지 않는다.
- 최근 접속 시간 문자열도 저장하지 않는다 — `last_seen_at`만.

## smoke

8 내리기 (B 403 → A 200 → 404 → 목록에서 빠짐 → completed는 400) · 9 페이지 렌더

## 열린 것

- 프로필 이미지·닉네임은 OAuth 값 그대로. 수정 UI 없음.
- 기관용 메뉴(우리 기관 나눔 진행/완료 물품)는 없다. `org_id`로 조회하면 되지만 화면이 없다.
