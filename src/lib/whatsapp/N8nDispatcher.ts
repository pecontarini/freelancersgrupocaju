import type {
  WhatsAppDispatcher,
  DispatchInput,
  DispatchResult,
  BatchDispatchInput,
  BatchDispatchResult,
} from "./WhatsAppDispatcher";

/**
 * Stub plugável para integração futura com n8n.
 *
 * Quando ativado:
 * - Variável de ambiente esperada: `N8N_WEBHOOK_URL` (secret no edge runtime).
 * - Payload POST esperado pelo webhook:
 *   {
 *     profile_id: string,
 *     telefone: string,        // E.164 sem +, ex: 5511999999999
 *     message_body: string,
 *     magic_link: string,
 *     magic_link_token: string,
 *     magic_link_expires_at: string  // ISO
 *   }
 * - Resposta esperada do webhook: 2xx = sucesso, 4xx/5xx = falha.
 *
 * Hoje retorna `not_implemented` para garantir que a interface é plugável
 * sem quebrar nada caso alguém chame por engano.
 */
export class N8nDispatcher implements WhatsAppDispatcher {
  readonly channel = "n8n" as const;

  async send(_input: DispatchInput): Promise<DispatchResult> {
    return { ok: false, channel: "n8n", error: "not_implemented" };
  }

  async sendBatch(input: BatchDispatchInput): Promise<BatchDispatchResult> {
    return {
      results: input.items.map(() => ({
        ok: false,
        channel: "n8n" as const,
        error: "not_implemented",
      })),
    };
  }
}
