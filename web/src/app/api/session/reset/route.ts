import { signOut } from "@/auth";

/** 낡은 세션 쿠키 지우고 /login으로 (lib/session.ts pageUser). proxy 밖(/api)이라 로그인 상태여도 여기까진 온다. */
export async function GET() {
  await signOut({ redirectTo: "/login" });
}
