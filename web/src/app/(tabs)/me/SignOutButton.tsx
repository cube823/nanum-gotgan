"use client";
import { signOut } from "next-auth/react";
export function SignOutButton() {
  return <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-ghost w-full text-sm">로그아웃</button>;
}
