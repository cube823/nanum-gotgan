import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ChatRoom } from "./ChatRoom";

// 화면 11 — 상단 물품 정보 + 채팅 + 등록자용 버튼 2개 (MVP §4.4)
export default async function ChatPage({ params }: { params: Promise<{ transferId: string }> }) {
  const u = await requireUser();
  const { transferId } = await params;
  const [t] = await sql`
    SELECT t.id, t.status, t.requester_id, i.id AS item_id, i.name AS item_name, i.status AS item_status, i.created_by,
      (SELECT url FROM item_photos WHERE item_id = i.id ORDER BY sort_order LIMIT 1) AS thumb,
      CASE WHEN t.requester_id = ${u.id} THEN owner.nickname ELSE req.nickname END AS other_name,
      CASE WHEN t.requester_id = ${u.id} THEN oo.name ELSE ro.name END AS other_org
    FROM transfers t JOIN items i ON i.id = t.item_id
    JOIN users owner ON owner.id = i.created_by JOIN organizations oo ON oo.id = i.org_id
    JOIN users req ON req.id = t.requester_id JOIN organizations ro ON ro.id = t.requester_org
    WHERE t.id = ${transferId}`;
  if (!t || (t.requesterId !== u.id && t.createdBy !== u.id)) notFound();

  return (
    <main className="flex-1 flex flex-col -mb-16">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-neutral-100">
        <Link href="/messages" className="text-lg">←</Link>
        <div className="min-w-0">
          <p className="font-semibold truncate">{t.otherName}</p>
          <p className="text-xs text-neutral-400 truncate">{t.otherOrg}</p>
        </div>
      </header>
      <Link href={`/items/${t.itemId}`} className="flex items-center gap-3 px-4 py-2 bg-neutral-50 border-b border-neutral-100">
        <div className="size-10 rounded-lg bg-neutral-200 overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {t.thumb && <img src={t.thumb} alt="" className="size-full object-cover" />}
        </div>
        <p className="text-sm font-medium truncate flex-1">{t.itemName}</p>
        <span className="text-xs text-neutral-400">›</span>
      </Link>
      <ChatRoom
        transferId={t.id} me={u.id} isOwner={t.createdBy === u.id}
        transferStatus={t.status} itemStatus={t.itemStatus}
      />
    </main>
  );
}
