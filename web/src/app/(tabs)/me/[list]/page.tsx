import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { PROFILE_LISTS, profileList, type ProfileList } from "@/lib/items";
import { SubPage } from "../SubPage";
import { ItemRow } from "../ItemRow";

const EMPTY: Record<ProfileList, string> = {
  bookmarks: "하트를 누른 물품이 여기에 모여요.",
  requested: "신청한 물품이 없어요.",
  received: "받은 물품이 없어요.",
  "org-received": "우리 기관이 받은 물품이 없어요.",
  "org-registered": "우리 기관이 등록한 물품이 없어요.",
  "org-given": "나눔을 마친 물품이 없어요.",
};

// 기획 정의서 106-294 북마크 · 295 신청 · 296 수령. 우리 기관 메뉴 3개도 같은 카드로.
export default async function ProfileListPage({ params }: { params: Promise<{ list: string }> }) {
  const u = await requireUser();
  const { list } = await params;
  if (!(list in PROFILE_LISTS)) notFound();
  const kind = list as ProfileList;
  const rows = await profileList(kind, u.id, u.orgId);

  return (
    <SubPage title={PROFILE_LISTS[kind]}>
      {rows.length === 0
        ? <p className="py-24 text-center text-sm text-neutral-400">{EMPTY[kind]}</p>
        : (
          <ul className="space-y-3 p-4">
            {rows.map((it) => (
              <ItemRow key={it.id} item={it} showOpen={kind === "org-registered"}
                withdrawable={kind === "org-registered" && it.createdBy === u.id} />
            ))}
          </ul>
        )}
    </SubPage>
  );
}
