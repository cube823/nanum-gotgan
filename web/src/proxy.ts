import { auth } from "@/auth";
import { NextResponse } from "next/server";

// MVP §3 — 게이트는 여기 한 곳. 리다이렉트만 하고, 진짜 판정은 API가 DB를 보고 한다.
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const user = req.auth?.user;

  const go = (to: string) => NextResponse.redirect(new URL(to, req.url));

  if (pathname === "/login") return user ? go("/swipe") : NextResponse.next();

  if (!user) return go("/login");
  // 운영자는 소속 기관이 없어도 승인 화면엔 들어간다.
  if (!user.orgId && !(user.isAdmin && pathname.startsWith("/admin"))) {
    return pathname === "/onboarding" ? NextResponse.next() : go("/onboarding");
  }
  if (pathname === "/onboarding") return go("/swipe");

  if (pathname.startsWith("/admin") && !user.isAdmin && user.orgRole !== "manager") {
    return go("/swipe");
  }
  if (pathname === "/") return go("/swipe");

  return NextResponse.next();
});

// 확장자로 끝나는 경로(public/의 logo.png, uploads/*.jpg 등)는 게이트를 안 탄다 — 로그인 전 화면이 로고를 못 불러왔다.
// 페이지·API 권한은 여전히 서버가 DB를 보고 판정한다 (불변 규칙 1).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[a-z0-9]+$).*)"],
};
