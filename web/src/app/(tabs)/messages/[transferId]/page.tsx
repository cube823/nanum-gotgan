import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ChatRoom } from "./ChatRoom";

/** 기획 정의서 14 채팅 — 상단 상대(이름·기관 → 프로필), 물품 카드(물품명·신청 상태), 대화, 입력.
 *  예약·완료 버튼은 등록자에게만 (MVP §4.4). 두 사람뿐이라 발신자 이름·기관은 여기서 한 번에 넘긴다. */
export default async function ChatPage({ params }: { params: Promise<{ transferId: string }> }) {
  const u = await requireUser();
  const { transferId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(transferId)) notFound();
  const [t] = await sql`
    SELECT t.id, t.status, t.requester_id, i.id AS item_id, i.name AS item_name, i.status AS item_status, i.created_by,
      (SELECT url FROM item_photos WHERE item_id = i.id ORDER BY sort_order LIMIT 1) AS thumb,
      COALESCE(owner.real_name, owner.nickname) AS owner_name, oo.name AS owner_org,
      COALESCE(req.real_name, req.nickname) AS req_name, ro.name AS req_org
    FROM transfers t JOIN items i ON i.id = t.item_id
    JOIN users owner ON owner.id = i.created_by JOIN organizations oo ON oo.id = i.org_id
    JOIN users req ON req.id = t.requester_id JOIN organizations ro ON ro.id = t.requester_org
    WHERE t.id = ${transferId}`;
  if (!t || (t.requesterId !== u.id && t.createdBy !== u.id)) notFound();

  const owner = { id: t.createdBy as string, name: t.ownerName as string, org: t.ownerOrg as string };
  const requester = { id: t.requesterId as string, name: t.reqName as string, org: t.reqOrg as string };

  return (
    <ChatRoom
      transferId={t.id} me={u.id} owner={owner} requester={requester}
      item={{ id: t.itemId, name: t.itemName, thumb: t.thumb, status: t.itemStatus }}
      transferStatus={t.status}
    />
  );
}
