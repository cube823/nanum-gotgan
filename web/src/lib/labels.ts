import type { Condition } from "./types";

/** 상태 값. DB CHECK(schema.sql)와 같아야 한다. 좋은 것부터 — 등록 폼 버튼 순서이기도 하다. */
export const CONDITIONS: Condition[] = ["상", "중", "하"];

/** 화면에 보이는 말. DB는 상/중/하로 저장한다 — 사람이 읽는 자리에서만 바꿔 쓴다.
 *  기획서 03 등록하기 탭 · Figma가 쓰는 표현. */
export const CONDITION_LABEL: Record<Condition, string> = {
  상: "새것",
  중: "거의 새것",
  하: "사용감 있음",
};
