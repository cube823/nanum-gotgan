import { api, requireVerified, HttpError } from "@/lib/session";
import { putImage } from "@/lib/storage";

export const POST = api(async (req) => {
  await requireVerified();
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "파일이 없어요.");
  try {
    return Response.json({ url: await putImage(file) });
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
});
