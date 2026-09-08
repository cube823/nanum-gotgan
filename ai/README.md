# ai/ — 사진 → 게시글 초안

`AI-LOOP-DESIGN.md` §2의 `[2] GROUP → [3] EXTRACT → [4] GUARD`를 구현한 것.
`[5] REVIEW`(사람)와 `[6] COMMIT`(DB)은 여기 없다.

```
schema.js          카테고리·리스크 등급 테이블, Zod 스키마, guard() 규칙
prompts/group.js   사진을 물건별로 묶는 프롬프트
prompts/extract.js 그룹 → 게시글 초안 프롬프트
pipeline.js        위 셋을 엮은 것 (재시도·폴백 포함)
guard.test.js      guard() 검사 — API 키 없이 실행됨
try.js             실사진으로 돌려보는 CLI
```

## 돌려보기

```bash
node ai/guard.test.js                  # 키 없이 실행 (규칙 검증)
node ai/try.js ai/fixtures/*.jpg       # 실제 API 호출 (비용 발생)
```

`try.js`는 `ANTHROPIC_API_KEY` 또는 `ant auth login` 프로필이 필요하다.

## 골든셋

`ai/fixtures/`에 사진을 넣는다. `AI-LOOP-DESIGN.md` §6-2대로 20장,
**문구류·포장재·전기류를 섞어서.** 전기류가 특히 중요하다 — 🔴로 안 잡히면
법적 방어선이 뚫린 것이다.

## 확인할 것

1. **전기류를 electronics로 잡는가** — 못 잡으면 승인 절차를 건너뛴다
2. **수량을 부풀리지 않는가** — 보이는 것보다 많이 적으면 받는 쪽이 헛걸음한다
3. **설명 말투** — 광고 문구("고품질 프리미엄!")나 공문 말투가 섞이면 프롬프트를 고친다
4. **흐린 사진에서 confidence가 낮아지는가** — 항상 0.9면 이 값은 쓸모가 없다

## 모델

| 단계 | 모델 | 이유 |
|---|---|---|
| GROUP | `claude-haiku-4-5` | 출력이 인덱스 배열뿐 |
| EXTRACT | `claude-sonnet-5` | 한국어 설명문 품질이 곧 게시글 품질 |

GUARD는 모델을 쓰지 않는다. 감사 대응 근거라 결정적이어야 한다.
