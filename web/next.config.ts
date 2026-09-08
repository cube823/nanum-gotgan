import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // CSP는 Next의 인라인 스크립트 때문에 nonce 배관이 필요하다 — MVP 밖. 나머지 기본 헤더만.
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
};

export default nextConfig;
