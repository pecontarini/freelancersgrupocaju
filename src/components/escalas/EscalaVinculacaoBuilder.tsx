import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Search, FileDown, Users, GripVertical, Copy, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

type Employee = {
  id: string;
  name: string;
  job_title: string | null;
  job_title_id: string | null;
  worker_type: string | null;
};
type Vinculacao = {
  id: string;
  template_id: string;
  funcionario_id: string;
  dia_semana: string;
  tipo_turno: string;
};

const DIAS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"] as const;
const DIA_LABEL: Record<string, string> = {
  SEG: "Seg", TER: "Ter", QUA: "Qua", QUI: "Qui",
  SEX: "Sex", SAB: "Sáb", DOM: "Dom",
};

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function renderHorarioLabel(slot: any): string {
  const t1 = slot.t1?.entrada ? `${slot.t1.entrada}→${slot.t1.saida}` : null;
  const t2 = slot.t2?.entrada ? `${slot.t2.entrada}→${slot.t2.saida}` : null;
  const gap = slot.break_min ? `⏸${(slot.break_min / 60).toFixed(0)}h` : null;
  return [t1, t1 && t2 ? gap : null, t2].filter(Boolean).join(" ");
}

type Props = {
  templateId: string;
  unidadeId: string;
  setor: string;
  payload: any;
  semanaInicio: Date;
  semanaFim: Date;
};

function EmployeeCard({ emp, hours }: { emp: Employee; hours: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `emp-${emp.id}`,
    data: { funcionario_id: emp.id, nome: emp.name },
  });
  const badgeColor =
    hours > 44
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : hours >= 40
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={
        "rounded-md border bg-background p-2 cursor-grab active:cursor-grabbing flex items-center gap-2 " +
        (isDragging ? "opacity-40" : "hover:bg-muted/50")
      }
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{emp.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">
          {emp.job_title ?? "—"}
        </div>
      </div>
      <Badge className={"text-[10px] border " + badgeColor}>{fmtH(hours * 60)}</Badge>
    </div>
  );
}

function SlotCell({
  dia,
  tipo,
  index,
  total,
  vinc,
  empName,
  onRemove,
}: {
  dia: string;
  tipo: string;
  index: number;
  total: number;
  vinc: Vinculacao | null;
  empName: string | null;
  onRemove: () => void;
}) {
  const id = `slot-${dia}-${tipo}-${index}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { dia, tipo },
    disabled: !!vinc,
  });
  if (vinc && empName) {
    return (
      <div className="rounded-md border bg-primary/10 border-primary/30 p-1.5 text-xs flex items-center justify-between gap-1">
        <span className="truncate font-medium">{empName}</span>
        <button
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive shrink-0"
          aria-label="Remover"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div
      ref={setNodeRef}
      className={
        "rounded-md border-2 border-dashed p-1.5 text-[11px] text-center text-muted-foreground transition-colors " +
        (isOver ? "border-primary bg-primary/10 text-primary" : "border-border")
      }
    >
      Arraste · {index + 1}/{total}
    </div>
  );
}

export function EscalaVinculacaoBuilder({ templateId, unidadeId, setor, payload }: Props) {
  const [busca, setBusca] = useState("");
  const [draggingName, setDraggingName] = useState<string | null>(null);

  // Funcionários da unidade
  const { data: employees = [] } = useQuery({
    queryKey: ["vinc-employees", unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, job_title, job_title_id, worker_type")
        .eq("unit_id", unidadeId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Employee[];
    },
  });

  // Vinculações deste template
  const { data: vinculacoes = [], refetch: refetchVinc } = useQuery({
    queryKey: ["vinculacoes", templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escala_vinculacao")
        .select("id, template_id, funcionario_id, dia_semana, tipo_turno")
        .eq("template_id", templateId);
      if (error) throw error;
      return (data ?? []) as Vinculacao[];
    },
  });

  // Lista de tipos únicos cruzando todos os dias do payload (para virar linhas do grid)
  const tiposUnicos = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of DIAS) {
      const slots = payload?.dias?.[d]?.slots ?? [];
      for (const s of slots) {
        if (!map.has(s.tipo)) map.set(s.tipo, s);
      }
    }
    return Array.from(map.entries()); // [tipo, slotExemplo]
  }, [payload]);

  // Quantos slots de cada tipo, por dia
  const slotsPorDiaTipo = useMemo(() => {
    const m: Record<string, Record<string, { qtd: number; jornada_min: number }>> = {};
    for (const d of DIAS) {
      m[d] = {};
      const slots = payload?.dias?.[d]?.slots ?? [];
      for (const s of slots) {
        m[d][s.tipo] = { qtd: s.quantidade ?? s.qtd ?? 1, jornada_min: s.jornada_dia_min ?? 0 };
      }
    }
    return m;
  }, [payload]);

  // Total de slots e preenchidos
  const totalSlots = useMemo(() => {
    let t = 0;
    for (const d of DIAS) {
      for (const tipo of Object.keys(slotsPorDiaTipo[d])) {
        t += slotsPorDiaTipo[d][tipo].qtd;
      }
    }
    return t;
  }, [slotsPorDiaTipo]);

  // Mapa: dia+tipo+index → vinc
  const vincMap = useMemo(() => {
    const m: Record<string, Vinculacao> = {};
    // Agrupa por dia+tipo, ordena por created e atribui índices 0..n
    const grupos: Record<string, Vinculacao[]> = {};
    for (const v of vinculacoes) {
      const k = `${v.dia_semana}|${v.tipo_turno}`;
      grupos[k] = grupos[k] ?? [];
      grupos[k].push(v);
    }
    for (const k of Object.keys(grupos)) {
      grupos[k].forEach((v, i) => {
        m[`${k}|${i}`] = v;
      });
    }
    return m;
  }, [vinculacoes]);

  const empMap = useMemo(() => {
    const m: Record<string, Employee> = {};
    for (const e of employees) m[e.id] = e;
    return m;
  }, [employees]);

  // Carga horária por funcionário (somando jornada do tipo de cada dia)
  const horasPorFunc = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of vinculacoes) {
      const j = slotsPorDiaTipo[v.dia_semana]?.[v.tipo_turno]?.jornada_min ?? 0;
      m[v.funcionario_id] = (m[v.funcionario_id] ?? 0) + j;
    }
    // converte min → horas
    for (const k of Object.keys(m)) m[k] = Math.round((m[k] / 60) * 100) / 100;
    return m;
  }, [vinculacoes, slotsPorDiaTipo]);

  // Filtro: setor (match opcional por job_title) + busca
  const employeesFiltrados = useMemo(() => {
    const setorRgx = new RegExp(setor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const list = employees.filter((e) => {
      const matchSetor = e.job_title ? setorRgx.test(e.job_title) : false;
      // se nenhum funcionário casa por setor, mostramos todos
      return matchSetor;
    });
    const final = list.length > 0 ? list : employees;
    if (!busca.trim()) return final;
    const q = busca.toLowerCase();
    return final.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, setor, busca]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingName(null);
    const { active, over } = event;
    if (!over) return;
    const funcionarioId = active.data.current?.funcionario_id as string | undefined;
    const dia = over.data.current?.dia as string | undefined;
    const tipo = over.data.current?.tipo as string | undefined;
    if (!funcionarioId || !dia || !tipo) return;

    // 1. Duplicata no mesmo dia
    const jaNoDia = vinculacoes.find(
      (v) => v.funcionario_id === funcionarioId && v.dia_semana === dia,
    );
    if (jaNoDia) {
      toast.error("Já alocado neste dia");
      return;
    }

    // 2. Folga sugerida
    const folga: string[] = payload?.dias_folga_sugeridos ?? [];
    if (folga.includes(dia)) {
      toast.error("Dia de folga sugerida");
      return;
    }

    // 3. Aviso >44h
    const horasAtuais = horasPorFunc[funcionarioId] ?? 0;
    const adicional = (slotsPorDiaTipo[dia]?.[tipo]?.jornada_min ?? 0) / 60;
    if (horasAtuais + adicional > 44) {
      toast.warning(`Atenção: total ficará em ${(horasAtuais + adicional).toFixed(1)}h (>44h)`);
    }

    // 4. Insert
    const tipoDia = payload?.dias?.[dia]?.tipo_dia ?? "A";
    const { error } = await supabase.from("escala_vinculacao").insert([{
      template_id: templateId,
      funcionario_id: funcionarioId,
      dia_semana: dia,
      tipo_turno: tipo,
      tipo_dia: tipoDia,
    }]);
    if (error) {
      toast.error(error.message);
      return;
    }
    refetchVinc();
  };

  const removerVinculacao = async (id: string) => {
    const { error } = await supabase.from("escala_vinculacao").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refetchVinc();
  };

  const exportarPdf = () => {
    toast.info("Exportação de PDF em breve");
  };

  const preenchidos = vinculacoes.length;
  const completo = totalSlots > 0 && preenchidos >= totalSlots;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Vincular funcionários — {setor}
          </CardTitle>
          <div className="flex items-center gap-3 min-w-[260px]">
            <div className="flex-1">
              <Progress value={totalSlots > 0 ? (preenchidos / totalSlots) * 100 : 0} className="h-2" />
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {preenchidos} / {totalSlots} slots preenchidos
              </div>
            </div>
            {completo && (
              <Button onClick={exportarPdf} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setDraggingName((e.active.data.current as any)?.nome ?? null)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingName(null)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            {/* Painel esquerdo */}
            <aside className="lg:sticky lg:top-2 lg:self-start space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase">Equipe — {setor}</div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-7 h-9"
                />
              </div>
              <ScrollArea className="h-[520px] pr-2">
                <div className="space-y-1.5">
                  {employeesFiltrados.length === 0 && (
                    <div className="text-xs text-muted-foreground p-2">Nenhum funcionário ativo.</div>
                  )}
                  {employeesFiltrados.map((emp) => (
                    <EmployeeCard key={emp.id} emp={emp} hours={horasPorFunc[emp.id] ?? 0} />
                  ))}
                </div>
              </ScrollArea>
            </aside>

            {/* Grid semanal */}
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 text-xs min-w-[760px]">
                <thead>
                  <tr>
                    <th className="text-left font-medium text-muted-foreground p-1 w-[220px]">Tipo</th>
                    {DIAS.map((d) => (
                      <th key={d} className="font-medium text-muted-foreground p-1 text-center">
                        {DIA_LABEL[d]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tiposUnicos.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-muted-foreground p-4">
                        Nenhum slot encontrado no payload aprovado.
                      </td>
                    </tr>
                  )}
                  {tiposUnicos.map(([tipo, exemplo]) => (
                    <tr key={tipo}>
                      <td className="p-1 align-top">
                        <div className="font-medium">{tipo}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {renderHorarioLabel(exemplo)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {fmtH(exemplo.jornada_dia_min ?? 0)}
                        </div>
                      </td>
                      {DIAS.map((d) => {
                        const meta = slotsPorDiaTipo[d][tipo];
                        const qtd = meta?.qtd ?? 0;
                        if (qtd === 0) {
                          return (
                            <td key={d} className="p-1 align-top">
                              <div className="text-[10px] text-center text-muted-foreground/60 italic py-2">
                                —
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={d} className="p-1 align-top">
                            <div className="space-y-1">
                              {Array.from({ length: qtd }).map((_, i) => {
                                const v = vincMap[`${d}|${tipo}|${i}`] ?? null;
                                const empName = v ? empMap[v.funcionario_id]?.name ?? "?" : null;
                                return (
                                  <SlotCell
                                    key={i}
                                    dia={d}
                                    tipo={tipo}
                                    index={i}
                                    total={qtd}
                                    vinc={v}
                                    empName={empName}
                                    onRemove={() => v && removerVinculacao(v.id)}
                                  />
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DragOverlay>
            {draggingName && (
              <div className="rounded-md border bg-primary text-primary-foreground px-2 py-1 text-xs shadow-lg">
                {draggingName}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}
