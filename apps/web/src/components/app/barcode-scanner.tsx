"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/provider";

type Status = "starting" | "scanning" | "denied" | "unsupported";

interface DetectedBarcode {
  rawValue: string;
}
interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => NativeDetector;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const isProductCode = (v: string) => /^\d{8,14}$/.test(v);

/**
 * Live camera scanner for EAN/UPC product codes.
 * Uses the browser's native BarcodeDetector where available (Chrome, Edge,
 * Android, recent Safari) and falls back to ZXing (pure JS, loaded on demand).
 * Calls onDetected once, then stops the camera.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopZxing: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const finish = (code: string) => {
      if (done.current || !isProductCode(code)) return;
      done.current = true;
      navigator.vibrate?.(60);
      onDetected(code);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      } catch {
        setStatus("denied");
        return;
      }
      if (cancelled || !videoRef.current) return;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setStatus("scanning");

      const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      if (Native) {
        const detector = new Native({ formats: FORMATS });
        const tick = async () => {
          if (cancelled || done.current) return;
          try {
            const codes = await detector.detect(video);
            if (codes[0]) finish(codes[0].rawValue);
          } catch {
            /* frame not ready */
          }
          timer = setTimeout(tick, 150);
        };
        void tick();
      } else {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        const controls = await reader.decodeFromStream(stream, video, (result) => {
          if (result) finish(result.getText());
        });
        stopZxing = () => controls.stop();
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stopZxing?.();
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
        {/* Muted + playsInline: required for autoplay on iOS */}
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" aria-label={t.scan.hint} />
        {status === "scanning" && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[32%] -translate-y-1/2 rounded-lg border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        )}
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {status === "starting" ? t.scan.starting : status === "denied" ? t.scan.denied : status === "unsupported" ? t.scan.unsupported : t.scan.hint}
      </p>
    </div>
  );
}
