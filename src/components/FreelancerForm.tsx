import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Loader2, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { formatCPF, formatCurrencyInput, isValidCPF } from "@/lib/formatters";
import { useFreelancerEntries } from "@/hooks/useFreelancerEntries";
import { useConfigLojas, useConfigSetores, useConfigGerencias } from "@/hooks/useConfigOptions";
import { useUserProfile } from "@/hooks/useUserProfile";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  loja: z.string().min(1, "Loja é obrigatória"),
  loja_id: z.string().min(1, "Loja é obrigatória"),
  nome_completo: z.string().min(2, "Nome é obrigatório"),
  setor: z.string().min(1, "Setor é obrigatório"),
  gerencia: z.string().min(1, "Gerência é obrigatória"),
  data_pop: z.date({ required_error: "Data é obrigatória" }),
  valor: z.number().min(0.01, "Valor deve ser maior que zero"),
  cpf: z.string().refine((val) => isValidCPF(val), "CPF inválido"),
  chave_pix: z.string().min(1, "Chave PIX é obrigatória"),
});

type FormData = z.infer<typeof formSchema>;

export function FreelancerForm() {
  const [cpfValue, setCpfValue] = useState("");
  const [valorValue, setValorValue] = useState("");
  const { createEntry } = useFreelancerEntries();
  const { isAdmin, unidade, isGerenteUnidade } = useUserProfile();
  
  // Fetch dynamic options from config tables
  const { options: lojas, isLoading: isLoadingLojas } = useConfigLojas();
  const { options: setores, isLoading: isLoadingSetores } = useConfigSetores();
  const { options: gerencias, isLoading: isLoadingGerencias } = useConfigGerencias();
  
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      loja: "",
      loja_id: "",
      nome_completo: "",
      setor: "",
      gerencia: "",
      cpf: "",
      chave_pix: "",
      valor: 0,
    },
  });

  // Pre-select unidade for gerente_unidade
  useEffect(() => {
    if (isGerenteUnidade && unidade && !isAdmin) {
      form.setValue("loja", unidade.nome);
      form.setValue("loja_id", unidade.id);
    }
  }, [isGerenteUnidade, unidade, isAdmin, form]);

  const onSubmit = async (data: FormData) => {
    await createEntry.mutateAsync({
      loja: data.loja,
      nome_completo: data.nome_completo,
      setor: data.setor,
      gerencia: data.gerencia,
      data_pop: data.data_pop,
      valor: data.valor,
      cpf: data.cpf,
      chave_pix: data.chave_pix,
      loja_id: data.loja_id,
    });
    form.reset();
    setCpfValue("");
    setValorValue("");
    
    // Re-apply unidade for gerente
    if (isGerenteUnidade && unidade && !isAdmin) {
      form.setValue("loja", unidade.nome);
      form.setValue("loja_id", unidade.id);
    }
  };

  const handleLojaChange = (lojaId: string) => {
    const selectedLoja = lojas.find((l) => l.id === lojaId);
    if (selectedLoja) {
      form.setValue("loja", selectedLoja.nome);
      form.setValue("loja_id", selectedLoja.id);
    }
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpfValue(formatted);
    form.setValue("cpf", formatted);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrencyInput(e.target.value);
    setValorValue(formatted);
    const numbers = e.target.value.replace(/\D/g, "");
    const amount = parseInt(numbers, 10) / 100;
    form.setValue("valor", isNaN(amount) ? 0 : amount);
  };

  return (
    <Card className="glass-card fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Plus className="h-5 w-5 text-primary" />
          Novo Lançamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Loja */}
            <div className="space-y-2">
              <Label htmlFor="loja">Loja</Label>
              {isGerenteUnidade && !isAdmin && unidade ? (
                <Input
                  value={unidade.nome}
                  disabled
                  className="input-focus-ring bg-muted"
                />
              ) : (
                <Select 
                  onValueChange={handleLojaChange} 
                  disabled={isLoadingLojas}
                  value={form.watch("loja_id") || undefined}
                >
                  <SelectTrigger className="input-focus-ring">
                    <SelectValue placeholder={isLoadingLojas ? "Carregando..." : "Selecione a loja"} />
                  </SelectTrigger>
                  <SelectContent>
                    {lojas.map((loja) => (
                      <SelectItem key={loja.id} value={loja.id}>
                        {loja.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {form.formState.errors.loja && (
                <p className="text-sm text-destructive">{form.formState.errors.loja.message}</p>
              )}
            </div>

            {/* Nome Completo */}
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="nome_completo">Nome Completo</Label>
              <Input
                id="nome_completo"
                placeholder="Nome do freelancer"
                className="input-focus-ring"
                {...form.register("nome_completo")}
              />
              {form.formState.errors.nome_completo && (
                <p className="text-sm text-destructive">{form.formState.errors.nome_completo.message}</p>
              )}
            </div>

            {/* Setor */}
            <div className="space-y-2">
              <Label htmlFor="setor">Setor</Label>
              <Select onValueChange={(val) => form.setValue("setor", val)} disabled={isLoadingSetores}>
                <SelectTrigger className="input-focus-ring">
                  <SelectValue placeholder={isLoadingSetores ? "Carregando..." : "Selecione o setor"} />
                </SelectTrigger>
                <SelectContent>
                  {setores.map((setor) => (
                    <SelectItem key={setor.id} value={setor.nome}>
                      {setor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.setor && (
                <p className="text-sm text-destructive">{form.formState.errors.setor.message}</p>
              )}
            </div>

            {/* Gerência */}
            <div className="space-y-2">
              <Label htmlFor="gerencia">Gerência</Label>
              <Select onValueChange={(val) => form.setValue("gerencia", val)} disabled={isLoadingGerencias}>
                <SelectTrigger className="input-focus-ring">
                  <SelectValue placeholder={isLoadingGerencias ? "Carregando..." : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {gerencias.map((gerencia) => (
                    <SelectItem key={gerencia.id} value={gerencia.nome}>
                      {gerencia.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.gerencia && (
                <p className="text-sm text-destructive">{form.formState.errors.gerencia.message}</p>
              )}
            </div>

            {/* Data POP */}
            <div className="space-y-2">
              <Label>Data POP</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal input-focus-ring",
                      !form.watch("data_pop") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch("data_pop") ? (
                      format(form.watch("data_pop"), "dd/MM/yyyy", { locale: ptBR })
                    ) : (
                      <span>Selecione a data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch("data_pop")}
                    onSelect={(date) => date && form.setValue("data_pop", date)}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {form.formState.errors.data_pop && (
                <p className="text-sm text-destructive">{form.formState.errors.data_pop.message}</p>
              )}
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label htmlFor="valor">Valor</Label>
              <Input
                id="valor"
                placeholder="R$ 0,00"
                value={valorValue}
                onChange={handleValorChange}
                className="input-focus-ring"
              />
              {form.formState.errors.valor && (
                <p className="text-sm text-destructive">{form.formState.errors.valor.message}</p>
              )}
            </div>

            {/* CPF */}
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={cpfValue}
                onChange={handleCPFChange}
                className="input-focus-ring"
              />
              {form.formState.errors.cpf && (
                <p className="text-sm text-destructive">{form.formState.errors.cpf.message}</p>
              )}
            </div>

            {/* Chave PIX */}
            <div className="space-y-2">
              <Label htmlFor="chave_pix">Chave PIX</Label>
              <Input
                id="chave_pix"
                placeholder="Email, telefone ou CPF"
                className="input-focus-ring"
                {...form.register("chave_pix")}
              />
              {form.formState.errors.chave_pix && (
                <p className="text-sm text-destructive">{form.formState.errors.chave_pix.message}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={createEntry.isPending}
            className="w-full sm:w-auto"
          >
            {createEntry.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Salvar Lançamento
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
