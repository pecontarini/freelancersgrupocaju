import { useState, useMemo, useCallback } from "react";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MappingEntry, MatchOption, normalizeString } from "@/lib/fuzzyMatch";

interface FunctionMappingReviewProps {
  mappings: MappingEntry[];
  options: MatchOption[];
  onMappingChange: (rowIndex: number, selectedId: string, selectedName: string) => void;
  fieldLabel: string;
}

export function FunctionMappingReview({
  mappings,
  options,
  onMappingChange,
  fieldLabel,
}: FunctionMappingReviewProps) {
  // Group mappings by unique original value for cleaner display
  const groupedMappings = useMemo(() => {
    const groups = new Map<string, {
      normalized: string;
      original: string;
      rowIndices: number[];
      selectedMatch: string | null;
      selectedMatchId: string | null;
      similarity: number;
      isExactMatch: boolean;
      needsReview: boolean;
      suggestions: MatchOption[];
    }>();

    mappings.forEach(m => {
      const normalized = normalizeString(m.original);
      if (!groups.has(normalized)) {
        groups.set(normalized, {
          normalized,
          original: m.original,
          rowIndices: [],
          selectedMatch: m.selectedMatch,
          selectedMatchId: m.selectedMatchId,
          similarity: m.similarity,
          isExactMatch: m.isExactMatch,
          needsReview: m.needsReview,
          suggestions: m.suggestions,
        });
      }
      groups.get(normalized)!.rowIndices.push(m.rowIndex);
    });

    return Array.from(groups.values());
  }, [mappings]);

  const handleSelectionChange = useCallback((
    normalized: string, 
    selectedId: string
  ) => {
    const group = groupedMappings.find(g => g.normalized === normalized);
    if (!group) return;

    const selectedOption = options.find(o => o.id === selectedId);
    if (!selectedOption) return;

    // Update all rows with this normalized value
    group.rowIndices.forEach(rowIndex => {
      onMappingChange(rowIndex, selectedId, selectedOption.nome);
    });
  }, [groupedMappings, options, onMappingChange]);

  const unmappedCount = groupedMappings.filter(
    g => !g.isExactMatch && !g.selectedMatchId
  ).length;

  const reviewCount = groupedMappings.filter(g => g.needsReview).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span>
            {groupedMappings.length - reviewCount} mapeada(s) automaticamente
          </span>
        </div>
        {reviewCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>{reviewCount} precisa(m) de revisão</span>
          </div>
        )}
        {unmappedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-destructive" />
            <span>{unmappedCount} sem mapeamento</span>
          </div>
        )}
      </div>

      {/* Mapping Table */}
      <ScrollArea className="h-[300px] rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead className="w-[40px]">Qtd</TableHead>
              <TableHead>{fieldLabel} (Planilha)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{fieldLabel} (Sistema)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedMappings.map((group) => (
              <TableRow
                key={group.normalized}
                className={
                  group.needsReview && !group.selectedMatchId
                    ? "bg-amber-50 dark:bg-amber-950/20"
                    : group.isExactMatch
                    ? "bg-green-50 dark:bg-green-950/20"
                    : ""
                }
              >
                <TableCell className="font-medium">
                  {group.rowIndices.length}
                </TableCell>
                <TableCell>
                  <span className="font-medium">{group.original}</span>
                </TableCell>
                <TableCell>
                  {group.isExactMatch ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                      Exato
                    </Badge>
                  ) : group.selectedMatchId ? (
                    <Badge variant="secondary">
                      {Math.round(group.similarity * 100)}% similar
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      Selecionar
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {group.isExactMatch ? (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {group.selectedMatch}
                    </span>
                  ) : (
                    <Select
                      value={group.selectedMatchId || ""}
                      onValueChange={(value) => 
                        handleSelectionChange(group.normalized, value)
                      }
                    >
                      <SelectTrigger 
                        className={`w-full ${
                          !group.selectedMatchId 
                            ? "border-amber-500 focus:ring-amber-500" 
                            : ""
                        }`}
                      >
                        <SelectValue 
                          placeholder={
                            group.selectedMatch 
                              ? `${group.selectedMatch} (sugerido)` 
                              : "Selecione..."
                          } 
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Show suggestions first */}
                        {group.suggestions.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Sugestões
                            </div>
                            {group.suggestions.map((opt) => (
                              <SelectItem key={`sugg-${opt.id}`} value={opt.id}>
                                {opt.nome}
                              </SelectItem>
                            ))}
                            <div className="my-1 border-t" />
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                              Todas as opções
                            </div>
                          </>
                        )}
                        {options.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
