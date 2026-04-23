import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, RotateCw, Loader2, X } from "lucide-react";

interface Props {
  onCapture: (base64: string) => void;
  onCancel: () => void;
  title?: string;
}

export function EstacaoSelfieCapture({ onCapture, onCancel, title = "Selfie" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamReady(true);
        }
      } catch (e: any) {
        setError(e?.message || "Não foi possível acessar a câmera.");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const takeShot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    const size = Math.min(v.videoWidth, v.videoHeight);
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const sx = (v.videoWidth - size) / 2;
    const sy = (v.videoHeight - size) / 2;
    // Mirror horizontally to match preview
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
  };

  const confirm = () => {
    if (preview) onCapture(preview);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Button variant="ghost" size="lg" onClick={onCancel}>
          <X className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="relative w-full max-w-2xl aspect-square rounded-3xl overflow-hidden bg-muted shadow-2xl">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <p className="text-destructive text-lg">{error}</p>
            </div>
          ) : preview ? (
            <img src={preview} alt="Pré-visualização" className="w-full h-full object-cover" />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
              {!streamReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>

      <div className="p-6 border-t border-border flex gap-4 justify-center">
        {preview ? (
          <>
            <Button size="lg" variant="outline" className="h-16 text-lg px-8" onClick={() => setPreview(null)}>
              <RotateCw className="h-5 w-5 mr-2" /> Tirar outra
            </Button>
            <Button size="lg" className="h-16 text-lg px-12" onClick={confirm}>
              Confirmar
            </Button>
          </>
        ) : (
          <Button
            size="lg"
            className="h-20 text-xl px-16"
            onClick={takeShot}
            disabled={!streamReady || !!error}
          >
            <Camera className="h-7 w-7 mr-3" /> Capturar selfie
          </Button>
        )}
      </div>
    </div>
  );
}
