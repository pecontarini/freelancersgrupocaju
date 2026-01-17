import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Upload, X, FileText } from "lucide-react";

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

import { useMaintenanceEntries } from "@/hooks/useMaintenanceEntries";
import { useConfigLojas } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useCpfLookup } from "@/hooks/useCpfLookup";
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

export function MaintenanceForm() {
  const { addEntry, isAdding } = useMaintenanceEntries();
  const { options: lojas } = useConfigLojas();
  const { isAdmin, unidades } = useUserProfile();
  const { isLookingUp, lookupSupplierByCpfCnpj } = useCpfLookup();
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [anexoName, setAnexoName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("maintenance-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("maintenance-attachments")
        .getPublicUrl(filePath);

      setAnexoUrl(publicUrl);
      setAnexoName(file.name);
      toast.success("Arquivo enviado com sucesso!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = () => {
    setAnexoUrl(null);
    setAnexoName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const onSubmit = async (data: FormData) => {
    const selectedLoja = availableLojas.find((l) => l.id === data.loja_id);
    if (!selectedLoja) {
      toast.error("Loja não encontrada");
      return;
    }

    const valorNumerico = parseFloat(data.valor.replace(/[^\d,]/g, "").replace(",", "."));

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
                    <FormLabel>CPF/CNPJ do Fornecedor</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        {...field}
                        onChange={(e) => {
                          const formatted = formatCpfCnpj(e.target.value);
                          field.onChange(formatted);
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
                    <FormLabel>Fornecedor {isLookingUp && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do fornecedor" {...field} />
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
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl>
                      <Input placeholder="Chave PIX do fornecedor" {...field} />
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
                    <FormLabel>Data do Serviço</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
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
                          onSelect={field.onChange}
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
                    <FormLabel>Número da Nota Fiscal</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: NF-001234" {...field} />
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
                    <FormLabel>Valor do Serviço (R$)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0,00"
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
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Anexo */}
              <FormItem>
                <FormLabel>Anexo (Boleto/NF)</FormLabel>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  {!anexoUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      {isUploading ? "Enviando..." : "Tirar Foto ou Anexar"}
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border p-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="flex-1 truncate text-sm">{anexoName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={removeAttachment}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </FormItem>
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

            <Button type="submit" className="w-full" disabled={isAdding}>
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
