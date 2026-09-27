import { signIn } from "@/auth";

const hasGoogle = !!process.env.AUTH_GOOGLE_ID;
const hasKakao = !!process.env.AUTH_KAKAO_ID;

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col px-6 pt-10 pb-8">
      <div className="px-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="나눔곳간" width={44} height={44} className="size-11" />
      </div>

      <div className="flex-1 flex flex-col justify-center px-12">
        <h1 className="text-7xl font-black leading-[1.05] tracking-tight">
          나눔<br /><span className="text-brand">곳간</span>
        </h1>
        <p className="mt-12 text-xl font-bold leading-snug">청년센터와 공간의 남는 자원,<br />필요한 곳에</p>
        <p className="mt-4 text-sm leading-relaxed text-neutral-400">서울시 청년공간과 센터를 잇는<br />느슨하게 연결된 자원순환 커뮤니티</p>
      </div>

      <div className="space-y-3 px-12">
        {hasGoogle && (
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
            <button className="btn-cta text-[15px]">
              <span aria-hidden className="text-lg font-black">G</span>구글로 계속하기
            </button>
          </form>
        )}
        {hasKakao && (
          <form action={async () => { "use server"; await signIn("kakao", { redirectTo: "/" }); }}>
            <button className="btn-kakao text-[15px]">
              <svg aria-hidden viewBox="0 0 20 18" className="size-4.5 fill-current">
                <path d="M10 0C4.5 0 0 3.5 0 7.8c0 2.8 1.9 5.3 4.7 6.7L3.7 18l4.1-2.7c.7.1 1.4.2 2.2.2 5.5 0 10-3.5 10-7.8S15.5 0 10 0z" />
              </svg>
              카카오톡으로 계속하기
            </button>
          </form>
        )}
        {!hasGoogle && !hasKakao && (
          <p className="text-xs text-neutral-400 text-center">
            OAuth 클라이언트 ID가 없어 소셜 로그인이 꺼져 있어요. <code>.env.local</code>을 보세요.
          </p>
        )}
      </div>
    </main>
  );
}
