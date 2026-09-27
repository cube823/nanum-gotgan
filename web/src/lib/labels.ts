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

/** "2일 전 등록" 같은 상대 시각. 기획 정의서 11 상세. 한 달 넘으면 날짜로. */
export function ago(d: Date | string): string {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}일 전`;
  return ymd(d);
}

/** 2026.09.27 */
export function ymd(d: Date | string): string {
  const x = new Date(d);
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
}
