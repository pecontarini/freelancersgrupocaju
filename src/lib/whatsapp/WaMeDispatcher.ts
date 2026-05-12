import { supabase } from "@/integrations/supabase/client";
import type {
  WhatsAppDispatcher,
  DispatchInput,
  DispatchResult,
  BatchDispatchInput,
  BatchDispatchResult,
} from "./WhatsAppDispatcher";

/**
 * Implementação wa.me: monta a URL `https://wa.me/<phone>?text=<encoded>`
 * e marca o registro em `whatsapp_dispatch_queue` como `dispatched` / channel='wame'.
 *
 * Não abre janela automaticamente — devolve a URL para o componente UI
 * decidir (botão "Abrir WhatsApp" por linha na fila visual).
 */
export class WaMeDispatcher implements WhatsAppDispatcher {
  readonly channel = "wame" as const;

  async send(input: DispatchInput): Promise<DispatchResult> {
    if (!input.telefone) {
      return { ok: false, channel: "wame", error: "no_phone" };
    }

    const phone = onlyDigits(input.telefone);
    if (phone.length < 10) {
      return { ok: false, channel: "wame", error: "phone_invalid" };
    }

    // wa.me prefere E.164 sem +; assume Brasil se vier só DDD+número
    const intl = phone.startsWith("55") ? phone : `55${phone}`;
    const url = `https://wa.me/${intl}?text=${encodeURIComponent(
      input.messageBody
    )}`;

    // Atualiza fila já existente (criada por generate-magic-pix-link) para channel='wame' + dispatched
    const { data: queueRows, error: updErr } = await supabase
      .from("whatsapp_dispatch_queue")
      .update({
        channel: "wame",
        status: "dispatched",
        dispatched_at: new Date().toISOString(),
      })
      .eq("magic_link_token", input.magicLinkToken)
      .select("id")
      .limit(1);

    if (updErr) {
      return { ok: false, channel: "wame", error: updErr.message };
    }

    return {
      ok: true,
      channel: "wame",
      queueId: queueRows?.[0]?.id,
      url,
    };
  }

  async sendBatch(input: BatchDispatchInput): Promise<BatchDispatchResult> {
    const results: DispatchResult[] = [];
    for (const item of input.items) {
      results.push(await this.send(item));
    }
    return { results };
  }
}

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Helper exposto para testes — gera a URL wa.me sem efeitos colaterais. */
export function buildWaMeUrl(telefone: string, body: string): string {
  const phone = onlyDigits(telefone);
  const intl = phone.startsWith("55") ? phone : `55${phone}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(body)}`;
}
