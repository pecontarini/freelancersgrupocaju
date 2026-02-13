import { useState, useRef, useEffect } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Loader2,
  Shirt,
  SprayCanIcon,
  Wrench,
  HelpCircle,
  Upload,
  X,
  Camera,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useOperationalExpenses } from "@/hooks/useOperationalExpenses";
import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useCpfLookup } from "@/hooks/useCpfLookup";
import { useInvoiceExtraction } from "@/hooks/useInvoiceExtraction";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UnifiedExpenseFormProps {
  storeId: string | null;
}

type CategoryType = "uniformes" | "limpeza" | "apoio" | "utensilios" | "manutencao";

const CATEGORIES = [
  { value: "uniformes", label: "Uniformes", icon: Shirt, color: "text-purple-500" },
  { value: "limpeza", label: "Material de Limpeza", icon: SprayCanIcon, color: "text-cyan-500" },
  { value: "utensilios", label: "Utensílios", icon: Wrench, color: "text-rose-500" },
  { value: "apoio", label: "Apoio/Outros", icon: HelpCircle, color: "text-gray-500" },
  { value: "manutencao", label: "Manutenção", icon: Wrench, color: "text-orange-500" },
] as const;

const formatCpfCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
};

export function UnifiedExpenseForm({ storeId }: UnifiedExpenseFormProps) {
  const { addExpense, isAdding: isAddingExpense } = useOperationalExpenses();
  const { addEntry: addMaintenanceEntry, isAdding: isAddingMaintenance } = useMaintenanceEntries();
  const { unidades, isAdmin, isGerenteUnidade } = useUserProfile();
  const { options: lojas } = useConfigLojas();
  const { isLookingUp, lookupSupplierByCpfCnpj } = useCpfLookup();
  const { isExtracting, extractFromFile, clearExtractedData } = useInvoiceExtraction();

  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<CategoryType>("uniformes");
  const [valor, setValor] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [descricao, setDescricao] = useState("");

  // Maintenance-specific fields
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [numeroNf, setNumeroNf] = useState("");
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [anexoName, setAnexoName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showExtractionAlert, setShowExtractionAlert] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine effective store ID
  const effectiveStoreId =
    storeId || (isGerenteUnidade && !isAdmin && unidades.length > 0 ? unidades[0].id : null);
  
  const availableLojas = isAdmin ? lojas : unidades;

  // Auto-lookup supplier when CPF/CNPJ changes
  useEffect(() => {
    const performLookup = async () => {
      if (category !== "manutencao") return;
      const cleanValue = cpfCnpj.replace(/\D/g, "");
      if (cleanValue.length === 11 || cleanValue.length === 14) {
        const result = await lookupSupplierByCpfCnpj(cpfCnpj);
        if (result) {
          setFornecedor(result.fornecedor);
          if (result.chave_pix) {
            setChavePix(result.chave_pix);
          }
        }
      }
    };
    performLookup();
  }, [cpfCnpj, category, lookupSupplierByCpfCnpj]);

  const parseAmount = (value: string): number => {
    const amount = parseFloat(value.replace(/[^\d,.-]/g, "").replace(",", "."));
    return isNaN(amount) || amount <= 0 ? 0 : amount;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setShowExtractionAlert(false);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("maintenance-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("maintenance-attachments").getPublicUrl(filePath);

      setAnexoUrl(publicUrl);
      setAnexoName(file.name);
      toast.success("Arquivo enviado com sucesso!");

      // Extract data from file
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        toast.info("Extraindo dados da NF automaticamente...", { duration: 3000 });

        const extracted = await extractFromFile(file);

        if (extracted) {
          if (extracted.cnpj) {
            setCpfCnpj(formatCpfCnpj(extracted.cnpj));
          }
          if (extracted.fornecedor) {
            setFornecedor(extracted.fornecedor);
          }
          if (extracted.numero_nf) {
            setNumeroNf(extracted.numero_nf);
          }
          if (extracted.data_servico) {
            try {
              const parsedDate = parse(extracted.data_servico, "dd/MM/yyyy", new Date());
              if (!isNaN(parsedDate.getTime())) {
                setDate(parsedDate);
              }
            } catch {
              console.log("Could not parse date:", extracted.data_servico);
            }
          }
          if (extracted.valor) {
            const cleanValue = extracted.valor.replace(/[R$\s]/g, "").trim();
            setValor(cleanValue);
          }
          if (extracted.chave_pix) {
            setChavePix(extracted.chave_pix);
          }

          setShowExtractionAlert(true);

          if (extracted.confidence === "high") {
            toast.success("Dados extraídos com alta confiança!", { duration: 4000 });
          } else if (extracted.confidence === "medium") {
            toast.warning("Dados extraídos. Por favor, confira os campos.", { duration: 4000 });
          } else {
            toast.warning("Extração com baixa confiança. Verifique todos os campos.", { duration: 5000 });
          }
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivo. Verifique sua conexão.");
    } finally {
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 500);
      setIsUploading(false);
    }
  };

  const removeAttachment = () => {
    setAnexoUrl(null);
    setAnexoName(null);
    setShowExtractionAlert(false);
    clearExtractedData();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const resetForm = () => {
    setValor("");
    setDescricao("");
    setDate(new Date());
    setCategory("uniformes");
    setCpfCnpj("");
    setFornecedor("");
    setChavePix("");
    setNumeroNf("");
    removeAttachment();
  };

  const handleSubmit = async () => {
    if (!effectiveStoreId) return;

    const amount = parseAmount(valor);
    if (amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    if (category === "manutencao") {
      // Validate maintenance fields
      if (!fornecedor.trim()) {
        toast.error("Informe o fornecedor");
        return;
      }
      if (!numeroNf.trim()) {
        toast.error("Informe o número da NF");
        return;
      }

      const selectedLoja = availableLojas.find((l) => l.id === effectiveStoreId);
      if (!selectedLoja) {
        toast.error("Loja não encontrada");
        return;
      }

      await addMaintenanceEntry({
        loja: selectedLoja.nome,
        loja_id: effectiveStoreId,
        cpf_cnpj: cpfCnpj || null,
        fornecedor: fornecedor.trim(),
        chave_pix: chavePix || null,
        data_servico: format(date, "yyyy-MM-dd"),
        numero_nf: numeroNf.trim(),
        valor: amount,
        descricao: descricao.trim() || null,
        anexo_url: anexoUrl,
      });
    } else {
      // Simple expense (uniformes, limpeza, apoio)
      const operationalCategory = category as "uniformes" | "limpeza" | "apoio" | "utensilios";
      await addExpense({
        store_id: effectiveStoreId,
        category: operationalCategory,
        valor: amount,
        data_despesa: format(date, "yyyy-MM-dd"),
        descricao: descricao.trim() || undefined,
      });
    }

    setIsOpen(false);
    resetForm();
  };

  if (!effectiveStoreId) {
    return null;
  }

  const isLoading = isAddingExpense || isAddingMaintenance;
  const isMaintenance = category === "manutencao";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Lançar Despesa Operacional
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase">Registrar Despesa</DialogTitle>
          <DialogDescription>
            Lançamento de despesas operacionais ou manutenção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CategoryType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <cat.icon className={cn("h-4 w-4", cat.color)} />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Extraction Alert for Maintenance */}
          {isMaintenance && showExtractionAlert && (
            <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/20">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <span className="font-medium">Dados extraídos automaticamente da NF.</span>
                <br />
                <span className="text-sm">Por favor, confira antes de salvar.</span>
              </AlertDescription>
            </Alert>
          )}

          {/* Attachment for Maintenance */}
          {isMaintenance && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Anexo (Foto/PDF da NF)
                {isExtracting && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 animate-pulse text-primary" />
                    Extraindo...
                  </span>
                )}
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              {!anexoUrl ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed border-2 min-h-[56px] h-auto py-4"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isExtracting}
                  >
                    <div className="flex items-center justify-center gap-3 w-full">
                      {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : isExtracting ? (
                        <Sparkles className="h-5 w-5 animate-pulse text-primary" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <Camera className="h-5 w-5 text-primary" />
                          <span className="text-muted-foreground">/</span>
                          <Upload className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <span className="text-sm">
                        {isUploading
                          ? "Enviando..."
                          : isExtracting
                          ? "Extraindo dados..."
                          : "Câmera ou Galeria"}
                      </span>
                    </div>
                  </Button>
                  {isUploading && uploadProgress > 0 && (
                    <Progress value={uploadProgress} className="h-2" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border p-3 bg-green-50 dark:bg-green-950/20 border-green-200">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-green-800 dark:text-green-200">
                      Arquivo anexado
                    </p>
                    <p className="text-xs text-green-600 truncate">{anexoName}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={removeAttachment}
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* CPF/CNPJ for Maintenance */}
          {isMaintenance && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                CPF/CNPJ do Fornecedor
                {isLookingUp && <Loader2 className="h-3 w-3 animate-spin" />}
              </Label>
              <Input
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                maxLength={18}
              />
            </div>
          )}

          {/* Supplier for Maintenance */}
          {isMaintenance && (
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <Input
                placeholder="Nome do fornecedor"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
              />
            </div>
          )}

          {/* NF Number for Maintenance */}
          {isMaintenance && (
            <div className="space-y-2">
              <Label>Número da NF *</Label>
              <Input
                placeholder="Ex: 12345"
                value={numeroNf}
                onChange={(e) => setNumeroNf(e.target.value)}
              />
            </div>
          )}

          {/* PIX Key for Maintenance */}
          {isMaintenance && (
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input
                placeholder="CPF, CNPJ, Email ou Telefone"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
              />
            </div>
          )}

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="valor">Valor (R$) *</Label>
            <Input
              id="valor"
              type="text"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição (opcional)</Label>
            <Textarea
              id="descricao"
              placeholder="Detalhes da despesa..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={parseAmount(valor) <= 0 || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
