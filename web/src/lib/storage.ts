import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// ponytail: 로컬 파일 저장. 프로덕션은 Vercel Blob/S3로 — 이 함수 하나만 바꾸면 된다 (MVP §7-1).
// public/은 dev에서 런타임 추가 파일도 서빙되지만, 프로덕션 빌드에선 빌드 시점 스냅샷이다.
const DIR = path.join(process.cwd(), "public", "uploads");
const OK = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

export async function putImage(file: File): Promise<string> {
  if (!OK.has(file.type)) throw new Error("이미지 파일만 올릴 수 있어요.");
  if (file.size > 10 * 1024 * 1024) throw new Error("10MB 이하만 올릴 수 있어요.");
  await mkdir(DIR, { recursive: true });
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}
