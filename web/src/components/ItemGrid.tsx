import Link from "next/link";
import type { ItemCard } from "@/lib/types";

export const STATUS_LABEL: Record<string, string> = {
  open: "", reserved: "예약됨", completed: "나눔 완료", withdrawn: "내림",
};

export function ItemGrid({ items, empty = "물품이 없어요." }: { items: ItemCard[]; empty?: string }) {
  if (items.length === 0) return <p className="py-16 text-center text-neutral-400 text-sm">{empty}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <li key={it.id}>
          <Link href={`/items/${it.id}`} className="block">
            <div className="relative aspect-square rounded-xl overflow-hidden bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.photos[0] && <img src={it.photos[0]} alt="" className="size-full object-cover" />}
              {STATUS_LABEL[it.status] && (
                <span className="absolute top-2 left-2 chip bg-black/60 text-white">{STATUS_LABEL[it.status]}</span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">{it.categoryLabel}</p>
            <p className="text-sm font-semibold leading-tight line-clamp-2">{it.name}</p>
            <p className="text-xs text-neutral-400">{it.orgName}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
