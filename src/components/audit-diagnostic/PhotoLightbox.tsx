import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoLightboxProps {
  photos: { url: string; label?: string }[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function PhotoLightbox({ photos, currentIndex, open, onClose, onNavigate }: PhotoLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, currentIndex, photos.length, onClose, onNavigate]);

  if (!open || photos.length === 0) return null;

  const photo = photos[currentIndex];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 animate-in fade-in duration-200">
      {/* Close */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Counter */}
      <div className="absolute top-4 left-4 text-white/70 text-sm z-10">
        {currentIndex + 1} / {photos.length}
      </div>

      {/* Label */}
      {photo.label && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-4 py-1.5 rounded-full z-10">
          {photo.label}
        </div>
      )}

      {/* Nav left */}
      {currentIndex > 0 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 z-10"
          onClick={() => onNavigate(currentIndex - 1)}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Nav right */}
      {currentIndex < photos.length - 1 && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 z-10"
          onClick={() => onNavigate(currentIndex + 1)}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Image */}
      <img
        src={photo.url}
        alt={photo.label || "Evidência"}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
