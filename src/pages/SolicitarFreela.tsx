import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

interface Unidade { id: string; nome: string; }
interface SectorJobRow {
  sector_id: string;
  sector_name: string;
  job_id: string | null;
  job_name: string | null;
}

export default function SolicitarFreela() {
  const { tenant } = useTenant();
  const tenantSlug = tenant.slug;
  const brandName = tenant.copy.appName;

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [sectorJobRows, setSectorJobRows] = useState<SectorJobRow[]>([]);
  const [loadingSectors, setLoadingSectors] = useState(false);

  const [lojaId, setLojaId] = useState<string>("");
  const [dataPop, setDataPop] = useState<string>("");
  const [setor, setSetor] = useState<string>("");
  const [funcao, setFuncao] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [substitui, setSubstitui] = useState<string>("");
  const [solicitanteNome, setSolicitanteNome] = useState<string>("");
  const [solicitanteTelefone, setSolicitanteTelefone] = useState<string>("");
  const [horaInicio, setHoraInicio] = useState<string>("");
  const [horaFim, setHoraFim] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<null | { lojaNome: string }>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingUnidades(true);
      const { data, error } = await supabase.rpc("list_public_units", { _tenant_slug: tenantSlug });
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error("Não foi possível carregar as unidades.");
      } else {
        setUnidades((data as Unidade[]) ?? []);
      }
      setLoadingUnidades(false);
    })();
    return () => { cancelled = true; };
  }, [tenantSlug]);

  useEffect(() => {
    if (!lojaId) { setSectorJobRows([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingSectors(true);
      const { data, error } = await supabase.rpc("list_public_sectors_and_jobs", { _loja_id: lojaId });
      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error("Não foi possível carregar setores e cargos.");
      } else {
        setSectorJobRows((data as SectorJobRow[]) ?? []);
      }
      setSetor("");
      setFuncao("");
      setLoadingSectors(false);
    })();
    return () => { cancelled = true; };
  }, [lojaId]);

  const sectors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of sectorJobRows) {
      if (!seen.has(r.sector_id)) seen.set(r.sector_id, r.sector_name);
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sectorJobRows]);

  const jobsForSector = useMemo(() => {
    if (!setor) return [];
    return sectorJobRows
      .filter((r) => r.sector_name === setor && r.job_id && r.job_name)
      .map((r) => ({ id: r.job_id!, name: r.job_name! }))
      .filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sectorJobRows, setor]);

  const lojaNome = useMemo(() => unidades.find((u) => u.id === lojaId)?.nome ?? "", [unidades, lojaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const faltando: string[] = [];
    if (!lojaId) faltando.push("Unidade");
    if (!dataPop) faltando.push("Data da cobertura");
    if (!horaInicio) faltando.push("Horário de início");
    if (!horaFim) faltando.push("Horário final");
    if (!setor) faltando.push("Setor");
    if (!funcao) faltando.push("Cargo");
    if (!substitui) faltando.push("Cobrindo quem");
    if (!motivo) faltando.push("Motivo");
    if (!solicitanteNome) faltando.push("Solicitante");
    if (faltando.length > 0) {
      toast.error(`Faltou preencher: ${faltando.join(", ")}.`);
      return;
    }
    if (horaFim === horaInicio) {
      toast.error("O horário final não pode ser igual ao horário de início.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("create_public_freelancer_request", {
      _tenant_slug: tenantSlug,
      _loja_id: lojaId,
      _data_pop: dataPop,
      _setor: setor,
      _funcao: funcao,
      _motivo: motivo,
      _substitui: substitui,
      _solicitante_nome: solicitanteNome,
      _solicitante_telefone: solicitanteTelefone || null,
      _hora_inicio: horaInicio,
      _hora_fim: horaFim,
    });
    setSubmitting(false);
    if (error) {
      console.error(error);
      toast.error(error.message || "Não foi possível enviar sua solicitação.");
      return;
    }
    setSuccess({ lojaNome });
  };

  const viraODia = !!horaInicio && !!horaFim && horaFim < horaInicio;

  const waMeText = useMemo(() => {
    const [y, m, d] = dataPop.split("-");
    const dataFmt = dataPop ? `${d}/${m}/${y}` : "";
    const overnight = horaInicio && horaFim && horaFim < horaInicio;
    return encodeURIComponent(
      `*Nova solicitação de freelancer — ${brandName}*\n\n` +
      `Unidade: ${lojaNome}\n` +
      `Data da cobertura: ${dataFmt}\n` +
      `Setor: ${setor}\n` +
      `Cargo: ${funcao}\n` +
      `Horário: ${horaInicio} às ${horaFim}${overnight ? " (dia seguinte)" : ""}\n` +
      `Cobrindo: ${substitui}\n` +
      `Motivo: ${motivo}\n\n` +
      `Solicitante: ${solicitanteNome}` +
      (solicitanteTelefone ? ` (${solicitanteTelefone})` : "")
    );
  }, [brandName, lojaNome, dataPop, setor, funcao, substitui, motivo, solicitanteNome, solicitanteTelefone, horaInicio, horaFim]);

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="uppercase">Solicitação enviada</CardTitle>
            <CardDescription>
              Sua solicitação para a unidade <strong>{success.lojaNome}</strong> foi registrada.
              Os gerentes já podem visualizá-la no portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() => window.open(`https://wa.me/?text=${waMeText}`, "_blank")}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Compartilhar por WhatsApp
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSuccess(null);
                setLojaId("");
                setDataPop("");
                setSetor("");
                setFuncao("");
                setMotivo("");
                setSubstitui("");
                setSolicitanteNome("");
                setSolicitanteTelefone("");
                setHoraInicio("");
                setHoraFim("");
              }}
            >
              Nova solicitação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-bold uppercase">
            Solicitar Freelancer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {brandName} — preencha os dados para abrir a solicitação
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              {/* Unidade */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Unidade *</Label>
                <Select value={lojaId} onValueChange={setLojaId} disabled={loadingUnidades}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingUnidades ? "Carregando..." : "Selecione a unidade"} />
                  </SelectTrigger>
                  <SelectContent>
                    {unidades.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Data da cobertura */}
              <div className="space-y-2">
                <Label>Data da cobertura *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dataPop && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataPop
                        ? (() => { const [y, m, d] = dataPop.split("-"); return `${d}/${m}/${y}`; })()
                        : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dataPop ? new Date(dataPop + "T12:00:00") : undefined}
                      onSelect={(date) => date && setDataPop(format(date, "yyyy-MM-dd"))}
                      locale={ptBR}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Horário de serviço */}
              <div className="space-y-2">
                <Label>Horário de início *</Label>
                <Input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Horário final *</Label>
                <Input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                />
                {viraODia && (
                  <p className="text-xs text-muted-foreground">
                    Vira o dia — o turno termina no dia seguinte.
                  </p>
                )}
              </div>



              {/* Setor */}
              <div className="space-y-2">
                <Label>Setor *</Label>
                <Select value={setor} onValueChange={(v) => { setSetor(v); setFuncao(""); }} disabled={!lojaId || loadingSectors}>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !lojaId ? "Selecione a unidade primeiro"
                        : loadingSectors ? "Carregando..."
                          : sectors.length === 0 ? "Nenhum setor cadastrado"
                            : "Selecione o setor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cargo */}
              <div className="space-y-2 sm:col-span-2">
                <Label>Cargo *</Label>
                <Select value={funcao} onValueChange={setFuncao} disabled={!setor}>
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !setor ? "Selecione o setor primeiro"
                        : jobsForSector.length === 0 ? "Nenhum cargo vinculado"
                          : "Selecione o cargo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {jobsForSector.map((j) => (
                      <SelectItem key={j.id} value={j.name}>{j.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cobrindo quem */}
              <div className="space-y-2">
                <Label>Cobrindo quem? *</Label>
                <Input
                  value={substitui}
                  onChange={(e) => setSubstitui(e.target.value)}
                  placeholder="Nome do colaborador coberto"
                />
              </div>

              {/* Motivo */}
              <div className="space-y-2">
                <Label>Motivo *</Label>
                <Input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Folga, atestado, demanda extra..."
                />
              </div>

              {/* Solicitante */}
              <div className="space-y-2">
                <Label>Solicitante responsável *</Label>
                <Input
                  value={solicitanteNome}
                  onChange={(e) => setSolicitanteNome(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone (opcional)</Label>
                <Input
                  value={solicitanteTelefone}
                  onChange={(e) => setSolicitanteTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    "Enviar solicitação"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
