import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";
import Credentials from "next-auth/providers/credentials";
import { sql } from "@/lib/db";
import type { DbUser, OrgRole, OrgStatus } from "@/lib/types";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean)
);

async function loadUser(id: string): Promise<DbUser | null> {
  const [u] = await sql<DbUser[]>`
    SELECT id, org_id, email, nickname, profile_image, org_role, org_status, is_admin
    FROM users WHERE id = ${id}`;
  return u ?? null;
}

/** (provider, subject)로 찾거나 만든다. 정체성은 이메일이 아니다 (DB-SCHEMA §users). */
async function upsertUser(p: {
  provider: string; subject: string; email?: string | null; nickname: string; image?: string | null;
}): Promise<string> {
  const isAdmin = !!p.email && ADMIN_EMAILS.has(p.email);
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO users (auth_provider, auth_subject, email, nickname, profile_image, is_admin, last_seen_at)
    VALUES (${p.provider}, ${p.subject}, ${p.email ?? null}, ${p.nickname}, ${p.image ?? null}, ${isAdmin}, now())
    ON CONFLICT (auth_provider, auth_subject) DO UPDATE
      SET last_seen_at = now(),
          is_admin = users.is_admin OR EXCLUDED.is_admin
    RETURNING id`;
  return row.id;
}

const providers: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GOOGLE_ID) providers.push(Google);
if (process.env.AUTH_KAKAO_ID) providers.push(Kakao);

// 개발용 로그인. OAuth 클라이언트 ID 없이 전체 흐름을 돌려보기 위한 것. 프로덕션에선 빠진다.
if (process.env.NODE_ENV !== "production") {
  providers.push(
    Credentials({
      id: "dev",
      name: "개발용 로그인",
      credentials: { email: { label: "이메일" }, nickname: { label: "이름" } },
      async authorize(c) {
        const email = String(c?.email ?? "").trim();
        const nickname = String(c?.nickname ?? "").trim() || email.split("@")[0];
        if (!email) return null;
        const id = await upsertUser({ provider: "dev", subject: email, email, nickname });
        return { id, email, name: nickname };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // OAuth 로그인 시 users 행을 만들고, 우리 id를 user.id에 심는다.
    async signIn({ user, account, profile }) {
      if (!account || account.provider === "dev") return true;
      const id = await upsertUser({
        provider: account.provider,
        subject: account.providerAccountId,
        email: user.email ?? (profile as { email?: string } | undefined)?.email ?? null,
        nickname: user.name ?? "담당자",
        image: user.image ?? null,
      });
      user.id = id;
      return true;
    },
    // 토큰에 소속 상태를 싣는다. 승인되면 클라이언트가 session.update()로 갱신한다 (MVP §3).
    async jwt({ token, user, trigger }) {
      if (user?.id) token.uid = user.id;
      if (user || trigger === "update") {
        const u = token.uid ? await loadUser(token.uid as string) : null;
        if (u) {
          token.orgId = u.orgId;
          token.orgStatus = u.orgStatus;
          token.orgRole = u.orgRole;
          token.isAdmin = u.isAdmin;
          token.name = u.nickname;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.orgId = (token.orgId as string | null) ?? null;
      session.user.orgStatus = (token.orgStatus as OrgStatus) ?? "pending";
      session.user.orgRole = (token.orgRole as OrgRole) ?? "member";
      session.user.isAdmin = !!token.isAdmin;
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      orgId: string | null;
      orgStatus: OrgStatus;
      orgRole: OrgRole;
      isAdmin: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
