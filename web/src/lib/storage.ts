import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// ponytail: 로컬 파일 저장. 프로덕션은 Vercel Blob/S3로 — 이 함수 하나만 바꾸면 된다 (MVP §7-1).
// public/은 dev에서 런타임 추가 파일도 서빙되지만, 프로덕션 빌드에선 빌드 시점 스냅샷이다.
const DIR = path.join(process.cwd(), "public", "uploads");
const MAX = 10 * 1024 * 1024;

/** 매직 바이트로 판별한다. 클라이언트가 보낸 file.type은 믿지 않는다. */
function sniff(b: Buffer): "jpg" | "png" | "webp" | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export async function putImage(file: File): Promise<string> {
  if (file.size === 0) throw new Error("빈 파일이에요.");
  if (file.size > MAX) throw new Error("10MB 이하만 올릴 수 있어요.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new Error("JPG·PNG·WebP 이미지만 올릴 수 있어요.");
  await mkdir(DIR, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(DIR, name), buf);
  return `/uploads/${name}`;
}
