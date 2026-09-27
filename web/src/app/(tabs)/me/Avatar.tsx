/** 프로필 사진, 없으면 사람 모양. 내 정보·프로필 수정·구성원이 같이 쓴다. */
export function Avatar({ src, className = "" }: { src?: string | null; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand/10 text-brand ${className}`}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" className="size-full object-cover" />
        : <svg aria-hidden viewBox="0 0 24 24" className="size-1/2" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5" /></svg>}
    </span>
  );
}
