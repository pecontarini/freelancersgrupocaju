import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useHoldingStaffingConfig,
  useUpsertHoldingStaffing,
  useEffectiveHeadcountBySector,
} from "@/hooks/useHoldingConfig";
import { sectorsForBrand, type Brand, type SectorKey } from "@/lib/holding/sectors";

export type WizardMode = "wizard" | "validate" | "adjust";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProposedChange {
  sector_key: string;
  day_of_week: number;
  shift_type: "almoco" | "jantar";
  required_count: number;
  extras_count: number;
  reason?: string;
}

export interface ProposedPayload {
  summary: string;
  changes: ProposedChange[];
}

interface UsePOPWizardArgs {
  brand: Brand;
  unitId: string;
  unitName?: string;
  monthYear: string;
}

export function usePOPWizard({ brand, unitId, unitName, monthYear }: UsePOPWizardArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [proposed, setProposed] = useState<ProposedPayload | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [sessionMode, setSessionMode] = useState<WizardMode | null>(null);

  const { data: currentConfig = [] } = useHoldingStaffingConfig(unitId, monthYear);
  const { data: headcount } = useEffectiveHeadcountBySector(unitId);
  const upsert = useUpsertHoldingStaffing();

  const reset = useCallback(() => {
    setMessages([]);
    setProposed(null);
    setIsStreaming(false);
    setSessionMode(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string, mode: WizardMode = "adjust") => {
      // Primeira mensagem define o modo da sessão; mensagens seguintes herdam.
      const effectiveMode: WizardMode =
        sessionMode ?? (messages.length === 0 ? mode : "adjust");
      if (!sessionMode) setSessionMode(effectiveMode);
      const userMsg: ChatMessage = { role: "user", content: text };
      const nextMessages = [...messages, userMsg];
      setMessages(nextMessages);
      setIsStreaming(true);

      const availableSectors = sectorsForBrand(brand) as SectorKey[];
      const effectiveHeadcount: Record<string, number> = headcount ?? ({} as any);

      const payload = {
        messages: nextMessages,
        mode,
        context: {
          brand,
          unitId,
          unitName,
          monthYear,
          currentConfig: (currentConfig ?? []).map((r) => ({
            sector_key: r.sector_key,
            shift_type: r.shift_type,
            day_of_week: r.day_of_week,
            required_count: r.required_count,
            extras_count: r.extras_count,
          })),
          effectiveHeadcount,
          availableSectors,
        },
      };

      let assistantSoFar = "";
      const upsertAssistant = (delta: string) => {
        assistantSoFar += delta;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
            );
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      const toolArgsBuf: Record<number, string> = {};
      const toolNames: Record<number, string> = {};

      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pop-wizard-chat`;
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          let msg = "Não consegui processar sua solicitação. Tente novamente.";
          try {
            const j = await resp.json();
            if (j?.error) msg = j.error;
          } catch {/* ignore */}
          if (resp.status === 429) toast.error(msg);
          else if (resp.status === 402) toast.error(msg);
          else toast.error(msg);
          upsertAssistant(`\n\n_${msg}_`);
          return;
        }

        if (!resp.body) {
          throw new Error("Sem corpo de resposta");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;

        while (!done) {
          const { value, done: d } = await reader.read();
          if (d) break;
          buffer += decoder.decode(value, { stream: true });

          let nlIdx: number;
          while ((nlIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nlIdx);
            buffer = buffer.slice(nlIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line || line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) upsertAssistant(delta.content);
              const tcs = delta?.tool_calls;
              if (Array.isArray(tcs)) {
                for (const tc of tcs) {
                  const idx = tc.index ?? 0;
                  if (tc.function?.name) toolNames[idx] = tc.function.name;
                  if (tc.function?.arguments) {
                    toolArgsBuf[idx] = (toolArgsBuf[idx] ?? "") + tc.function.arguments;
                  }
                }
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        // Parse tool calls
        for (const idx of Object.keys(toolArgsBuf)) {
          const i = Number(idx);
          if (toolNames[i] !== "propose_staffing_changes") continue;
          try {
            const args = JSON.parse(toolArgsBuf[i]) as ProposedPayload;
            if (Array.isArray(args.changes)) {
              setProposed(args);
            }
          } catch (err) {
            console.error("Falha ao parsear tool args:", err, toolArgsBuf[i]);
          }
        }
      } catch (err) {
        console.error("Erro stream wizard:", err);
        toast.error("Não consegui processar sua solicitação. Tente novamente.");
        upsertAssistant("\n\n_Erro de comunicação. Tente novamente._");
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, brand, unitId, unitName, monthYear, currentConfig, headcount],
  );

  const applyProposed = useCallback(async () => {
    if (!proposed?.changes?.length) return;
    setIsApplying(true);
    try {
      const results = await Promise.allSettled(
        proposed.changes.map((c) =>
          upsert.mutateAsync({
            unit_id: unitId,
            brand,
            sector_key: c.sector_key,
            shift_type: c.shift_type,
            day_of_week: c.day_of_week,
            month_year: monthYear,
            required_count: c.required_count,
            extras_count: c.extras_count,
          }),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail === 0) {
        toast.success(`${ok} alteração(ões) aplicada(s).`);
        setProposed(null);
      } else {
        toast.warning(`${ok} aplicada(s), ${fail} com erro.`);
      }
    } finally {
      setIsApplying(false);
    }
  }, [proposed, unitId, brand, monthYear, upsert]);

  const discardProposed = useCallback(() => setProposed(null), []);

  return {
    messages,
    isStreaming,
    proposed,
    isApplying,
    sendMessage,
    applyProposed,
    discardProposed,
    reset,
    currentConfig,
  };
}
