"use client";

import { useEffect, useRef, useState } from "react";

type Pt = { lat: number; lng: number };

/* eslint-disable @typescript-eslint/no-explicit-any -- 카카오맵 SDK는 타입 패키지가 없다 */
declare global { interface Window { kakao?: any } }

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
let loading: Promise<any> | null = null;

/** SDK는 한 번만 붙인다. autoload=false + kakao.maps.load — Next가 스크립트 순서를 보장하지 않아서. */
function loadSdk(): Promise<any> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`;
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    s.onerror = () => { loading = null; reject(new Error("카카오맵 SDK를 불러오지 못했어요")); };
    document.head.appendChild(s);
  });
  return loading;
}

/** globals.css @theme 토큰. 폴리라인은 SVG 속성이라 var()를 못 쓴다 — 계산된 값을 넘긴다. */
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** 가운데 맞춤은 CustomOverlay 기본값(xAnchor·yAnchor 0.5)이 한다 — 여기서 transform으로 또 옮기면 선 끝과 어긋난다. */
const pin = (color: string) =>
  `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#fff;border:5px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.25)"></span>`;

/** 기획 정의서 11 위치 지도. 물품 기관(초록) ↔ 우리 기관(빨강), 점선, 가운데 "약 n km".
 *  보기 전용 — 끌기·확대를 막아 시트 스크롤을 뺏지 않는다. 누르면 카카오맵 길찾기.
 *  SDK를 못 불러오면(키 없음·도메인 미등록·네트워크) 지도 없이 거리 글자만 남긴다. */
export function KakaoMap({ item, mine, itemName, distanceKm }: {
  item: Pt; mine: Pt | null; itemName: string; distanceKm: number | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!KEY);
  const [iLat, iLng, mLat, mLng] = [item.lat, item.lng, mine?.lat, mine?.lng];   // 객체 말고 숫자로 의존한다

  useEffect(() => {
    if (!KEY) return;
    let cancelled = false;
    loadSdk().then((kakao) => {
      if (cancelled || !box.current) return;
      const { maps } = kakao;
      const brand = token("--color-brand"), accent = token("--color-accent");
      const a = new maps.LatLng(iLat, iLng);
      const map = new maps.Map(box.current, { center: a, level: 5, draggable: false, scrollwheel: false, disableDoubleClickZoom: true });
      new maps.CustomOverlay({ map, position: a, content: pin(brand), zIndex: 2 });
      if (mLat == null || mLng == null) return;
      const b = new maps.LatLng(mLat, mLng);
      new maps.CustomOverlay({ map, position: b, content: pin(accent), zIndex: 2 });
      new maps.Polyline({ map, path: [a, b], strokeWeight: 2, strokeColor: brand, strokeOpacity: 0.9, strokeStyle: "dash" });
      if (distanceKm != null) {
        new maps.CustomOverlay({
          map, zIndex: 3, yAnchor: 1.4,
          position: new maps.LatLng((iLat + mLat) / 2, (iLng + mLng) / 2),
          content: `<span style="display:inline-block;padding:3px 10px;border-radius:9999px;background:#fff;color:${brand};font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.15)">약 ${distanceKm}km</span>`,
        });
      }
      const bounds = new maps.LatLngBounds(); bounds.extend(a); bounds.extend(b);
      map.setBounds(bounds, 40, 40, 40, 40);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [iLat, iLng, mLat, mLng, distanceKm]);

  if (failed) {
    return distanceKm != null ? <p className="mt-3 text-sm font-semibold text-brand">약 {distanceKm}km</p> : null;
  }
  return (
    <a href={`https://map.kakao.com/link/to/${encodeURIComponent(itemName)},${item.lat},${item.lng}`}
      target="_blank" rel="noreferrer" aria-label={`${itemName} 길찾기 (카카오맵)`}
      className="mt-3 block h-[132px] overflow-hidden rounded-2xl bg-brand/5">
      <div ref={box} className="size-full pointer-events-none" />
    </a>
  );
}
