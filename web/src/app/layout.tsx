import type { Metadata, Viewport } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

export const metadata: Metadata = {
  title: "나눔곳간",
  description: "청년센터와 공간의 남는 자원, 필요한 곳에",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1 };

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
