import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SupervisionFailure } from "@/hooks/useSupervisionAudits";
import { categorizeItemToSector, SECTOR_POSITION_MAP, type AuditSector } from "@/lib/sectorPositionMapping";

interface RecurrenceRankingProps {
  failures: SupervisionFailure[];
}

interface RankedItem {
  itemName: string;
  sector: string;
  sectorKey: AuditSector;
  failCount: number;
  isRecurring: boolean;
}

export function RecurrenceRanking({ failures }: RecurrenceRankingProps) {
  // Aggregate failures by item name
  const ranked: RankedItem[] = (() => {
    const counts: Record<string, { count: number; sector: AuditSector }> = {};
    failures.forEach((f) => {
      const key = f.item_name;
      if (!counts[key]) {
        counts[key] = { count: 0, sector: categorizeItemToSector(f.item_name, f.category) };
      }
      counts[key].count++;
    });

    return Object.entries(counts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([name, { count, sector }]) => ({
        itemName: name,
        sector: SECTOR_POSITION_MAP[sector]?.displayName || sector,
        sectorKey: sector,
        failCount: count,
        isRecurring: count > 2,
      }));
  })();

  return (
    <Card className="rounded-2xl shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm uppercase">
          <Flame className="h-4 w-4 text-destructive" />
          Top 10 — Itens Mais Perdidos
        </CardTitle>
        <CardDescription>
          Ranking dos itens com maior frequência de falha no período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Nenhuma falha registrada no período.
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Item do Checklist</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="text-center w-[90px]">Falhas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((item, idx) => (
                  <TableRow
                    key={item.itemName}
                    className={item.isRecurring ? "bg-destructive/5 hover:bg-destructive/10" : ""}
                  >
                    <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.itemName}</span>
                        {item.isRecurring && (
                          <Badge variant="destructive" className="text-[10px] h-5 gap-0.5">
                            <Flame className="h-3 w-3" />
                            Recorrente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.sector}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`text-sm font-bold ${
                          item.isRecurring ? "text-destructive" : ""
                        }`}
                      >
                        {item.failCount}×
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
