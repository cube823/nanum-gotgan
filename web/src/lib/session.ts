import { auth } from "@/auth";
import { sql } from "./db";
import type { DbUser } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** API·서버 컴포넌트용. 세션이 아니라 DB를 본다 — 토큰은 낡을 수 있다 (MVP §3). */
export async function currentUser(): Promise<DbUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [u] = await sql<DbUser[]>`
    SELECT id, org_id, email, nickname, profile_image, org_role, org_status, is_admin
    FROM users WHERE id = ${session.user.id}`;
  return u ?? null;
}

export async function requireUser(): Promise<DbUser> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "로그인이 필요해요.");
  return u;
}

/** 쓰기(등록·신청)는 verified만. */
export async function requireVerified(): Promise<DbUser & { orgId: string }> {
  const u = await requireUser();
  if (u.orgStatus !== "verified" || !u.orgId) {
    throw new HttpError(403, "소속 승인 후 이용할 수 있어요.");
  }
  return u as DbUser & { orgId: string };
}

/** route handler 래퍼: HttpError → JSON 응답. */
export function api(handler: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "서버 오류가 났어요." }, { status: 500 });
    }
  };
}
