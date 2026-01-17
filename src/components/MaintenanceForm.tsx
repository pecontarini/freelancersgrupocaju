import { useState, useRef } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const formSchema = z.object({
  loja_id: z.string().min(1, "Selecione a loja"),
  fornecedor: z.string().min(1, "Fornecedor é obrigatório").max(200),
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
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [anexoName, setAnexoName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableLojas = isAdmin ? lojas : unidades;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loja_id: availableLojas.length === 1 ? availableLojas[0].id : "",
      fornecedor: "",
      numero_nf: "",
      valor: "",
      descricao: "",
    },
  });

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
      fornecedor: data.fornecedor,
      data_servico: format(data.data_servico, "yyyy-MM-dd"),
      numero_nf: data.numero_nf,
      valor: valorNumerico,
      descricao: data.descricao || "",
      anexo_url: anexoUrl,
    });

    form.reset({
      loja_id: availableLojas.length === 1 ? availableLojas[0].id : "",
      fornecedor: "",
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

              {/* Fornecedor */}
              <FormField
                control={form.control}
                name="fornecedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fornecedor</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do fornecedor" {...field} />
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
