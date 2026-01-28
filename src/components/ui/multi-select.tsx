import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Selecionar...",
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectedLabels = selected
    .map((value) => options.find((opt) => opt.value === value)?.label)
    .filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between bg-background font-normal",
            !selected.length && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate flex-1 text-left">
            {selected.length === 0
              ? placeholder
              : selected.length === 1
              ? selectedLabels[0]
              : `${selected.length} selecionados`}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {selected.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-xs font-medium"
                onClick={handleClear}
              >
                {selected.length}
                <X className="h-3 w-3 ml-1 hover:text-destructive" />
              </Badge>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 bg-background z-50" align="start">
        <ScrollArea className="max-h-[300px]">
          <div className="p-2 space-y-1">
            {options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma opção disponível
              </div>
            ) : (
              options.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    selected.includes(option.value) && "bg-accent/50"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => handleSelect(option.value)}
                    className="pointer-events-none"
                  />
                  <span className="text-sm flex-1">{option.label}</span>
                  {selected.includes(option.value) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => onChange([])}
            >
              Limpar seleção
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
