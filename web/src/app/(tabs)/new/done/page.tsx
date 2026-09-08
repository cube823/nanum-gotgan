import Link from "next/link";

export default async function DonePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return (
    <main className="flex-1 grid place-items-center p-8 text-center">
      <div>
        <div className="mx-auto size-16 rounded-full bg-brand/10 grid place-items-center text-3xl">🎉</div>
        <h1 className="mt-6 text-2xl font-bold">등록했어요</h1>
        <p className="mt-2 text-sm text-neutral-500">다른 기관 담당자가 스와이프에서 보게 돼요.</p>
        <div className="mt-8 space-y-2">
          {id && <Link href={`/items/${id}`} className="btn-brand w-full">등록한 물품 보기</Link>}
          <Link href="/new" className="btn-ghost w-full">하나 더 등록하기</Link>
        </div>
      </div>
    </main>
  );
}
