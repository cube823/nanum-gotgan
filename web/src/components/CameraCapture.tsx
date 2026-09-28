"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Facing = "environment" | "user";
type Caps = { torch: boolean; wide: boolean };   // 이 폰·브라우저가 플래시(torch)·0.5x(zoom ≤ 0.5)를 주는가

/** 기획 정의서 70-25(카메라 안내) → 70-26(카메라 화면). 웹 카메라(getUserMedia).
 *
 *  - 70-25는 **우리 안내**다. 진짜 권한 팝업은 그 뒤에 브라우저가 띄운다 — 웹은 그걸 대신 그릴 수 없다.
 *    이미 허용돼 있으면 안내 없이 바로 연다.
 *  - 플래시·0.5x는 브라우저마다 다르다(아이폰 사파리는 대개 안 준다). 되는 폰에서만 버튼을 보인다.
 *  - 카메라를 못 열면(권한 거부·인앱 브라우저·http) onFallback — 폰 기본 카메라로 찍게 한다.
 *  찍으면 onShot(File) 후 닫는다 — 사진 선택 화면에서 바로 선택·업로드된다. */
export function CameraCapture({ onShot, onClose, onFallback }: {
  onShot: (file: File) => void; onClose: () => void; onFallback: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<"ask" | "starting" | "live" | "denied">("starting");
  const [facing, setFacing] = useState<Facing>("environment");
  const [caps, setCaps] = useState<Caps>({ torch: false, wide: false });
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState<0.5 | 1>(1);
  const [flashFx, setFlashFx] = useState(false);
  // 부모(사진 선택)는 업로드 진행마다 다시 그려져 콜백이 매번 새로 온다 — 그대로 의존하면 카메라가 계속 다시 켜진다
  const fallback = useRef(onFallback);
  useEffect(() => { fallback.current = onFallback; });

  const stop = useCallback(() => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; }, []);

  const start = useCallback(async (f: Facing) => {
    if (!navigator.mediaDevices?.getUserMedia) { fallback.current(); return; }
    setPhase("starting");
    stop();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: f }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false,
      });
      stream.current = s;
      if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
      const track = s.getVideoTracks()[0];
      const c = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean; zoom?: { min: number } };
      setCaps({ torch: !!c.torch, wide: !!c.zoom && c.zoom.min <= 0.5 });
      setTorch(false); setZoom(1);
      setPhase("live");
    } catch (e) {
      if ((e as DOMException).name === "NotAllowedError") setPhase("denied");
      else fallback.current();   // 카메라가 없거나 못 여는 환경
    }
  }, [stop]);

  // 처음: 이미 허용돼 있으면 바로, 아니면 70-25 안내부터. 권한 조회가 안 되는 브라우저도 안내부터.
  useEffect(() => {
    let alive = true;
    void (async () => {
      let granted = false;
      try { granted = (await navigator.permissions.query({ name: "camera" as PermissionName })).state === "granted"; } catch { /* 조회 불가 */ }
      if (!alive) return;
      if (granted) void start("environment"); else setPhase("ask");
    })();
    return () => { alive = false; stop(); };
  }, [start, stop]);

  async function applyTrack(c: MediaTrackConstraintSet) {
    const track = stream.current?.getVideoTracks()[0];
    await track?.applyConstraints({ advanced: [c] }).catch(() => {});
  }

  async function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setFlashFx(true); setTimeout(() => setFlashFx(false), 150);
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) return;
    stop();
    onShot(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
    onClose();
  }

  const close = () => { stop(); onClose(); };

  // ── 70-25: 카메라 안내 (사진 선택 화면 위) ──
  if (phase === "ask" || phase === "denied") {
    return (
      <div className="fixed inset-0 z-50 mx-auto grid max-w-md place-items-center bg-black/40 px-11" role="dialog" aria-modal="true" aria-labelledby="cam-title">
        <div className="w-full rounded-3xl bg-white p-5">
          <span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          </span>
          {phase === "ask" ? (
            <>
              <p id="cam-title" className="mt-4 text-lg font-bold leading-snug">‘나눔곳간’이(가) 카메라에<br />접근하려고 합니다.</p>
              <p className="mt-1.5 text-sm text-neutral-400">물품 사진을 촬영할 때 사용합니다.</p>
              <button type="button" onClick={() => void start("environment")} className="btn-cta mt-5 h-13">허용</button>
              <button type="button" onClick={close} className="btn-ghost mt-2 h-13 w-full rounded-2xl">허용 안 함</button>
            </>
          ) : (
            <>
              <p id="cam-title" className="mt-4 text-lg font-bold leading-snug">카메라 권한이 꺼져 있어요</p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">브라우저 설정에서 카메라를 허용하거나,<br />폰 기본 카메라로 찍어 주세요.</p>
              <button type="button" onClick={onFallback} className="btn-cta mt-5 h-13">기본 카메라로 찍기</button>
              <button type="button" onClick={close} className="btn-ghost mt-2 h-13 w-full rounded-2xl">닫기</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 70-26: 카메라 화면 ──
  const round = "grid size-10 place-items-center rounded-full bg-white/15 text-white";
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-black" role="dialog" aria-modal="true" aria-label="카메라">
      <div className="flex h-[66px] shrink-0 items-center px-4 pt-[env(safe-area-inset-top)]">
        {caps.torch && (
          <button type="button" aria-label={torch ? "플래시 끄기" : "플래시 켜기"} aria-pressed={torch}
            onClick={() => { const next = !torch; setTorch(next); void applyTrack({ torch: next } as MediaTrackConstraintSet); }}
            className={`${round} ${torch ? "!bg-yellow-300 !text-black" : ""}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round"><path d="M13 3 5 14h6l-1 7 8-11h-6z" /></svg>
          </button>
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={video} playsInline muted autoPlay
          className={`size-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
        {phase === "starting" && <span className="absolute inset-0 grid place-items-center text-sm text-white/70">카메라 여는 중…</span>}
        {flashFx && <span aria-hidden className="absolute inset-0 bg-white/70" />}
        {caps.wide && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center">
            <div className="flex gap-1 rounded-full bg-black/50 p-1 text-sm font-bold">
              {([0.5, 1] as const).map((z) => (
                <button key={z} type="button" aria-pressed={zoom === z}
                  onClick={() => { setZoom(z); void applyTrack({ zoom: z } as MediaTrackConstraintSet); }}
                  className={`h-9 min-w-9 rounded-full px-2.5 ${zoom === z ? "bg-white text-black" : "text-white"}`}>
                  {z}x
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex h-[128px] shrink-0 items-center justify-between px-10 pb-[env(safe-area-inset-bottom)]">
        <button type="button" onClick={close} aria-label="닫기" className="grid size-10 place-items-center text-2xl text-white">✕</button>
        <button type="button" onClick={() => void shoot()} disabled={phase !== "live"} aria-label="촬영"
          className="grid size-[72px] place-items-center rounded-full border-4 border-white disabled:opacity-50">
          <span className="size-[58px] rounded-full bg-white" />
        </button>
        <button type="button" aria-label="전면·후면 전환" className={round}
          onClick={() => { const f = facing === "environment" ? "user" : "environment"; setFacing(f); void start(f); }}>
          <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" /></svg>
        </button>
      </div>
    </div>
  );
}
