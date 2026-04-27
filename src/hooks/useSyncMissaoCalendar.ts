import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startGoogleOAuth } from "@/services/googleCalendar";
import { useAuth } from "@/contexts/AuthContext";

interface SyncResult {
  ok?: boolean;
  event_id?: string;
  synced_at?: string;
  html_link?: string | null;
  status?: "needs_connect";
  user_id?: string;
  is_self?: boolean;
  nome?: string;
  removed?: boolean;
}

/**
 * Sincroniza uma missão com o Google Agenda do líder responsável.
 * - Cria ou atualiza um evento all-day no dia do prazo.
 * - Se o líder responsável ainda não conectou o Google: oferece o fluxo OAuth
 *   (caso o próprio líder esteja logado) ou avisa que ele precisa conectar.
 */
export function useSyncMissaoCalendar() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { missao_id: string; remove?: boolean }) => {
      const { data, error } = await supabase.functions.invoke<SyncResult>(
        "sync-missao-to-calendar",
        { body: input },
      );
      if (error) throw error;
      return data ?? {};
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ["missoes"] });
      qc.invalidateQueries({ queryKey: ["missao-detalhe", vars.missao_id] });

      if (data?.status === "needs_connect") {
        if (data.is_self) {
          toast.info("Conecte sua conta Google para sincronizar a missão.", {
            action: {
              label: "Conectar",
              onClick: () => {
                startGoogleOAuth("/?tab=agenda-lider").catch((e) => {
                  toast.error(e?.message ?? "Falha ao iniciar conexão Google.");
                });
              },
            },
          });
        } else {
          toast.warning(
            `${data.nome ?? "O líder responsável"} ainda não conectou o Google Agenda. Peça pra ele entrar no portal e conectar a conta.`,
          );
        }
        return;
      }
      if (vars.remove && data?.removed) {
        toast.success("Evento removido do Google Agenda.");
        return;
      }
      if (vars.remove && data?.removed === false) {
        toast.info("Missão não estava sincronizada.");
        return;
      }
      toast.success("Missão sincronizada com o Google Agenda.", {
        action: data?.html_link
          ? { label: "Abrir", onClick: () => window.open(data.html_link!, "_blank") }
          : undefined,
      });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Falha ao sincronizar com Google Agenda.");
    },
  });
}
