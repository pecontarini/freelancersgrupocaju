import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DollarSign,
  Hash,
  Receipt,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { MaintenanceEntry } from "@/types/maintenance";
import { formatCurrency } from "@/lib/formatters";

interface MaintenanceReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: MaintenanceEntry[];
  periodLabel: string;
}

const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(45 93% 47%)",
  "hsl(200 70% 50%)",
  "hsl(340 75% 55%)",
];

const PAGE_SIZE = 15;

export function MaintenanceReportModal({
  open,
  onOpenChange,
  entries,
  periodLabel,
}: MaintenanceReportModalProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // --- KPIs ---
  const totalGasto = entries.reduce((s, e) => s + e.valor, 0);
  const volume = entries.length;
  const ticketMedio = volume > 0 ? totalGasto / volume : 0;

  // --- Filtered entries for table ---
  const filteredEntries = useMemo(() => {
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.fornecedor.toLowerCase().includes(q) ||
        (e.descricao && e.descricao.toLowerCase().includes(q)) ||
        e.numero_nf.toLowerCase().includes(q)
    );
  }, [entries, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page on search change
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // --- Chart 1: Cost by day ---
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      const existing = map.get(e.data_servico) || 0;
      map.set(e.data_servico, existing + e.valor);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, valor]) => {
        const [y, m, d] = date.split("-");
        return { date: `${d}/${m}`, valor, fullDate: date };
      });
  }, [entries]);

  // --- Chart 2: Distribution by supplier ---
  const supplierData = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      const key = e.fornecedor;
      map.set(key, (map.get(key) || 0) + e.valor);
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [entries]);

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-500" />
            Relatório Detalhado de Manutenções
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Total Gasto
                  </p>
                  <p className="text-xl font-bold">{formatCurrency(totalGasto)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Hash className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Volume
                  </p>
                  <p className="text-xl font-bold">{volume}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Ticket Médio
                  </p>
                  <p className="text-xl font-bold">{formatCurrency(ticketMedio)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          {entries.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Bar Chart - Cost over time */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-4 uppercase text-muted-foreground">
                    Tendência de Custos por Dia
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          className="fill-muted-foreground"
                          tickFormatter={(v) =>
                            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                          }
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            formatCurrency(value),
                            "Valor",
                          ]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--popover))",
                            color: "hsl(var(--popover-foreground))",
                          }}
                        />
                        <Bar
                          dataKey="valor"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Donut Chart - Distribution by supplier */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-4 uppercase text-muted-foreground">
                    Distribuição por Fornecedor
                  </h3>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={supplierData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name.length > 12 ? name.slice(0, 12) + "…" : name} ${(percent * 100).toFixed(0)}%`
                          }
                          labelLine={false}
                        >
                          {supplierData.map((_, i) => (
                            <Cell
                              key={`cell-${i}`}
                              fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [
                            formatCurrency(value),
                            "Valor",
                          ]}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--popover))",
                            color: "hsl(var(--popover-foreground))",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search + Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar fornecedor, descrição ou NF..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredEntries.length} registro(s)
              </span>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>NF</TableHead>
                    <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center w-[50px]">Anexo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.length > 0 ? (
                    paginatedEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {formatDate(entry.data_servico)}
                        </TableCell>
                        <TableCell>{entry.fornecedor}</TableCell>
                        <TableCell>{entry.numero_nf}</TableCell>
                        <TableCell className="hidden sm:table-cell max-w-[200px] truncate">
                          {entry.descricao || "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">
                          {formatCurrency(entry.valor)}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.anexo_url ? (
                            <a
                              href={entry.anexo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex text-primary hover:text-primary/80"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </span>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setPage(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
