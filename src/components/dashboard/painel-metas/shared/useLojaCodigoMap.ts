import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lojaCodigoFromNome } from "./lojaMapping";

export interface LojaCodigoMap {
  /** loja_codigo (ex.: "NZ_AS") → loja_id UUID */
  codigoToId: Record<string, string>;
  /** loja_id UUID → loja_codigo */
  idToCodigo: Record<string, string>;
}

/** Mapeia config_lojas (UUID) ↔ loja_codigo usado em metas_snapshot. */
export function useLojaCodigoMap() {
  return useQuery<LojaCodigoMap>({
    queryKey: ["loja-codigo-map"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("config_lojas").select("id, nome");
      if (error) throw error;
      const codigoToId: Record<string, string> = {};
      const idToCodigo: Record<string, string> = {};
      (data ?? []).forEach((r: any) => {
        const cod = lojaCodigoFromNome(r.nome);
        if (cod) {
          codigoToId[cod] = r.id;
          idToCodigo[r.id] = cod;
        }
      });
      return { codigoToId, idToCodigo };
    },
  });
}
