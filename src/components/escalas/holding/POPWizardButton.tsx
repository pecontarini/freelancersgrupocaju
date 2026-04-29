import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface POPWizardButtonProps {
  onClick: () => void;
  className?: string;
}

export function POPWizardButton({ onClick, className }: POPWizardButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "h-14 rounded-full px-5 shadow-2xl",
        "bg-primary text-primary-foreground hover:bg-primary/90",
        "backdrop-blur-md border border-primary/30",
        "transition-all hover:scale-[1.03]",
        className,
      )}
      aria-label="Abrir POP Wizard"
    >
      <Sparkles className="mr-2 h-5 w-5" />
      <span className="font-semibold uppercase tracking-wide text-sm">POP Wizard</span>
    </Button>
  );
}
