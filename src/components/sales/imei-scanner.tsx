"use client";

import { useState, useRef, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, X, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ImeiScannerProps {
  onScan: (imei: string) => void;
  disabled?: boolean;
}

/**
 * Dual-mode IMEI capture: camera barcode scan (works on Android/desktop
 * webcams — also compatible with most USB/Bluetooth "keyboard emulation"
 * scanners since those just type + Enter into the manual field) or manual
 * entry. This is the entry point for the whole sales flow.
 */
export function ImeiScanner({ onScan, disabled }: ImeiScannerProps) {
  const [manualImei, setManualImei] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const scanHandledRef = useRef(false);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraOpen(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    setCameraOpen(true);
    scanHandledRef.current = false;
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.EAN_13]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 120 });
      readerRef.current = reader;
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCamera = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];

      if (!videoRef.current) return;

      const controls = await reader.decodeFromVideoDevice(
        backCamera?.deviceId,
        videoRef.current,
        (result) => {
          if (result && !scanHandledRef.current) {
            scanHandledRef.current = true;
            onScan(result.getText());
            stopCamera();
          }
        }
      );
      controlsRef.current = controls;
    } catch (err) {
      setCameraError("Could not access camera. Check browser permissions or enter the IMEI manually.");
    }
  }, [onScan, stopCamera]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualImei.trim().length >= 14) {
      onScan(manualImei.trim());
      setManualImei("");
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <Input
          value={manualImei}
          onChange={(e) => setManualImei(e.target.value.replace(/\D/g, ""))}
          placeholder="Scan or type 15-digit IMEI"
          inputMode="numeric"
          autoFocus
          disabled={disabled}
          className="text-lg tracking-wide"
        />
        <Button type="button" variant="outline" size="icon" onClick={startCamera} disabled={disabled} aria-label="Open camera scanner">
          <Camera className="h-5 w-5" />
        </Button>
        <Button type="submit" disabled={disabled || manualImei.trim().length < 14}>
          Add
        </Button>
      </form>

      {cameraOpen && (
        <div className="relative overflow-hidden rounded-2xl border bg-black">
          <video ref={videoRef} onPlaying={() => setCameraReady(true)} className="aspect-video w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-black/60 px-4 py-3 text-center text-sm font-medium text-white">
              <ScanLine className="h-8 w-8 animate-pulse" />
              <span>{cameraReady ? "বারকোড ফ্রেমের মধ্যে ধরুন" : "ক্যামেরা চালু হচ্ছে…"}</span>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2"
            onClick={stopCamera}
            aria-label="Close scanner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {cameraError && <p className="text-sm text-destructive">{cameraError}</p>}
    </div>
  );
}
