"use client";

import { useFormStatus } from "react-dom";

const KAKAO_ICON = (
  <svg aria-hidden viewBox="0 0 20 18" className="size-4.5 fill-current">
    <path d="M10 0C4.5 0 0 3.5 0 7.8c0 2.8 1.9 5.3 4.7 6.7L3.7 18l4.1-2.7c.7.1 1.4.2 2.2.2 5.5 0 10-3.5 10-7.8S15.5 0 10 0z" />
  </svg>
);

/** 로그인 버튼 — 한 폼의 두 submit 버튼. 누르면 둘 다 잠그고 누른 쪽만 "이동 중…" (docs/design/LOADING-STATES.md C).
 *  서버 액션이 카카오·구글 주소를 받아 오기까지 모바일에서 0.3초 넘게 걸려 아무 반응 없어 보였다. */
export function SignInButtons({ google, kakao }: { google: boolean; kakao: boolean }) {
  const { pending, data } = useFormStatus();
  const which = pending ? data?.get("provider") : null;
  return (
    <>
      {google && (
        <button name="provider" value="google" disabled={pending} className="btn-cta h-13 text-[15px] disabled:opacity-70">
          <span aria-hidden className="text-lg font-black">G</span>
          {which === "google" ? "구글로 이동 중…" : "구글로 계속하기"}
        </button>
      )}
      {kakao && (
        <button name="provider" value="kakao" disabled={pending} className="btn-kakao h-13 text-[15px] disabled:opacity-70">
          {KAKAO_ICON}
          {which === "kakao" ? "카카오로 이동 중…" : "카카오톡으로 계속하기"}
        </button>
      )}
    </>
  );
}
