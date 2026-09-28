import Link from "next/link";
import { currentUser } from "@/lib/session";
import { TabBar } from "@/components/TabBar";

export default async function TabsLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const u = await currentUser();
  return (
    <>
      {u && u.orgStatus !== "verified" && (
        <Link href="/pending" className="block bg-amber-50 text-amber-900 text-xs px-4 py-2 text-center border-b border-amber-100">
          소속 확인 중이에요 — 확인되면 등록·신청을 할 수 있어요
        </Link>
      )}
      <div className="flex-1 flex flex-col pb-16">{children}</div>
      {modal}
      <TabBar />
    </>
  );
}
