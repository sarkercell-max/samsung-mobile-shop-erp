"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { Camera, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ImeiScannerProps {
  onScan: (imei: string) => void;
  disabled?: boolean;
}

export function ImeiScanner({ onScan, disabled }: ImeiScannerProps) {
  const [manualImei, setManualImei] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const scanHandledRef = useRef(false);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    videoRef.current?.srcObject && (videoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
    setCameraReady(false);
  }, []);

  const closeCamera = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setCameraReady(false);
    scanHandledRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable in this browser. Enter the IMEI manually.");
      return;
    }
    setCameraOpen(true);
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
      ]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 120 });
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const backCamera = devices.find((device) => /back|rear|environment/i.test(device.label));
      if (!videoRef.current) return;
      controlsRef.current = await reader.decodeFromVideoDevice(backCamera?.deviceId, videoRef.current, (result) => {
        if (!result || scanHandledRef.current) return;
        scanHandledRef.current = true;
        const text = result.getText();
        closeCamera();
        onScan(text);
      });
    } catch {
      setCameraError("Could not access the camera. Check browser permission or enter the IMEI manually.");
    }
  }, [closeCamera, onScan, stopCamera]);

  const normalize = (value: string) => value;
  const handleManualSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = normalize(manualImei);
    if (!/^[0-9]{15}$/.test(value)) {
      setCameraError("IMEI must be exactly 15 digits.");
      return;
    }
    onScan(value);
    setManualImei("");
    setCameraError(null);
  };

  return (
    <div className="space-y-3">
      <Button type="button" onClick={startCamera} disabled={disabled} className="min-h-11 gap-2">
        <Camera className="h-5 w-5" /> Scan IMEI
      </Button>
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <Input value={manualImei} onChange={(event) => setManualImei(event.target.value.slice(0, 15))}
          placeholder="Or enter IMEI manually" inputMode="numeric" maxLength={15} disabled={disabled} className="text-lg tracking-wide" />
        <Button type="submit" disabled={disabled || !/^[0-9]{15}$/.test(manualImei)}>Add</Button>
      </form>
      {manualImei.length > 0 && !/^[0-9]{15}$/.test(manualImei) && <p role="alert" className="text-sm text-destructive">IMEI must be exactly 15 digits.</p>}
      {cameraError && <p role="alert" className="text-sm text-destructive">{cameraError}</p>}

      <Dialog open={cameraOpen} onOpenChange={(open) => { if (!open) closeCamera(); }}>
        <DialogContent onEscapeKeyDown={closeCamera} onInteractOutside={closeCamera}>
          <DialogHeader><DialogTitle>Scan IMEI</DialogTitle></DialogHeader>
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} onPlaying={() => setCameraReady(true)} className="aspect-video w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 rounded-xl bg-black/60 px-4 py-3 text-center text-sm text-white">
                <ScanLine className="h-8 w-8 animate-pulse" />
                <span>{cameraReady ? "Hold the barcode inside the frame" : "Starting camera…"}</span>
              </div>
            </div>
          </div>
          {cameraError && <p role="alert" className="text-sm text-destructive">{cameraError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={stopCamera} disabled={!cameraReady}>Stop</Button>
            <Button type="button" variant="outline" onClick={startCamera}>Start</Button>
            <Button type="button" onClick={closeCamera}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
