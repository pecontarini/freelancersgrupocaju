/**
 * Camada de abstração para disparo de mensagens WhatsApp.
 * O frontend NUNCA chama wa.me ou n8n diretamente — sempre via dispatcher.
 *
 * Implementações:
 * - WaMeDispatcher (ativa): abre wa.me em nova aba, marca queue.
 * - N8nDispatcher (stub): plugável para envio automatizado via webhook n8n.
 */

export interface DispatchInput {
  profileId: string;
  telefone: string | null; // E.164 ou local; sem máscara
  messageBody: string;
  magicLink: string;
  magicLinkToken: string;
  magicLinkExpiresAt: string; // ISO
}

export interface DispatchResult {
  ok: boolean;
  channel: "wame" | "n8n";
  queueId?: string;
  url?: string; // wa.me URL para o caso wame
  error?: string;
}

export interface BatchDispatchInput {
  items: DispatchInput[];
}

export interface BatchDispatchResult {
  results: DispatchResult[];
}

export interface WhatsAppDispatcher {
  readonly channel: "wame" | "n8n";
  send(input: DispatchInput): Promise<DispatchResult>;
  sendBatch(input: BatchDispatchInput): Promise<BatchDispatchResult>;
}
