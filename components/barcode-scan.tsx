"use client";

import { useEffect, useRef, useState } from "react";

type ScannerControls = { stop: () => void };

export function BarcodeScan({ onCode, onCancel }: { onCode: (code: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stopped = false;
    let controls: ScannerControls | null = null;
    const video = videoRef.current;
    const reported = { current: false };

    function found(value: string) {
      if (stopped || reported.current) return;
      reported.current = true;
      controls?.stop();
      onCodeRef.current(value);
    }

    async function run() {
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage("This browser has no camera. Type the barcode instead.");
        return;
      }
      try {
        if ("BarcodeDetector" in window) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
          if (stopped) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }
          video.srcObject = stream;
          await video.play();
          controls = { stop: () => stream.getTracks().forEach((track) => track.stop()) };
          const Detector = (
            window as unknown as {
              BarcodeDetector: new (opts: { formats: string[] }) => {
                detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
              };
            }
          ).BarcodeDetector;
          const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
          const tick = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(video);
              const value = codes[0]?.rawValue;
              if (value) {
                found(value);
                return;
              }
            } catch {
              // The next frame may decode.
            }
            if (!stopped) requestAnimationFrame(() => void tick());
          };
          void tick();
          return;
        }
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video,
          (result, _error, scanner) => {
            controls = scanner;
            const value = result?.getText();
            if (value) found(value);
          },
        );
      } catch {
        if (!stopped) setMessage("Camera isn't available. Type the barcode instead.");
      }
    }

    void run();
    return () => {
      stopped = true;
      controls?.stop();
      const stream = video?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div>
      <video ref={videoRef} className="scan-video" muted playsInline autoPlay />
      <p className="muted" style={{ marginTop: 10 }}>
        Point the camera at the package barcode. This works in Safari and from the iPhone home screen.
      </p>
      {message ? <p className="err" style={{ marginTop: 10 }}>{message}</p> : null}
      <form
        style={{ marginTop: 12 }}
        onSubmit={(event) => {
          event.preventDefault();
          const digits = manual.replace(/\D/g, "");
          if (digits.length < 8) {
            setMessage("Enter at least 8 digits.");
            return;
          }
          onCodeRef.current(digits);
        }}
      >
        <label className="field">
          <span>Or type the barcode</span>
          <input inputMode="numeric" autoComplete="off" value={manual} onChange={(event) => setManual(event.target.value)} placeholder="012345678905" />
        </label>
        <button className="btn" type="submit">Look up</button>
        <button className="btn-ghost" style={{ marginTop: 8 }} type="button" onClick={onCancel}>Back</button>
      </form>
    </div>
  );
}
