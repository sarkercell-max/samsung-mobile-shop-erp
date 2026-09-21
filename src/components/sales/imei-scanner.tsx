"use client";

import { useState, useRef, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
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
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraOpen(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraOpen(true);
    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCamera = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];

      if (!videoRef.current) return;

      const controls = await reader.decodeFromVideoDevice(
        backCamera?.deviceId,
        videoRef.current,
        (result) => {
          if (result) {
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
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <ScanLine className="h-10 w-10 animate-pulse text-white/70" />
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
