import { signIn } from "@/auth";

const hasGoogle = !!process.env.AUTH_GOOGLE_ID;
const hasKakao = !!process.env.AUTH_KAKAO_ID;
const hasDev = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  return (
    <main className="flex-1 flex flex-col px-6 pt-10 pb-8">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="size-8 rounded-full bg-brand grid place-items-center text-white">⬡</span>
        나눔곳간
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-6xl font-black leading-tight">
          나눔<br /><span className="text-brand">곳간</span>
        </h1>
        <p className="mt-8 text-lg font-bold">청년센터와 공간의 남는 자원,<br />필요한 곳에</p>
        <p className="mt-3 text-sm text-neutral-500">서울시 청년공간과 센터를 잇는<br />느슨하게 연결된 자원순환 커뮤니티</p>
      </div>

      <div className="space-y-3">
        {hasGoogle && (
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
            <button className="btn-brand w-full">구글로 계속하기</button>
          </form>
        )}
        {hasKakao && (
          <form action={async () => { "use server"; await signIn("kakao", { redirectTo: "/" }); }}>
            <button className="btn-brand w-full">카카오톡으로 계속하기</button>
          </form>
        )}
        {!hasGoogle && !hasKakao && (
          <p className="text-xs text-neutral-400 text-center">
            OAuth 클라이언트 ID가 없어 소셜 로그인이 꺼져 있어요. <code>.env.local</code>을 보세요.
          </p>
        )}
        {hasDev && (
          <form
            action={async (fd) => {
              "use server";
              await signIn("dev", { email: fd.get("email"), nickname: fd.get("nickname"), redirectTo: "/" });
            }}
            className="rounded-xl border border-dashed border-neutral-300 p-3 space-y-2"
          >
            <p className="text-xs text-neutral-500">개발용 로그인 (프로덕션에선 사라짐)</p>
            <input name="email" type="email" required placeholder="이메일" className="input" />
            <input name="nickname" placeholder="이름 (선택)" className="input" />
            <button className="btn-ghost w-full">개발용으로 들어가기</button>
          </form>
        )}
      </div>
    </main>
  );
}
