import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { listFeed } from "@/lib/items";
import { ItemGrid } from "@/components/ItemGrid";
import type { Category } from "@/lib/types";

// 화면 13. 재방문용 목록 — 스와이프와 달리 본 것도 다시 보인다.
export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const u = await requireUser();
  const { category } = await searchParams;
  const [items, cats] = await Promise.all([
    listFeed(u.orgId, category || null),
    sql<Category[]>`SELECT code, label FROM categories ORDER BY sort_order`,
  ]);

  return (
    <main className="flex-1 px-4 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">전체 물품</h1>
        <Link href="/swipe" className="text-sm text-neutral-500">스와이프</Link>
      </div>
      <div className="mt-3 -mx-4 px-4 flex gap-2 overflow-x-auto pb-2">
        <Link href="/items" className={`chip py-1.5 px-3 shrink-0 ${!category ? "bg-brand text-white" : "bg-neutral-100"}`}>전체</Link>
        {cats.map((c) => (
          <Link key={c.code} href={`/items?category=${c.code}`}
            className={`chip py-1.5 px-3 shrink-0 ${category === c.code ? "bg-brand text-white" : "bg-neutral-100"}`}>
            {c.label}
          </Link>
        ))}
      </div>
      <div className="mt-2">
        <ItemGrid items={items} empty="이 카테고리엔 아직 물품이 없어요." />
      </div>
    </main>
  );
}
