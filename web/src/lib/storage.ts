import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

/**
 * 사진 저장. 프로덕션(Vercel)은 Blob, 로컬은 public/uploads.
 * 분기 기준은 BLOB_READ_WRITE_TOKEN 유무 — Vercel이 Blob 스토어를 연결하면 자동으로 들어온다.
 * 호출하는 쪽은 이 차이를 모른다. url 문자열 하나만 받는다.
 */
const MAX = 10 * 1024 * 1024;
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");

/** 매직 바이트로 판별한다. 클라이언트가 보낸 file.type은 믿지 않는다. */
function sniff(b: Buffer): { ext: "jpg" | "png" | "webp"; mime: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

export async function putImage(file: File): Promise<string> {
  if (file.size === 0) throw new Error("빈 파일이에요.");
  if (file.size > MAX) throw new Error("10MB 이하만 올릴 수 있어요.");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) throw new Error("JPG·PNG·WebP 이미지만 올릴 수 있어요.");
  const name = `${randomUUID()}.${kind.ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`items/${name}`, buf, {
      access: "public",
      contentType: kind.mime,
      addRandomSuffix: false,          // 이름이 이미 uuid라 충돌 없음
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return blob.url;
  }

  // ponytail: 로컬 개발 폴백. 프로덕션 빌드에선 public/이 빌드 시점 스냅샷이라 여기로 오면 안 된다.
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_DIR, name), buf);
  return `/uploads/${name}`;
}

/** putImage가 돌려준 주소인가. 사용자가 보낸 사진 URL을 저장하기 전에 본다 — 아무 외부 주소나 박히지 않게.
 *  Blob 호스트의 storeId는 토큰에서 잘라 온 값이라 대문자가 섞일 수 있다 (@vercel/blob). */
export function isStoredImage(url: string): boolean {
  return /^\/uploads\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(url)
    || /^https:\/\/[A-Za-z0-9]+\.public\.blob\.vercel-storage\.com\/items\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(url);
}
