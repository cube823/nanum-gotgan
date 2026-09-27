import { sql } from "@/lib/db";
import { api, requireUser, HttpError } from "@/lib/session";
import { isStoredImage } from "@/lib/storage";

/** 회원가입 STEP 1 — 실명·전화번호 (기획 정의서).
 *  nickname은 OAuth 프로필에서 온 값이라 실명이 아닐 수 있다. 연락은 이쪽을 쓴다.
 *  verified가 아니어도 저장된다: 온보딩 중에 입력하는 화면이다. */
export const PUT = api(async (req) => {
  const u = await requireUser();
  const b = await req.json();

  const realName = String(b.realName ?? "").trim();
  const phone = String(b.phone ?? "").replace(/[^\d]/g, "");

  if (realName.length < 2) throw new HttpError(400, "이름을 두 글자 이상 적어 주세요.");
  // 010으로 시작하는 휴대폰 10~11자리. 기관 유선번호는 받지 않는다 — 담당자 본인 연락처다.
  if (!/^01\d{8,9}$/.test(phone)) throw new HttpError(400, "휴대폰 번호를 확인해 주세요.");

  await sql`UPDATE users SET real_name = ${realName}, phone = ${phone} WHERE id = ${u.id}`;
  return Response.json({ realName, phone });
});

/** 기획 정의서 106-293 프로필 수정 — 이름(real_name)·사진. 사진은 /api/uploads로 올린 것이거나 지금 것 그대로(OAuth 사진)만. */
export const PATCH = api(async (req) => {
  const u = await requireUser();
  const b = await req.json();
  const realName = String(b.realName ?? "").trim();
  if (realName.length < 2 || realName.length > 20) throw new HttpError(400, "이름은 2~20자로 적어 주세요.");
  const img = b.profileImage ? String(b.profileImage) : null;
  if (img && img !== u.profileImage && !isStoredImage(img)) throw new HttpError(400, "사진을 다시 올려 주세요.");
  await sql`UPDATE users SET real_name = ${realName}, profile_image = ${img} WHERE id = ${u.id}`;
  return Response.json({ realName, profileImage: img });
});
