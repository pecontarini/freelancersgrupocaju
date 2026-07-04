import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { downloadWorkbook } from "@/lib/excelUtils";
import { formatCPF } from "@/lib/formatters";

interface ProfileRow {
  nome_completo: string;
  cpf: string;
  chave_pix: string | null;
  tipo_chave_pix: string | null;
  telefone: string | null;
  inativo: boolean | null;
  created_at: string;
}

export function ExportFreelancerProfilesButton() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchAllRows<ProfileRow>(() =>
        supabase
          .from("freelancer_profiles")
          .select("nome_completo, cpf, chave_pix, tipo_chave_pix, telefone, inativo, created_at")
          .order("nome_completo", { ascending: true }),
      );

      if (rows.length === 0) {
        toast.error("Nenhum freelancer cadastrado para exportar.");
        return;
      }

      const data = rows.map((r) => ({
        Nome: r.nome_completo ?? "",
        CPF: r.cpf ? formatCPF(r.cpf) : "",
        "Tipo Chave PIX": r.tipo_chave_pix ?? "",
        "Chave PIX": r.chave_pix ?? "",
        Telefone: r.telefone ?? "",
        Status: r.inativo ? "Inativo" : "Ativo",
        "Cadastrado em": r.created_at
          ? new Date(r.created_at).toLocaleDateString("pt-BR")
          : "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet["!cols"] = [
        { wch: 40 }, // Nome
        { wch: 16 }, // CPF
        { wch: 14 }, // Tipo PIX
        { wch: 40 }, // Chave PIX
        { wch: 18 }, // Telefone
        { wch: 10 }, // Status
        { wch: 14 }, // Cadastrado em
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Freelancers");

      const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
      downloadWorkbook(workbook, `freelancers_cadastrados_${today}.xlsx`);

      toast.success(`${rows.length} freelancer(s) exportado(s).`);
    } catch (err) {
      console.error("Erro ao exportar freelancers:", err);
      toast.error("Erro ao exportar. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
      Exportar Freelancers (Excel)
    </Button>
  );
}
