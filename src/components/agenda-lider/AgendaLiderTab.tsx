import { useMemo, useState } from "react";
import { Calendar, KanbanSquare, MessagesSquare, ShieldCheck, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { MissoesChatView } from "./chat/MissoesChatView";
import { MissoesBoardView } from "./board/MissoesBoardView";
import { MeuPainelView } from "./meu-painel/MeuPainelView";
import { DiretoriaView } from "./diretoria/DiretoriaView";

export function AgendaLiderTab() {
  const { effectiveUnidadeId } = useUnidade();
  const { isAdmin, isOperator } = useUserProfile();
  const podeVerDiretoria = isAdmin || isOperator;
  const [tab, setTab] = useState("chat");

  const { data: unidadeNome } = useQuery({
    queryKey: ["loja-nome", effectiveUnidadeId],
    queryFn: async () => {
      if (!effectiveUnidadeId) return null;
      const { data } = await supabase
        .from("config_lojas")
        .select("nome")
        .eq("id", effectiveUnidadeId)
        .maybeSingle();
      return (data?.nome as string) ?? null;
    },
    enabled: !!effectiveUnidadeId,
  });

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold">Agenda do Líder</h2>
            <p className="text-sm text-muted-foreground">
              Sistema nervoso da liderança: descreva → IA estrutura → equipe executa → todos
              acompanham em tempo real.
            </p>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="chat" className="gap-1.5">
            <MessagesSquare className="h-4 w-4" />
            Chat IA
          </TabsTrigger>
          <TabsTrigger value="board" className="gap-1.5">
            <KanbanSquare className="h-4 w-4" />
            Board
          </TabsTrigger>
          <TabsTrigger value="meu-painel" className="gap-1.5">
            <User className="h-4 w-4" />
            Meu Painel
          </TabsTrigger>
          {podeVerDiretoria && (
            <TabsTrigger value="diretoria" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Diretoria
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="chat">
          <MissoesChatView unidadeNome={unidadeNome ?? null} />
        </TabsContent>
        <TabsContent value="board">
          <MissoesBoardView />
        </TabsContent>
        <TabsContent value="meu-painel">
          <MeuPainelView />
        </TabsContent>
        {podeVerDiretoria && (
          <TabsContent value="diretoria">
            <DiretoriaView />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
