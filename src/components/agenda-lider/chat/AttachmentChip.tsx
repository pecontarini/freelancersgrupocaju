import { FileText, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttachmentChipProps {
  name: string;
  kind: "text" | "image";
  loading?: boolean;
  truncated?: boolean;
  onRemove?: () => void;
}

export function AttachmentChip({ name, kind, loading, truncated, onRemove }: AttachmentChipProps) {
  const Icon = kind === "image" ? ImageIcon : FileText;
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-xs">
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="h-3.5 w-3.5 text-primary" />
      )}
      <span className="max-w-[180px] truncate font-medium" title={name}>
        {name}
      </span>
      {truncated && (
        <span className="rounded-sm bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          truncado
        </span>
      )}
      {onRemove && !loading && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-full hover:bg-destructive/20"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
