import { z } from "zod";

/** 법적 검토 §4 리스크 등급. DB `categories` 테이블과 1:1. */
export const CATEGORIES = {
  stationery:  { label: "문구·사무용품",      risk: "green"  },
  packaging:   { label: "포장·박스류",        risk: "green"  },
  craft:       { label: "공예 재료",          risk: "green"  },
  disposable:  { label: "일회용품·위생용품",  risk: "green"  },
  printed:     { label: "폐홍보물·인쇄물",    risk: "green"  },
  banner:      { label: "폐현수막·배너",      risk: "green"  },
  event:       { label: "행사·파티용품",      risk: "yellow" },
  interior:    { label: "인테리어·소품",      risk: "yellow" },
  electronics: { label: "전기·소형비품",      risk: "red"    },
  etc:         { label: "기타",               risk: "yellow" },
};

export const CATEGORY_CODES = Object.keys(CATEGORIES);

/** [2] GROUP — 사진 N장을 물건별로 묶는다. */
export const GroupSchema = z.object({
  groups: z.array(
    z.object({
      photos: z.array(z.number().int().min(0)).min(1),
      hint: z.string(),
    })
  ),
});

/** [3] EXTRACT — 그룹 1개 → 게시글 초안 1개. 필드는 02 카드 스펙과 1:1. */
export const ExtractSchema = z.object({
  category: z.enum(CATEGORY_CODES),
  name: z.string(),
  quantity: z.number().int().min(1),
  quantity_unit: z.string(),
  is_used: z.boolean(),
  condition: z.enum(["상", "중", "하"]),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  uncertain_fields: z.array(z.string()),
});

/**
 * [4] GUARD — LLM이 아니다. 규칙만.
 * fail-safe: 등급을 낮추는 방향의 AI 판단은 무시하고, 애매하면 더 엄격한 쪽으로.
 */
export function guard(draft) {
  const cat = CATEGORIES[draft.category] ?? CATEGORIES.etc;
  const warnings = [];

  if (cat.risk === "red") {
    warnings.push("대장 등재 비품일 수 있습니다. 내부 처분 승인을 받은 뒤 등록하세요.");
  } else if (cat.risk === "yellow") {
    warnings.push("반복 사용하는 물품이면 비품으로 관리될 수 있습니다. 확인해 주세요.");
  }

  // 사람이 채워야 하는 법적 필드 — AI는 절대 채우지 않는다 (DB-SCHEMA §items)
  const needsHumanInput = cat.risk === "red"
    ? ["on_ledger", "approval_confirmed", "funding_source"]
    : [];

  // 신뢰도 낮은 필드는 REVIEW에서 하이라이트 (AI-LOOP-DESIGN §2)
  const lowConfidence = draft.confidence < 0.6;

  return {
    risk: cat.risk,
    categoryLabel: cat.label,
    warnings,
    needsHumanInput,
    lowConfidence,
    // red는 사람이 승인 확인 전까지 자동 등록 불가
    canAutoPublish: cat.risk !== "red" && !lowConfidence,
  };
}
