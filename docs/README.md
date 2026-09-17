# 문서 지도

**AI 진입점은 `/AGENTS.md`**, 사람 진입점은 `/README.md`. 여기는 그 아래 문서들이 어디 있고 언제 읽는지.

| 문서 | 언제 |
|---|---|
| [glossary.md](glossary.md) | 용어가 코드에서 어떤 이름인지 |
| [architecture.md](architecture.md) | 요청 하나가 어디를 거치는지 — 게이트, 상태기계, 폴링 |
| [features/](features/) | 피처별: 기획서 번호 ↔ 화면 ↔ 파일 ↔ smoke 단계 ↔ 열린 것 |
| [decisions/](decisions/) | 왜 그렇게 정했는지. 뒤집을 때도 여기에 새 번호로 |
| [guides/adding-a-feature.md](guides/adding-a-feature.md) | 기능을 넣을 때 순서와 체크리스트 |
| [guides/deploy.md](guides/deploy.md) | Vercel + Neon + Blob + nanumgotgan.com — 순서와 OAuth URI 갱신 |
| [design/](design/) | 원본 설계 — `MVP.md`(범위·플로우), `DB-SCHEMA.md`(스키마·상태표), `AI-LOOP-DESIGN.md` |

## 규칙

- **문서는 코드를 가리킨다.** 설명 대신 `web/src/...:줄` 을 적는다. 코드가 바뀌면 문서의 경로가 틀리고, 틀린 경로는 grep으로 잡힌다.
- **상태를 추가하면** `design/DB-SCHEMA.md` §3 검산표 + 해당 `features/*.md`.
- **결정을 하면** `decisions/NNNN-*.md`. 한 페이지. 맥락·결정·결과만.
- **기획서 번호(00~05, 99)를 남긴다.** 팀의 Notion 기획서와 대응이 끊기면 사람이 못 따라온다.
- 개인 회고·약점 분석은 이 리포에 쓰지 않는다.
