"use client";

import { useRouter } from "next/navigation";

/** 상세·채팅 어디서 왔든 왔던 곳으로. */
export function BackButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} aria-label="뒤로"
      className="size-10 grid place-items-center text-2xl text-neutral-900">‹</button>
  );
}
