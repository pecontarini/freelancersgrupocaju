import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parse } from "date-fns";
import { CalendarIcon, Loader2, Upload, X, FileText, Sparkles, AlertTriangle, CheckCircle2, Camera } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useCpfLookup } from "@/hooks/useCpfLookup";
import { useInvoiceExtraction } from "@/hooks/useInvoiceExtraction";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const formatCpfCnpj = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    // CPF format: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    // CNPJ format: 00.000.000/0000-00
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
};

const formSchema = z.object({
  loja_id: z.string().min(1, "Selecione a loja"),
  cpf_cnpj: z.string().optional(),
  fornecedor: z.string().min(1, "Fornecedor é obrigatório").max(200),
  chave_pix: z.string().optional(),
  data_servico: z.date({ required_error: "Data do serviço é obrigatória" }),
  numero_nf: z.string().min(1, "Número da NF é obrigatório").max(50),
  valor: z.string().min(1, "Valor é obrigatório"),
  descricao: z.string().max(1000).optional(),
});

type FormData = z.infer<typeof formSchema>;

// Track which fields were auto-extracted
type ExtractedFields = {
  cpf_cnpj?: boolean;
  fornecedor?: boolean;
  numero_nf?: boolean;
  data_servico?: boolean;
  valor?: boolean;
  chave_pix?: boolean;
};

export function MaintenanceForm() {
  const { addEntry, isAdding } = useMaintenanceEntries();
  const { options: lojas } = useConfigLojas();
  const { isAdmin, isOperator, unidades } = useUserProfile();
  const { isLookingUp, lookupSupplierByCpfCnpj } = useCpfLookup();
  const { isExtracting, extractFromFile, clearExtractedData } = useInvoiceExtraction();
  
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [anexoName, setAnexoName] = useState<string | null>(null);
  const [boletoUrl, setBoletoUrl] = useState<string | null>(null);
  const [boletoName, setBoletoName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingBoleto, setIsUploadingBoleto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressBoleto, setUploadProgressBoleto] = useState(0);
  const [extractedFields, setExtractedFields] = useState<ExtractedFields>({});
  const [showExtractionAlert, setShowExtractionAlert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const boletoInputRef = useRef<HTMLInputElement>(null);

  const availableLojas = isAdmin ? lojas : unidades;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loja_id: availableLojas.length === 1 ? availableLojas[0].id : "",
      cpf_cnpj: "",
      fornecedor: "",
      chave_pix: "",
      numero_nf: "",
      valor: "",
      descricao: "",
    },
  });

  const cpfCnpjValue = form.watch("cpf_cnpj");

  useEffect(() => {
    const performLookup = async () => {
      const cleanValue = cpfCnpjValue?.replace(/\D/g, "") || "";
      // Only lookup if we have 11 digits (CPF) or 14 digits (CNPJ)
      if (cleanValue.length === 11 || cleanValue.length === 14) {
        const result = await lookupSupplierByCpfCnpj(cpfCnpjValue || "");
        if (result) {
          form.setValue("fornecedor", result.fornecedor);
          if (result.chave_pix) {
            form.setValue("chave_pix", result.chave_pix);
          }
        }
      }
    };
    performLookup();
  }, [cpfCnpjValue, lookupSupplierByCpfCnpj, form]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setExtractedFields({});
    setShowExtractionAlert(false);
    
    // Simulate progress for better UX on mobile
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
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
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        if (uploadError.message?.includes("security") || uploadError.message?.includes("policy")) {
          throw new Error("Permissão negada. Faça login novamente e tente outra vez.");
        }
        throw new Error(uploadError.message || "Erro ao enviar arquivo.");
      }

      const { data: { publicUrl } } = supabase.storage
        .from("maintenance-attachments")
        .getPublicUrl(filePath);

      setAnexoUrl(publicUrl);
      setAnexoName(file.name);
      toast.success("Arquivo enviado com sucesso!");

      // Now extract data from the file if it's an image or PDF
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        toast.info("Extraindo dados da NF automaticamente...", { duration: 3000 });
        
        const extracted = await extractFromFile(file);
        
        if (extracted) {
          const newExtractedFields: ExtractedFields = {};
          
          // Apply extracted data to form fields
          if (extracted.cnpj) {
            const formatted = formatCpfCnpj(extracted.cnpj);
            form.setValue("cpf_cnpj", formatted);
            newExtractedFields.cpf_cnpj = true;
          }
          
          if (extracted.fornecedor) {
            form.setValue("fornecedor", extracted.fornecedor);
            newExtractedFields.fornecedor = true;
          }
          
          if (extracted.numero_nf) {
            form.setValue("numero_nf", extracted.numero_nf);
            newExtractedFields.numero_nf = true;
          }
          
          if (extracted.data_servico) {
            try {
              // Try parsing DD/MM/YYYY format
              const parsedDate = parse(extracted.data_servico, "dd/MM/yyyy", new Date());
              if (!isNaN(parsedDate.getTime())) {
                form.setValue("data_servico", parsedDate);
                newExtractedFields.data_servico = true;
              }
            } catch {
              console.log("Could not parse date:", extracted.data_servico);
            }
          }
          
          if (extracted.valor) {
            // Format value for the input (remove R$ and extra spaces)
            const cleanValue = extracted.valor.replace(/[R$\s]/g, "").trim();
            form.setValue("valor", cleanValue);
            newExtractedFields.valor = true;
          }
          
          if (extracted.chave_pix) {
            form.setValue("chave_pix", extracted.chave_pix);
            newExtractedFields.chave_pix = true;
          }
          
          setExtractedFields(newExtractedFields);
          setShowExtractionAlert(true);
          
          const confidence = extracted.confidence;
          if (confidence === "high") {
            toast.success("Dados extraídos com alta confiança!", { duration: 4000 });
          } else if (confidence === "medium") {
            toast.warning("Dados extraídos. Por favor, confira os campos.", { duration: 4000 });
          } else {
            toast.warning("Extração com baixa confiança. Verifique todos os campos.", { duration: 5000 });
          }
        }
      }
    } catch (error) {
      console.error("Upload error:", error);
      const msg = error instanceof Error ? error.message : "Erro ao enviar arquivo. Verifique sua conexão.";
      toast.error(msg);
    } finally {
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 500);
      setIsUploading(false);
    }
  };

  const removeAttachment = () => {
    setAnexoUrl(null);
    setAnexoName(null);
    setExtractedFields({});
    setShowExtractionAlert(false);
    clearExtractedData();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBoletoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setIsUploadingBoleto(true);
    setUploadProgressBoleto(0);

    const progressInterval = setInterval(() => {
      setUploadProgressBoleto((prev) => {
        if (prev >= 90) { clearInterval(progressInterval); return 90; }
        return prev + 10;
      });
    }, 200);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `boletos/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("maintenance-attachments")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        if (uploadError.message?.includes("security") || uploadError.message?.includes("policy")) {
          throw new Error("Permissão negada. Faça login novamente e tente outra vez.");
        }
        throw new Error(uploadError.message || "Erro ao enviar boleto.");
      }

      const { data: { publicUrl } } = supabase.storage
        .from("maintenance-attachments")
        .getPublicUrl(fileName);

      setBoletoUrl(publicUrl);
      setBoletoName(file.name);
      toast.success("Boleto enviado com sucesso!");
    } catch (error) {
      console.error("Boleto upload error:", error);
      const msg = error instanceof Error ? error.message : "Erro ao enviar boleto.";
      toast.error(msg);
    } finally {
      setUploadProgressBoleto(100);
      setTimeout(() => setUploadProgressBoleto(0), 500);
      setIsUploadingBoleto(false);
    }
  };

  const removeBoleto = () => {
    setBoletoUrl(null);
    setBoletoName(null);
    if (boletoInputRef.current) {
      boletoInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: FormData) => {
    const selectedLoja = availableLojas.find((l) => l.id === data.loja_id);
    if (!selectedLoja) {
      toast.error("Loja não encontrada");
      return;
    }

    // Parse Brazilian currency format: "1.440,00" -> 1440.00
    // First remove all dots (thousand separators), then replace comma with dot (decimal separator)
    const valorNumerico = parseFloat(
      data.valor
        .replace(/\./g, "")  // Remove thousand separators (dots)
        .replace(",", ".")   // Replace decimal comma with dot
        .replace(/[^\d.]/g, "") // Remove any remaining non-numeric chars except dot
    );

    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.error("Valor inválido. Digite um valor maior que zero.");
      return;
    }

    await addEntry({
      loja: selectedLoja.nome,
      loja_id: data.loja_id,
      cpf_cnpj: data.cpf_cnpj || null,
      fornecedor: data.fornecedor,
      chave_pix: data.chave_pix || null,
      data_servico: format(data.data_servico, "yyyy-MM-dd"),
      numero_nf: data.numero_nf,
      valor: valorNumerico,
      descricao: data.descricao || "",
      anexo_url: anexoUrl,
      boleto_url: boletoUrl,
    });

    form.reset({
      loja_id: availableLojas.length === 1 ? availableLojas[0].id : "",
      cpf_cnpj: "",
      fornecedor: "",
      chave_pix: "",
      numero_nf: "",
      valor: "",
      descricao: "",
    });
    removeAttachment();
    removeBoleto();
  };

  // Helper to get field styling based on extraction status
  const getFieldClassName = (fieldName: keyof ExtractedFields) => {
    if (extractedFields[fieldName]) {
      return "ring-2 ring-amber-400 ring-offset-1 bg-amber-50 dark:bg-amber-950/20";
    }
    return "";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Cadastrar Manutenção
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Extraction Alert */}
            {showExtractionAlert && (
              <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/20">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Dados extraídos automaticamente da NF.</span>
                  <br />
                  <span className="text-sm">Campos destacados em amarelo foram preenchidos pela IA. Por favor, confira antes de salvar.</span>
                </AlertDescription>
              </Alert>
            )}

            {/* Attachments side by side */}
            <div className="grid gap-4 sm:grid-cols-2">
            {/* NF Attachment */}
            <FormItem className="rounded-lg border-2 border-blue-200 dark:border-blue-800 p-3">
              <FormLabel className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <FileText className="h-4 w-4" />
                Nota Fiscal (NF)
                {isExtracting && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 animate-pulse text-primary" />
                    Extraindo dados...
                  </span>
                )}
              </FormLabel>
              <div className="space-y-3">
                {/* Hidden file input - no capture attribute to allow user choice */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,.pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                
                {!anexoUrl ? (
                  <div className="space-y-3">
                    {/* Upload Button - Mobile optimized with min touch target */}
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-2 min-h-[56px] h-auto py-4 hover:bg-primary/5 active:scale-[0.98] transition-all touch-manipulation"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || isExtracting}
                    >
                      <div className="flex items-center justify-center gap-3 w-full">
                        {isUploading ? (
                          <Loader2 className="h-6 w-6 animate-spin text-primary flex-shrink-0" />
                        ) : isExtracting ? (
                          <Sparkles className="h-6 w-6 animate-pulse text-primary flex-shrink-0" />
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Camera className="h-5 w-5 text-primary" />
                            <span className="text-muted-foreground">/</span>
                            <Upload className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex flex-col items-start text-left">
                          <span className="font-medium text-sm sm:text-base">
                            {isUploading 
                              ? "Enviando arquivo..." 
                              : isExtracting 
                                ? "Extraindo dados..." 
                                : "Câmera ou Galeria/Arquivos"
                            }
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {isUploading 
                              ? "Aguarde o envio" 
                              : "A IA irá preencher os campos automaticamente"
                            }
                          </span>
                        </div>
                      </div>
                    </Button>
                    
                    {/* Upload Progress Bar */}
                    {isUploading && uploadProgress > 0 && (
                      <div className="space-y-1">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-center">
                          {uploadProgress < 100 ? `${uploadProgress}% enviado` : "Concluído!"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-green-800 dark:text-green-200">
                        Arquivo anexado com sucesso
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 truncate">
                        {anexoName}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 flex-shrink-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                      onClick={removeAttachment}
                    >
                      <X className="h-5 w-5 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            </FormItem>

            {/* Boleto Attachment */}
            <FormItem className="rounded-lg border-2 border-purple-200 dark:border-purple-800 p-3">
              <FormLabel className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Upload className="h-4 w-4" />
                Boleto
              </FormLabel>
              <div className="space-y-3">
                <input
                  ref={boletoInputRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf"
                  onChange={handleBoletoUpload}
                  className="hidden"
                />
                {!boletoUrl ? (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-2 min-h-[48px] h-auto py-3 hover:bg-primary/5 active:scale-[0.98] transition-all touch-manipulation"
                      onClick={() => boletoInputRef.current?.click()}
                      disabled={isUploadingBoleto}
                    >
                      <div className="flex items-center justify-center gap-3 w-full">
                        {isUploadingBoleto ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                        ) : (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Camera className="h-4 w-4 text-primary" />
                            <span className="text-muted-foreground">/</span>
                            <Upload className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <span className="font-medium text-sm">
                          {isUploadingBoleto ? "Enviando boleto..." : "Anexar Boleto"}
                        </span>
                      </div>
                    </Button>
                    {isUploadingBoleto && uploadProgressBoleto > 0 && (
                      <Progress value={uploadProgressBoleto} className="h-2" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border p-3 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-green-800 dark:text-green-200">
                        Boleto anexado
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 truncate">
                        {boletoName}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 flex-shrink-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                      onClick={removeBoleto}
                    >
                      <X className="h-5 w-5 text-red-500" />
                    </Button>
                  </div>
                )}
              </div>
            </FormItem>
            </div>{/* end attachments grid */}

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Loja */}
              <FormField
                control={form.control}
                name="loja_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loja</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={availableLojas.length === 1}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a loja" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableLojas.map((loja) => (
                          <SelectItem key={loja.id} value={loja.id}>
                            {loja.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CPF/CNPJ */}
              <FormField
                control={form.control}
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      CPF/CNPJ do Fornecedor
                      {extractedFields.cpf_cnpj && <Sparkles className="h-3 w-3 text-amber-500" />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        className={getFieldClassName("cpf_cnpj")}
                        {...field}
                        onChange={(e) => {
                          const formatted = formatCpfCnpj(e.target.value);
                          field.onChange(formatted);
                          // Clear extraction highlight on manual edit
                          if (extractedFields.cpf_cnpj) {
                            setExtractedFields(prev => ({ ...prev, cpf_cnpj: false }));
                          }
                        }}
                        maxLength={18}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fornecedor */}
              <FormField
                control={form.control}
                name="fornecedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Fornecedor
                      {isLookingUp && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                      {extractedFields.fornecedor && <Sparkles className="h-3 w-3 text-amber-500" />}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nome do fornecedor" 
                        className={getFieldClassName("fornecedor")}
                        {...field} 
                        onChange={(e) => {
                          field.onChange(e);
                          if (extractedFields.fornecedor) {
                            setExtractedFields(prev => ({ ...prev, fornecedor: false }));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Chave PIX */}
              <FormField
                control={form.control}
                name="chave_pix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Chave PIX
                      {extractedFields.chave_pix && <Sparkles className="h-3 w-3 text-amber-500" />}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Chave PIX do fornecedor" 
                        className={getFieldClassName("chave_pix")}
                        {...field} 
                        onChange={(e) => {
                          field.onChange(e);
                          if (extractedFields.chave_pix) {
                            setExtractedFields(prev => ({ ...prev, chave_pix: false }));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Data do Serviço */}
              <FormField
                control={form.control}
                name="data_servico"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Data do Serviço
                      {extractedFields.data_servico && <Sparkles className="h-3 w-3 text-amber-500" />}
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground",
                              getFieldClassName("data_servico")
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy")
                            ) : (
                              <span>Selecione a data</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            if (extractedFields.data_servico) {
                              setExtractedFields(prev => ({ ...prev, data_servico: false }));
                            }
                          }}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Número NF */}
              <FormField
                control={form.control}
                name="numero_nf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Número da Nota Fiscal
                      {extractedFields.numero_nf && <Sparkles className="h-3 w-3 text-amber-500" />}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ex: NF-001234" 
                        className={getFieldClassName("numero_nf")}
                        {...field} 
                        onChange={(e) => {
                          field.onChange(e);
                          if (extractedFields.numero_nf) {
                            setExtractedFields(prev => ({ ...prev, numero_nf: false }));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Valor */}
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      Valor do Serviço (R$)
                      {extractedFields.valor && <Sparkles className="h-3 w-3 text-amber-500" />}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0,00"
                        className={getFieldClassName("valor")}
                        {...field}
                        onChange={(e) => {
                          let value = e.target.value.replace(/[^\d]/g, "");
                          if (value) {
                            const numericValue = parseInt(value, 10) / 100;
                            value = numericValue.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            });
                          }
                          field.onChange(value);
                          if (extractedFields.valor) {
                            setExtractedFields(prev => ({ ...prev, valor: false }));
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Descrição */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição do Serviço</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o serviço realizado..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isAdding || isExtracting}>
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Cadastrar Manutenção"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
