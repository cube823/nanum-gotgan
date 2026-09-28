/** 올리기 전 폰에서 사진 줄이기 (브라우저 전용).
 *
 *  왜: 폰 원본은 3~8MB인데 Vercel 함수는 요청 본문을 4.5MB에서 자른다 — 큰 사진은 프로덕션에서 올라가지 않았다.
 *  긴 변 1600px JPEG로 줄이면 수백 KB라 한도에 안 걸리고, 이동통신에서도 빨리 올라간다. 카드·상세는 390px 폭이라 화질 손해도 없다.
 *  createImageBitmap(imageOrientation: "from-image")이 EXIF 회전을 적용해 준다 — 폰으로 세워 찍은 사진이 눕지 않는다. */
export const UPLOAD_LIMIT = 4 * 1024 * 1024;   // Vercel 4.5MB보다 조금 아래

export async function shrinkImage(file: Blob, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // 이 브라우저가 못 읽는 형식(예: 크롬의 HEIC) — 원본을 그대로 보내고, 크면 호출한 쪽이 막는다
    return file;
  }
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bmp.close(); return file; }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  // 이미 작은 JPEG면 다시 굽는 게 더 클 수 있다 — 작은 쪽을 쓴다
  return out && out.size < file.size ? out : file;
}

/** 여러 작업을 동시에 n개까지만. 결과 순서는 입력 순서. */
export async function limit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}
