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

/** 나눔 건(transfers.status) 상태 알약 — 메시지 목록과 채팅방 물품 카드가 같이 쓴다. 기획 정의서 메시지 목록·14. */
export const TRANSFER_STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: "채팅 중", cls: "bg-brand/10 text-brand" },
  scheduled: { label: "예약 확정", cls: "bg-accent/10 text-accent" },
  completed: { label: "나눔 완료", cls: "bg-neutral-100 text-neutral-500" },
  cancelled: { label: "종료", cls: "bg-neutral-100 text-neutral-400" },
};

/** 메시지 목록 시각 — 오늘은 "오전 10:35", 어제, N일 전, N주 전, 그 뒤는 "9월 3일".
 *  서버(UTC)에서 그리므로 날짜 경계는 KST로 자른다. */
export function chatTime(d: Date | string): string {
  const x = new Date(d);
  const day = (t: Date) => Date.parse(t.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
  const days = Math.round((day(new Date()) - day(x)) / 86400000);
  if (days <= 0) return ampm(x);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return x.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
}

/** "오후 2:10" (KST). ko-KR 로캘 포맷은 ICU 버전에 따라 "PM 2:10"이 나와서 직접 만든다 (Node 24 · ICU 78에서 확인). */
export function ampm(d: Date | string): string {
  const [h, m] = new Date(d).toLocaleTimeString("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(m).padStart(2, "0")}`;
}

/** "서울특별시 성북구 …" → "성북구". 스와이프 카드·내 정보 프로필. */
export function district(address?: string | null) {
  return address?.match(/(\S+구)(?=\s)/)?.[1] ?? null;
}

/** 입력 중 자동 하이픈 — 휴대폰 010-1234-5678 (10자리면 011-123-4567). 숫자만 남기고 11자리까지.
 *  하이픈은 뒤에 숫자가 올 때만 붙인다 — 지울 때 하이픈에 걸리지 않는다. 서버는 숫자만 쓴다 (api/me/profile). */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 사업자등록번호 000-00-00000. 숫자 10자리까지. 서버는 normalizeBizNo로 숫자만 쓴다. */
export function formatBizNo(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 2026.09.27 */
export function ymd(d: Date | string): string {
  const x = new Date(d);
  return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
}
