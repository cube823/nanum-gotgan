/** 로딩 자리 블록 — 실제 레이아웃 틀대로 놓는다 (docs/design/LOADING-STATES.md). 크기·모양은 className으로. */
export function Sk({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-lg bg-neutral-100 ${className}`} />;
}
