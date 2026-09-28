import { signIn } from "@/auth";
import { SignInButtons } from "./SignInButtons";

const hasGoogle = !!process.env.AUTH_GOOGLE_ID;
const hasKakao = !!process.env.AUTH_KAKAO_ID;

/** 누른 버튼의 name=provider 값으로 고른다. 목록 밖 값은 무시 — 폼은 누구나 보낼 수 있다. */
async function signInWith(fd: FormData) {
  "use server";
  const p = fd.get("provider");
  if (p !== "google" && p !== "kakao") return;
  await signIn(p, { redirectTo: "/" });
}

export default function LoginPage() {
  return (
    // 기획 정의서 16-2: 버튼 52px, 마지막 버튼 아래 38px + 홈 인디케이터
    <main className="flex-1 flex flex-col px-6 pt-10 pb-[calc(38px+env(safe-area-inset-bottom))]">
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

      <form action={signInWith} className="space-y-3 px-12">
        <SignInButtons google={hasGoogle} kakao={hasKakao} />
        {!hasGoogle && !hasKakao && (
          <p className="text-xs text-neutral-400 text-center">
            OAuth 클라이언트 ID가 없어 소셜 로그인이 꺼져 있어요. <code>.env.local</code>을 보세요.
          </p>
        )}
      </form>
    </main>
  );
}
