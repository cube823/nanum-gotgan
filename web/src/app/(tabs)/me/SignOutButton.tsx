"use client";
import { signOut } from "next-auth/react";
export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/login" })}
      className="mx-auto block px-4 py-3 text-sm text-neutral-400 underline-offset-4 hover:text-neutral-600 hover:underline">
      로그아웃
    </button>
  );
}
