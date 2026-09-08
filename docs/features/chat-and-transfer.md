# 채팅 · 예약 · 양도 완료

**무엇**: 신청자가 채팅으로 요청하고, 등록자가 한 명을 골라 예약하고, 넘겨준 뒤 완료 처리한다.
**기획서**: 04 메시지 탭. 약속 날짜 UI·후기는 뺐다. **예약 상태 표시는 넣었다** — 날짜 UI와는 다른 것이다 (`decisions/0004`).

## 핵심 모델

**나눔 건(`transfers`) = 채팅방.** `(item_id, requester_id)` UNIQUE. 04 기획서의 "상대·물품 키값이 같은 대화 존재 시 TRUE"가 그대로 이 제약이다 (`decisions/0002`).

## 상태

```
transfers: requested ⇄ scheduled ──→ completed
               └──────────┴────────→ cancelled
items:     open      ⇄ reserved  ──→ completed
```

`requested → completed` 직행은 **없다.** 등록자 버튼은 순서대로: "이 분께 드리기로 했어요" → "양도 완료". 완료 시 같은 물품의 다른 `transfers`는 `cancelled`.

## 파일

| | |
|---|---|
| 목록 | `web/src/app/(tabs)/messages/page.tsx` — 안 읽음 닷, 물품 상태 뱃지 |
| 채팅방 | `(tabs)/messages/[transferId]/page.tsx` (서버, 상단 물품) + `ChatRoom.tsx` (5초 폴링, 버튼 2개) |
| API | `api/transfers` POST (신청=방 생성, ON CONFLICT), `api/transfers/[id]` PATCH (schedule/unschedule/complete), `api/transfers/[id]/messages` GET(`?after=`)/POST |

## 규칙

- 전이는 `sql.begin` 안에서 `FOR UPDATE OF i, t`로 잠근 뒤 검사·쓰기. **더블클릭·두 탭이 한 물품을 두 명에게 예약하지 못한다** (smoke 7b).
- 폴링 커서는 `created_at >=` — 같은 타임스탬프 유실 방지. 클라이언트가 id로 중복 제거.
- 종료된 방(`cancelled`/`completed`)은 이력 조회 200, 새 메시지 400.
- 제3자는 403. 같은 기관 물품 신청은 400.
- 읽음 처리는 GET에서 (`read_at`).

## smoke

6 채팅 시작 · 7 예약→완료 (직행 400, 되돌리기, 완료 후 신청 400) · 7b 동시 예약 경합

## 열린 것

- 양도 완료를 **등록자만** 누른다. 수령자 확인이 없다. 감사 대응으론 양쪽 확인이 낫지만 MVP엔 과함.
- 폴링 5초 체감 — 두 폰으로 확인 필요.
- 예약 취소·완료 시 상대에게 알림이 없다. 채팅방에 들어와야 안다.
