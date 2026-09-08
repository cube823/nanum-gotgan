import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { NewItemForm } from "./NewItemForm";
import type { Category } from "@/lib/types";
import Link from "next/link";

export default async function NewItemPage() {
  const u = await requireUser();
  if (u.orgStatus !== "verified") {
    return (
      <main className="flex-1 grid place-items-center p-8 text-center">
        <div>
          <p className="font-semibold">소속 확인 후 등록할 수 있어요</p>
          <Link href="/pending" className="btn-ghost mt-4">확인 상태 보기</Link>
        </div>
      </main>
    );
  }
  const cats = await sql<Category[]>`SELECT code, label, risk_level, notice FROM categories ORDER BY sort_order`;
  return <NewItemForm categories={cats} />;
}
