import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { STATUS_LABEL } from "@/components/ItemGrid";

type Row = {
  id: string; status: string; itemName: string; itemStatus: string; thumb: string | null;
  otherName: string; otherOrg: string; lastMessage: string | null; lastAt: Date | null; unread: number;
};

// 화면 10 — 04 기획서 메시지 목록. 안 읽음 닷 + 물품 상태.
export default async function MessagesPage() {
  const u = await requireUser();
  const rows = await sql<Row[]>`
    SELECT t.id, t.status, i.name AS item_name, i.status AS item_status,
      (SELECT url FROM item_photos WHERE item_id = i.id ORDER BY sort_order LIMIT 1) AS thumb,
      CASE WHEN t.requester_id = ${u.id} THEN owner.nickname ELSE req.nickname END AS other_name,
      CASE WHEN t.requester_id = ${u.id} THEN oo.name ELSE ro.name END AS other_org,
      (SELECT body FROM messages WHERE transfer_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages WHERE transfer_id = t.id ORDER BY created_at DESC LIMIT 1) AS last_at,
      (SELECT count(*)::int FROM messages WHERE transfer_id = t.id AND read_at IS NULL AND sender_id <> ${u.id}) AS unread
    FROM transfers t
    JOIN items i ON i.id = t.item_id
    JOIN users owner ON owner.id = i.created_by JOIN organizations oo ON oo.id = i.org_id
    JOIN users req ON req.id = t.requester_id JOIN organizations ro ON ro.id = t.requester_org
    WHERE t.requester_id = ${u.id} OR i.created_by = ${u.id}
    ORDER BY COALESCE((SELECT max(created_at) FROM messages WHERE transfer_id = t.id), t.created_at) DESC`;

  return (
    <main className="flex-1 px-4 pt-4">
      <h1 className="text-xl font-bold">메시지</h1>
      {rows.length === 0 && <p className="py-16 text-center text-neutral-400 text-sm">아직 대화가 없어요.<br />스와이프에서 물품을 골라 채팅을 시작해 보세요.</p>}
      <ul className="mt-3 divide-y">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/messages/${r.id}`} className="flex gap-3 py-3">
              <div className="size-14 rounded-xl bg-neutral-100 overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.thumb && <img src={r.thumb} alt="" className="size-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{r.otherName}</span>
                  <span className="text-xs text-neutral-400 truncate">{r.otherOrg}</span>
                  {r.unread > 0 && <span className="ml-auto size-2 rounded-full bg-brand shrink-0" />}
                </div>
                <p className="text-sm text-neutral-600 truncate">
                  {r.itemName}
                  {(STATUS_LABEL[r.itemStatus] || r.status === "cancelled") && (
                    <span className="ml-1 chip bg-neutral-100 text-neutral-500">{r.status === "cancelled" ? "종료" : STATUS_LABEL[r.itemStatus]}</span>
                  )}
                </p>
                <p className="text-xs text-neutral-400 truncate">{r.lastMessage ?? "대화를 시작해 보세요"}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
