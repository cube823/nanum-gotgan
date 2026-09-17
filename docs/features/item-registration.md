# 등록

**무엇**: verified 담당자가 사진(1~10장)과 정보를 올려 물품을 `open`으로 만든다.
**기획서**: 03 등록하기 탭. **AI 토글 2개는 뺐다** (`decisions/0005`). 자체 카메라·사진 편집도 뺐다 — OS가 한다.

## 흐름

```
/new  step 1: 사진 선택 → 장마다 POST /api/uploads → url
      step 2: 카테고리 → risk_level 조회
                🟢 그대로 · 🟡 안내 · 🔴 법적 필드 강제 + approval_confirmed 없으면 버튼 비활성
              POST /api/items → 201 → /new/done
```

## 파일

| | |
|---|---|
| 화면 | `web/src/app/(tabs)/new/page.tsx` (서버, 카테고리 로드·verified 확인) → `NewItemForm.tsx` (클라이언트, 2스텝) → `done/page.tsx` |
| API | `api/uploads` (multipart → `putImage`), `api/items` POST |
| 저장 | `web/src/lib/storage.ts` — 매직 바이트 판별, 10MB, 0바이트 거부 |
| 방어 | UI 비활성 → API 400 (`items/route.ts`) → DB `chk_red_needs_approval` |

## 규칙

- 사진 1~10장. 순서는 `item_photos.sort_order`.
- `org_id`·`created_by`는 서버가 세션에서 넣는다. 클라이언트가 못 정한다. `status`도 못 정한다.
- 법적 필드 3개는 사람이 입력. 🔴이 아니면 접혀 있다(선택).

## smoke

4 등록 (업로드 → 201 → 🔴 승인 없이 400 → 🔴 승인 있으면 201)

## 열린 것

- ~~사진이 `public/uploads`에 저장된다~~ — 해소. `BLOB_READ_WRITE_TOKEN`이 있으면 Vercel Blob (`guides/deploy.md`).
- 등록 전에 업로드된 사진은 중간에 나가면 고아가 된다. 초기엔 무시.
- `quantity_unit` 자유 텍스트. 실제 값을 보고 enum으로 조일지 결정.
