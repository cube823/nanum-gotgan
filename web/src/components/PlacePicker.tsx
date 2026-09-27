"use client";

import { useEffect, useRef, useState } from "react";
import { loadSdk } from "@/components/KakaoMap";

export type PickedPlace = { name: string; address: string | null; lat: number | null; lng: number | null };
type Hit = { name: string; address: string; lat: number; lng: number };

/** 거래 희망 장소 고르기 (기획 정의서 82-26 "위치 변경"). 전체 화면.
 *  사람들은 도로명 주소를 모른다 — ① 장소 이름·주소로 검색해 고르고 ② 지도를 끌어 가운데 핀을 입구에 맞춘다.
 *  핀 아래 주소는 지도가 멈출 때마다 서버(/api/places/reverse)로 다시 구한다. 카카오 키는 서버에만. */
export function PlacePicker({ initial, home, onDone, onCancel }: {
  initial: PickedPlace;
  home: PickedPlace;                 // "우리 기관 위치" — 되돌리기 + 검색 근처 우선
  onDone: (p: PickedPlace) => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [center, setCenter] = useState(
    initial.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng }
      : home.lat != null && home.lng != null ? { lat: home.lat, lng: home.lng }
      : { lat: 37.5665, lng: 126.978 },   // 좌표가 하나도 없으면 서울시청
  );
  const [mapFailed, setMapFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);        // eslint-disable-line @typescript-eslint/no-explicit-any -- 카카오맵 SDK는 타입이 없다
  const skipIdle = useRef(true);            // 처음 뜰 때는 가진 주소를 덮어쓰지 않는다
  const revTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 지도 — 끌 수 있다. 멈추면 가운데 좌표의 주소를 다시 구한다
  useEffect(() => {
    let cancelled = false;
    loadSdk().then((kakao) => {
      if (cancelled || !box.current) return;
      const { maps } = kakao;
      const map = new maps.Map(box.current, { center: new maps.LatLng(center.lat, center.lng), level: 3 });
      mapRef.current = map;
      maps.event.addListener(map, "idle", () => {
        const c = map.getCenter();
        const at = { lat: c.getLat(), lng: c.getLng() };
        setCenter(at);
        if (skipIdle.current) { skipIdle.current = false; return; }
        if (revTimer.current) clearTimeout(revTimer.current);
        revTimer.current = setTimeout(async () => {
          const r = await fetch(`/api/places/reverse?lat=${at.lat}&lng=${at.lng}`).catch(() => null);
          const j = r?.ok ? await r.json() : null;
          if (j?.address) setAddress(j.address);
        }, 250);
      });
    }).catch(() => { if (!cancelled) setMapFailed(true); });
    return () => { cancelled = true; if (revTimer.current) clearTimeout(revTimer.current); };
    // 지도는 한 번만 만든다 — 이후 이동은 panTo로
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 검색 — 입력이 멈추고 300ms 뒤. 우리 기관 근처가 앞에 오게 좌표를 같이 보낸다
  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(async () => {
      if (term.length < 2) { setHits(null); return; }
      setSearching(true); setErr(null);
      const near = home.lat != null ? `&lat=${home.lat}&lng=${home.lng}` : "";
      const r = await fetch(`/api/places?q=${encodeURIComponent(term)}${near}`).catch(() => null);
      const j = r ? await r.json().catch(() => null) : null;
      setSearching(false);
      if (!r?.ok) { setErr(j?.error ?? "장소를 찾지 못했어요."); setHits([]); return; }
      setHits(j);
    }, 300);
    return () => clearTimeout(t);
  }, [q, home.lat, home.lng]);

  function moveTo(p: { lat: number; lng: number }) {
    const map = mapRef.current;
    skipIdle.current = true;      // 고른 결과의 주소를 역지오코딩으로 덮지 않는다
    setCenter(p);
    if (map) map.setCenter(new window.kakao.maps.LatLng(p.lat, p.lng));
  }

  function pick(h: Hit) {
    setName(h.name); setAddress(h.address); setQ(""); setHits(null);
    moveTo(h);
  }

  function goHome() {
    if (home.lat == null || home.lng == null) return;
    setName(home.name); setAddress(home.address);
    moveTo({ lat: home.lat, lng: home.lng });
  }

  return (
    <div className="fixed inset-0 z-40 mx-auto flex max-w-md flex-col bg-white" role="dialog" aria-modal="true" aria-label="거래 희망 장소 고르기">
      <header className="relative flex h-14 shrink-0 items-center px-2">
        <button type="button" onClick={onCancel} aria-label="닫기" className="size-10 grid place-items-center text-2xl">✕</button>
        <h2 className="absolute inset-x-16 text-center text-base font-bold pointer-events-none">거래 희망 장소</h2>
      </header>

      {/* 검색 */}
      <div className="relative z-20 shrink-0 px-4 pb-3">
        <div className="flex h-12 items-center gap-2 rounded-2xl bg-neutral-100 px-4">
          <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus aria-label="장소·주소 검색"
            placeholder="장소나 주소 검색 (예: 합정역, 용산 청년지음)"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-neutral-400" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="지우기" className="text-neutral-400">✕</button>}
        </div>
        {hits !== null && (
          <ul className="absolute inset-x-4 top-full z-30 max-h-[50dvh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white py-1 shadow-lg">
            {searching && <li className="px-4 py-3 text-sm text-neutral-400">찾는 중…</li>}
            {!searching && hits.length === 0 && <li className="px-4 py-3 text-sm text-neutral-400">{err ?? "검색 결과가 없어요. 다른 이름으로 찾아보세요."}</li>}
            {hits.map((h) => (
              <li key={`${h.name}|${h.address}`}>
                <button type="button" onClick={() => pick(h)} className="w-full px-4 py-3 text-left hover:bg-neutral-50">
                  <span className="block text-[15px] font-semibold">{h.name}</span>
                  <span className="block truncate text-xs text-neutral-400">{h.address}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 지도 — 가운데 핀은 고정, 지도를 끌어 맞춘다 */}
      <div className="relative flex-1 bg-brand/5">
        {mapFailed
          ? <p className="grid h-full place-items-center px-8 text-center text-sm text-neutral-400">지도를 불러오지 못했어요.<br />검색으로 장소를 골라 주세요.</p>
          : <div ref={box} className="size-full" />}
        {!mapFailed && (
          <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-10 -translate-x-1/2 -translate-y-full text-brand drop-shadow">
            <path fill="currentColor" d="M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13z" /><circle cx="12" cy="9" r="3" fill="#fff" />
          </svg>
        )}
        {home.lat != null && (
          <button type="button" onClick={goHome}
            className="absolute bottom-3 left-3 z-10 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-neutral-700 shadow-md">
            우리 기관 위치
          </button>
        )}
        {!mapFailed && (
          <p className="pointer-events-none absolute inset-x-0 top-3 z-10 text-center">
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs text-neutral-600 shadow">지도를 움직여 핀을 정확한 위치에 맞춰 주세요</span>
          </p>
        )}
      </div>

      {/* 확인 */}
      <div className="shrink-0 space-y-2 border-t border-neutral-100 px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <p className="flex items-center gap-1.5 text-sm text-neutral-600">
          <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 text-brand" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          <span className="truncate">{address ?? "주소를 찾는 중이에요"}</span>
        </p>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} aria-label="장소 이름"
          placeholder="장소 이름·상세 위치 (예: 용산 청년지음 1층 나눔곳간)" />
        <button type="button" disabled={!address}
          onClick={() => onDone({ name: name.trim() || address!, address, lat: center.lat, lng: center.lng })}
          className="btn-cta">이 위치로 정하기</button>
      </div>
    </div>
  );
}
