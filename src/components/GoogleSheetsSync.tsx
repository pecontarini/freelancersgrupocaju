import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileSpreadsheet,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Link2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSincronizacoes, extractSheetsId } from "@/hooks/useSincronizacoes";
import { useConfigLojas } from "@/hooks/useConfigOptions";

export function GoogleSheetsSync() {
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedLojaId, setSelectedLojaId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { sincronizacoes, processSheetsSync, isLoading } = useSincronizacoes();
  const { options: lojas } = useConfigLojas();

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

  // Validate URL
  const isValidUrl = extractSheetsId(sheetsUrl) !== null;

  // Handle sync
  const handleSync = async () => {
    if (!isValidUrl || !selectedMonth) return;

    setIsProcessing(true);
    try {
      await processSheetsSync({
        url: sheetsUrl,
        referencia_mes: selectedMonth,
        loja_id: selectedLojaId || null,
      });
      setSheetsUrl("");
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Sucesso
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processando
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            Pendente
          </Badge>
        );
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <CardTitle className="text-base uppercase">Sincronização Google Sheets</CardTitle>
        </div>
        <CardDescription>
          Importe dados de faturamento e reclamações diretamente de uma planilha pública do Google Sheets.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Import Form */}
        <div className="rounded-xl border p-4 space-y-4 bg-muted/30">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Link da Planilha
            </Label>
            <Input
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              className={sheetsUrl && !isValidUrl ? "border-destructive" : ""}
            />
            {sheetsUrl && !isValidUrl && (
              <p className="text-xs text-destructive">
                URL inválida. Use o link de compartilhamento do Google Sheets.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              A planilha deve estar compartilhada como "Qualquer pessoa com o link pode visualizar".
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Mês de Referência
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Unidade (opcional)</Label>
              <Select value={selectedLojaId} onValueChange={setSelectedLojaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as unidades</SelectItem>
                  {lojas.map((loja) => (
                    <SelectItem key={loja.id} value={loja.id}>
                      {loja.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleSync}
            disabled={!isValidUrl || !selectedMonth || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar Dados
              </>
            )}
          </Button>
        </div>

        {/* Expected Columns Info */}
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium mb-2">Colunas esperadas na planilha:</p>
          <div className="flex flex-wrap gap-1">
            {["unidade", "faturamento_salao", "faturamento_delivery", "reclamacoes_salao", "reclamacoes_ifood"].map((col) => (
              <Badge key={col} variant="secondary" className="text-xs font-mono">
                {col}
              </Badge>
            ))}
          </div>
        </div>

        {/* Sync History */}
        {sincronizacoes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Histórico de Sincronizações</Label>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Atualizar
              </Button>
            </div>
            <div className="rounded-lg border max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Mês Ref.</TableHead>
                    <TableHead className="text-xs text-right">Linhas</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sincronizacoes.slice(0, 10).map((sync) => (
                    <TableRow key={sync.id}>
                      <TableCell className="text-xs">
                        {format(new Date(sync.created_at), "dd/MM HH:mm")}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {format(new Date(sync.referencia_mes + "-01"), "MMM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        {sync.linhas_importadas}
                      </TableCell>
                      <TableCell>{getStatusBadge(sync.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
