import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getItem } from "@/lib/items";
import { STATUS_LABEL } from "@/components/ItemGrid";
import { ChatButton } from "./ChatButton";

const RISK_NOTE: Record<string, string> = {
  yellow: "반복 사용하는 물품이면 비품으로 관리될 수 있어요.",
  red: "전기·소형비품이에요. 등록 기관의 내부 승인을 거친 물품이에요.",
};

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const item = await getItem((await params).id);
  if (!item || item.status === "withdrawn") notFound();

  const mine = item.createdBy === u.id;
  const sameOrg = item.orgId === u.orgId;

  return (
    <main className="flex-1 pb-24">
      <div className="relative">
        <div className="flex overflow-x-auto snap-x snap-mandatory">
          {item.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={p} alt="" className="w-full aspect-square object-cover snap-center shrink-0" />
          ))}
        </div>
        <Link href="/swipe" className="absolute top-3 left-3 size-9 rounded-full bg-black/40 text-white grid place-items-center">←</Link>
        {STATUS_LABEL[item.status] && (
          <span className="absolute top-3 right-3 chip bg-black/60 text-white">{STATUS_LABEL[item.status]}</span>
        )}
      </div>

      <div className="px-5 pt-4">
        <span className="chip bg-neutral-100">{item.categoryLabel}</span>
        <h1 className="mt-2 text-2xl font-bold">{item.name}</h1>
        <p className="text-sm text-neutral-500">{item.orgName}</p>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-neutral-50 py-2"><dt className="text-xs text-neutral-400">수량</dt><dd className="font-semibold">{item.quantity}{item.quantityUnit}</dd></div>
          <div className="rounded-xl bg-neutral-50 py-2"><dt className="text-xs text-neutral-400">사용 여부</dt><dd className="font-semibold">{item.isUsed ? "사용" : "미사용"}</dd></div>
          <div className="rounded-xl bg-neutral-50 py-2"><dt className="text-xs text-neutral-400">상태</dt><dd className="font-semibold">{item.condition}</dd></div>
        </dl>

        {item.description && <p className="mt-4 whitespace-pre-wrap leading-relaxed">{item.description}</p>}
        {RISK_NOTE[item.riskLevel] && <p className="mt-4 text-xs text-neutral-500 rounded-xl bg-amber-50 p-3">{RISK_NOTE[item.riskLevel]}</p>}
      </div>

      <div className="fixed bottom-16 inset-x-0 mx-auto max-w-md px-4 py-3 bg-white/90 backdrop-blur border-t border-neutral-100">
        {mine ? (
          <Link href="/me" className="btn-ghost w-full">내가 등록한 물품이에요</Link>
        ) : sameOrg ? (
          <button disabled className="btn-ghost w-full">같은 기관의 물품이에요</button>
        ) : item.status === "completed" ? (
          <button disabled className="btn-ghost w-full">나눔이 끝난 물품이에요</button>
        ) : (
          <ChatButton itemId={item.id} verified={u.orgStatus === "verified"} reserved={item.status === "reserved"} />
        )}
      </div>
    </main>
  );
}
