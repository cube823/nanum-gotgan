import type { Metadata, Viewport } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "나눔곳간",
  description: "청년센터와 공간의 남는 자원, 필요한 곳에",
  // iOS "홈 화면에 추가" — 주소창 없이 열리고 아이콘 밑 이름이 나눔곳간 (안드로이드는 app/manifest.ts)
  appleWebApp: { capable: true, title: "나눔곳간", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <SessionProvider>
          <div className="mx-auto w-full max-w-md min-h-dvh flex flex-col bg-white shadow-sm">
            {children}
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
