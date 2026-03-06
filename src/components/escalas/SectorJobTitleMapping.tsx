import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Loader2, Check, ChevronsUpDown, AlertTriangle, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useSectors } from "@/hooks/useStaffingMatrix";
import { useJobTitles } from "@/hooks/useJobTitles";
import {
  useSectorJobTitles,
  useSetSectorJobTitles,
} from "@/hooks/useSectorJobTitles";

export function SectorJobTitleMapping() {
  const lojas = useConfigLojas();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const { data: sectors = [], isLoading: loadingSectors } = useSectors(selectedUnit);
  const { data: jobTitles = [], isLoading: loadingJT } = useJobTitles(selectedUnit);
  const sectorIds = useMemo(() => sectors.map((s) => s.id), [sectors]);
  const { data: mappings = [], isLoading: loadingMap } = useSectorJobTitles(sectorIds);
  const setSectorJT = useSetSectorJobTitles();

  const isLoading = loadingSectors || loadingJT || loadingMap;

  // Group mappings by sector
  const bySector = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const m of mappings) {
      if (!map[m.sector_id]) map[m.sector_id] = [];
      map[m.sector_id].push(m.job_title_id);
    }
    return map;
  }, [mappings]);

  // Find orphan job titles (not linked to any sector)
  const linkedJTIds = useMemo(() => new Set(mappings.map((m) => m.job_title_id)), [mappings]);
  const orphanJTs = useMemo(
    () => jobTitles.filter((jt) => !linkedJTIds.has(jt.id)),
    [jobTitles, linkedJTIds]
  );

  function handleToggle(sectorId: string, jtId: string) {
    const current = bySector[sectorId] || [];
    const next = current.includes(jtId)
      ? current.filter((id) => id !== jtId)
      : [...current, jtId];
    setSectorJT.mutate({ sectorId, jobTitleIds: next });
  }

  if (!selectedUnit) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Cargos por Setor</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Defina quais cargos podem atuar em cada setor da operação.
          </p>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selecione a Unidade</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value="" onValueChange={(v) => setSelectedUnit(v)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Escolha a unidade" />
              </SelectTrigger>
              <SelectContent>
                {lojas.options.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sectors.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Briefcase className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p>Nenhum setor cadastrado nesta unidade.</p>
        <p className="text-xs mt-1">Adicione setores na aba "Configurações (Matriz)" primeiro.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Cargos por Setor</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Defina quais cargos podem atuar em cada setor da operação.
          </p>
        </div>
        <Select value={selectedUnit} onValueChange={(v) => setSelectedUnit(v)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Trocar unidade" />
          </SelectTrigger>
          <SelectContent>
            {lojas.options.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sectors.map((sector) => {
          const sectorJTIds = bySector[sector.id] || [];
          const sectorJTs = jobTitles.filter((jt) => sectorJTIds.includes(jt.id));

          return (
            <SectorCard
              key={sector.id}
              sectorName={sector.name}
              selectedJTs={sectorJTs.map((jt) => ({ id: jt.id, name: jt.name }))}
              allJTs={jobTitles.map((jt) => ({ id: jt.id, name: jt.name }))}
              onToggle={(jtId) => handleToggle(sector.id, jtId)}
              saving={setSectorJT.isPending}
            />
          );
        })}
      </div>

      {/* Orphan job titles */}
      {orphanJTs.length > 0 && (
        <Card className="border-yellow-400/50 bg-yellow-400/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-4 w-4" />
              Cargos Órfãos ({orphanJTs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Estes cargos foram importados mas ainda não estão vinculados a nenhum setor.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {orphanJTs.map((jt) => (
                <Badge key={jt.id} variant="outline" className="border-yellow-400/50 text-yellow-700 dark:text-yellow-300">
                  {jt.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectorCard({
  sectorName,
  selectedJTs,
  allJTs,
  onToggle,
  saving,
}: {
  sectorName: string;
  selectedJTs: { id: string; name: string }[];
  allJTs: { id: string; name: string }[];
  onToggle: (jtId: string) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(selectedJTs.map((jt) => jt.id));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{sectorName}</span>
          <Badge variant="secondary" className="text-xs font-normal">
            {selectedJTs.length} cargo(s)
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Selected tags */}
        {selectedJTs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selectedJTs.map((jt) => (
              <Badge
                key={jt.id}
                variant="default"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => onToggle(jt.id)}
              >
                {jt.name} ×
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Nenhum cargo vinculado.</p>
        )}

        {/* Multi-select combobox */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between text-xs"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Adicionar cargo..."
              )}
              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar cargo..." className="h-9" />
              <CommandList>
                <CommandEmpty>Nenhum cargo encontrado.</CommandEmpty>
                <CommandGroup>
                  {allJTs.map((jt) => (
                    <CommandItem
                      key={jt.id}
                      value={jt.name}
                      onSelect={() => onToggle(jt.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedIds.has(jt.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {jt.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
