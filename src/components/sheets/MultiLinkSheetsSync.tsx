import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Link2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSheetsSources, validateSheetsCsvUrl } from "@/hooks/useSheetsSources";
import { useSincronizacoes } from "@/hooks/useSincronizacoes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function MultiLinkSheetsSync() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { sources, isLoading, createSource, deleteSource, toggleActive } = useSheetsSources();
  const { sincronizacoes } = useSincronizacoes();

  // URL validation state
  const urlValidation = newSourceUrl ? validateSheetsCsvUrl(newSourceUrl) : { valid: true };

  // Generate month options
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 3; i >= -3; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return options;
  };

  // Add new source
  const handleAddSource = async () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      toast.error("Preencha o nome e a URL.");
      return;
    }

    if (!urlValidation.valid) {
      toast.error(urlValidation.error);
      return;
    }

    try {
      await createSource.mutateAsync({
        nome: newSourceName.trim(),
        url: newSourceUrl.trim(),
      });
      setNewSourceName("");
      setNewSourceUrl("");
      setIsAddDialogOpen(false);
    } catch (err) {
      // Error handled by mutation
    }
  };

  // Sync a single source
  const handleSyncSource = async (sourceId: string, sourceUrl: string) => {
    setSyncingSourceId(sourceId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-sheets-staging', {
        body: {
          sourceId,
          url: sourceUrl,
          referenciaMes: selectedMonth,
        },
      });

      if (error) throw error;
      if (data?.success === false) {
        toast.error(data.error || 'Erro ao sincronizar.');
      } else {
        toast.success(`Sincronização concluída! ${data?.rowsImported || 0} linhas importadas.`);
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Erro ao sincronizar. Verifique se a planilha está pública.');
    } finally {
      setSyncingSourceId(null);
    }
  };

  // Sync all active sources
  const handleSyncAll = async () => {
    const activeSources = sources.filter((s) => s.ativo);
    if (activeSources.length === 0) {
      toast.error("Nenhuma fonte ativa para sincronizar.");
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const source of activeSources) {
      try {
        const { error } = await supabase.functions.invoke('sync-sheets-staging', {
          body: {
            sourceId: source.id,
            url: source.url,
            referenciaMes: selectedMonth,
          },
        });

        if (error) throw error;
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsSyncing(false);

    if (errorCount === 0) {
      toast.success(`Todas as ${successCount} fontes sincronizadas com sucesso!`);
    } else {
      toast.warning(`${successCount} sincronizadas, ${errorCount} com erro.`);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <CardTitle className="text-base uppercase">Fontes de Dados (Multi-Link)</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="capitalize">{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAll}
              disabled={isSyncing || sources.filter((s) => s.ativo).length === 0}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Sincronizar Todas</span>
            </Button>
          </div>
        </div>
        <CardDescription>
          Configure até 4 fontes Google Sheets (formato CSV). URLs devem usar /export?format=csv.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sources List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sources.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma fonte configurada.</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Ativo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Última Sync</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id} className={!source.ativo ? "opacity-50" : ""}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleActive.mutate({ id: source.id, ativo: !source.ativo })}
                      >
                        {source.ativo ? (
                          <ToggleRight className="h-5 w-5 text-primary" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{source.nome}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {source.url}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {source.ultima_sincronizacao
                        ? format(new Date(source.ultima_sincronizacao), "dd/MM HH:mm")
                        : "Nunca"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSyncSource(source.id, source.url)}
                          disabled={syncingSourceId === source.id || !source.ativo}
                        >
                          {syncingSourceId === source.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover fonte?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A fonte "{source.nome}" será removida. Dados já importados serão mantidos.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteSource.mutate(source.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Add Source Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full" disabled={sources.length >= 4}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Fonte ({sources.length}/4)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Fonte de Dados</DialogTitle>
              <DialogDescription>
                Adicione uma planilha Google Sheets no formato CSV.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Nome da Fonte</Label>
                <Input
                  placeholder="Ex: Faturamento Janeiro"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  URL (formato CSV)
                </Label>
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=0"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className={newSourceUrl && !urlValidation.valid ? "border-destructive" : ""}
                />
                {newSourceUrl && !urlValidation.valid && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {urlValidation.error}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Use apenas URLs no formato: /export?format=csv&gid=0
                </p>
              </div>
              <Button
                onClick={handleAddSource}
                disabled={!newSourceName.trim() || !urlValidation.valid}
                className="w-full"
              >
                Adicionar Fonte
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Expected Columns Info */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium mb-2">Colunas obrigatórias na planilha:</p>
          <div className="flex flex-wrap gap-1">
            {["unidade", "data_referencia", "faturamento", "nps", "nota_reclamacao", "tipo_operacao"].map((col) => (
              <Badge key={col} variant="secondary" className="text-xs font-mono">
                {col}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
