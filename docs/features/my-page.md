# 내 정보 · 프로필 수정 · 내리기

**무엇**: 프로필 카드와 수정, 내 북마크/신청/수령 목록, 우리 기관 목록·구성원. 등록 물품을 내린다.
**기획서**: 05 내 정보 탭, Figma 106-291(내 정보) · 106-293(프로필 수정) · 106-294~296(북마크·신청·수령).
**뺀 것**: "우리 기관 후기"(후기 기능이 후순위), "비밀번호 변경"(OAuth 로그인뿐이라 비밀번호가 없다), 활동 점수.

## 파일

| | |
|---|---|
| 내 정보 | `web/src/app/(tabs)/me/page.tsx` — 프로필 카드(이름 = 실명 우선, 기관 · 구), 북마크·신청·수령, 우리 기관 메뉴, 로그아웃 |
| 목록 6개 | `me/[list]/page.tsx` + `ItemRow.tsx` — `bookmarks` `requested` `received` `org-received` `org-registered` `org-given`. 가로 카드, 하트 토글, 상태 알약 |
| 구성원 | `me/members/page.tsx` — 이름·역할·가입일. 연락처 없음 |
| 프로필 수정 | `me/edit/` — 사진(`/api/uploads`)·이름. 기관명은 수정 불가 |
| 공용 | `me/SubPage.tsx`(탭바 없는 전체 화면 머리), `me/Avatar.tsx` |
| 쿼리 | `web/src/lib/items.ts` `profileList(kind, userId, orgId)` · `PROFILE_LISTS` |
| API | `api/me/profile` PATCH `{realName, profileImage}` · `api/items/[id]` PATCH `{action: "withdraw"}` |

## 규칙

- 신청 목록은 `cancelled` 제외, 수령은 `completed`만. 우리 기관 목록은 `org_id`(수령은 `transfers.requester_org`) 기준.
- 알약: 나눔 건이 있으면 그 상태(신청 중·예약 중·양도 완료), 없으면 물품 상태. "나눔 중"은 기관 등록 물품에서만.
- 내리기는 **기관 등록 물품에서 내가 올린 것만** 버튼이 보인다. API도 등록자만. `completed`는 못 내린다. 삭제가 아니다 — 이력·사진·대화 남는다.
- 프로필 사진 URL은 `isStoredImage`(`lib/storage.ts`)를 통과한 것 또는 지금 값(OAuth 사진)만 저장한다. 외부 주소 400.
- 이름 수정은 `real_name`을 바꾼다. 채팅·메시지 목록·상대 프로필이 모두 `COALESCE(real_name, nickname)`을 쓴다.
- 나눔/수령 횟수는 `transfers`에서 센다(상대 프로필). 컬럼으로 두지 않는다.

## smoke

8 내리기 · 9 페이지 렌더(`/me/*` 9개, 없는 목록 404) · 9b 목록 사람/기관 기준 · 9c 프로필 수정(1자·외부 사진 400, 전화번호 유지)

## 열린 것

- 내 정보 탭 카드에서 기관 "동"은 못 보인다 — 주소가 도로명이라 "구"까지만.
