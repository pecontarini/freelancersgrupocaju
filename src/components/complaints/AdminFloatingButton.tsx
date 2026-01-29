import { useState } from "react";
import { Camera, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReclamacaoModal } from "./ReclamacaoModal";
import { cn } from "@/lib/utils";

interface AdminFloatingButtonProps {
  selectedLojaId?: string | null;
  className?: string;
}

export function AdminFloatingButton({ selectedLojaId, className }: AdminFloatingButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className={cn("fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2", className)}>
      {/* Expanded Actions */}
      {isExpanded && (
        <div className="flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-200">
          <ReclamacaoModal
            selectedLojaId={selectedLojaId}
            trigger={
              <Button
                size="lg"
                className="rounded-full shadow-lg h-14 px-5 gap-2 bg-gradient-to-r from-primary to-primary/80"
              >
                <Camera className="h-5 w-5" />
                <span className="font-medium">Fotografar Reclamação</span>
              </Button>
            }
          />
        </div>
      )}
      
      {/* Main FAB */}
      <Button
        size="icon"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "h-14 w-14 rounded-full shadow-xl transition-all duration-200",
          isExpanded 
            ? "bg-muted text-muted-foreground rotate-45" 
            : "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
        )}
      >
        {isExpanded ? (
          <X className="h-6 w-6" />
        ) : (
          <Plus className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
}
