import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GroupSchema, ExtractSchema, guard } from "./schema.js";
import { GROUP_SYSTEM, buildGroupMessages } from "./prompts/group.js";
import { EXTRACT_SYSTEM, buildExtractMessages } from "./prompts/extract.js";

const client = new Anthropic();

const GROUP_MODEL = "claude-haiku-4-5";
const EXTRACT_MODEL = "claude-sonnet-5";

export const MAX_PHOTOS = 30;   // 03 기획서: 여러 물건 글쓰기 = 사진 최대 30장
export const MAX_GROUPS = 15;   // AI-LOOP-DESIGN §4: 사람이 REVIEW 못 하는 양은 막는다

/** [2] GROUP. 실패하면 전체를 한 그룹으로 (§5 폴백). */
export async function group(photos) {
  try {
    const res = await client.messages.parse({
      model: GROUP_MODEL,
      max_tokens: 4096,
      system: GROUP_SYSTEM,
      messages: buildGroupMessages(photos),
      output_config: { format: zodOutputFormat(GroupSchema) },
    });
    const groups = res.parsed_output?.groups;
    if (!groups?.length) throw new Error("empty groups");

    // 모델이 범위 밖 인덱스를 뱉을 수 있다 — 걸러낸다
    const cleaned = groups
      .map((g) => ({
        ...g,
        photos: [...new Set(g.photos)].filter((i) => i >= 0 && i < photos.length),
      }))
      .filter((g) => g.photos.length > 0);
    if (!cleaned.length) throw new Error("no valid indices");

    return { groups: cleaned, fellBack: false };
  } catch {
    return {
      groups: [{ photos: photos.map((_, i) => i), hint: "" }],
      fellBack: true,
    };
  }
}

/** [3] EXTRACT. 그룹 1개 실패가 나머지를 죽이지 않는다 (§5). */
async function extractOne(photos, hint) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.messages.parse({
        model: EXTRACT_MODEL,
        max_tokens: 2048,
        system: EXTRACT_SYSTEM,
        messages: buildExtractMessages(photos, hint),
        output_config: { format: zodOutputFormat(ExtractSchema) },
      });
      if (res.parsed_output) return { draft: res.parsed_output };
    } catch (err) {
      if (attempt === 1) return { error: String(err?.message ?? err) };
    }
  }
  return { error: "schema validation failed" };
}

/**
 * 사진 → 초안 M개. [2]→[3]→[4]까지.
 * [5] REVIEW와 [6] COMMIT은 사람과 DB의 몫이라 여기 없다.
 */
export async function generateDrafts(photos) {
  if (photos.length > MAX_PHOTOS) {
    throw new Error(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요.`);
  }

  const { groups, fellBack } = await group(photos);

  if (groups.length > MAX_GROUPS) {
    throw new Error(
      `물건이 ${groups.length}개로 나뉘었어요. 한 번에 ${MAX_GROUPS}개까지만 올릴 수 있으니 나눠서 올려주세요.`
    );
  }

  const results = await Promise.all(
    groups.map(async (g) => {
      const groupPhotos = g.photos.map((i) => photos[i]);
      const { draft, error } = await extractOne(groupPhotos, g.hint);
      return {
        photoIndices: g.photos,
        hint: g.hint,
        draft: draft ?? null,
        guard: draft ? guard(draft) : null,
        error: error ?? null,
      };
    })
  );

  return { groupFellBack: fellBack, drafts: results };
}
