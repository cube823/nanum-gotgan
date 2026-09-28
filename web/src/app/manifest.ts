import type { MetadataRoute } from "next";

/** PWA — 홈 화면에 추가하면 주소창 없이 앱처럼 열린다. /manifest.webmanifest로 나간다.
 *  색은 화면 머리(흰색)에 맞췄다. 아이콘은 public/icon-*.png (logo.png에서 만듦). 서비스 워커·오프라인은 없다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "나눔곳간",
    short_name: "나눔곳간",
    description: "청년센터와 공간의 남는 자원, 필요한 곳에",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
