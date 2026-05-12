import { describe, it, expect } from "vitest";
import { buildWaMeUrl } from "../WaMeDispatcher";
import { N8nDispatcher } from "../N8nDispatcher";
import { PIX_UPDATE_MESSAGE_V3 } from "../messageTemplates";

describe("WaMeDispatcher.buildWaMeUrl", () => {
  it("encodes phone in E.164 (BR) without +", () => {
    const url = buildWaMeUrl("(11) 99999-8888", "oi");
    expect(url.startsWith("https://wa.me/5511999998888")).toBe(true);
  });

  it("does NOT double-prefix country code 55", () => {
    const url = buildWaMeUrl("5511999998888", "oi");
    expect(url.startsWith("https://wa.me/5511999998888?")).toBe(true);
  });

  it("URL-encodes accents, line breaks and emoji safely", () => {
    const body = "Olá!\nTeste de acentuação çãé 🌶️";
    const url = buildWaMeUrl("11999998888", body);
    // %0A is the encoded line break; emoji surrogates encoded as %F0...
    expect(url).toContain("%0A");
    expect(url).toContain("%C3%A9"); // é
    expect(url).toContain("%C3%A7"); // ç
    expect(url).not.toContain("\n");
  });
});

describe("PIX_UPDATE_MESSAGE_V3 template", () => {
  it("uses only the first name and inlines the link", () => {
    const msg = PIX_UPDATE_MESSAGE_V3({
      nome: "Maria Silva Santos",
      link: "https://example.com/atualizar-pix/abc",
    });
    expect(msg).toContain("Olá, Maria!");
    expect(msg).toContain("https://example.com/atualizar-pix/abc");
    expect(msg).toContain("expira em 7 dias");
    expect(msg).toContain("PIX em nome de terceiros não será processado");
  });
});

describe("N8nDispatcher (stub)", () => {
  it("returns not_implemented on send (plugability check)", async () => {
    const d = new N8nDispatcher();
    const r = await d.send({
      profileId: "p1",
      telefone: "11999998888",
      messageBody: "x",
      magicLink: "https://x",
      magicLinkToken: "tok",
      magicLinkExpiresAt: new Date().toISOString(),
    });
    expect(r.ok).toBe(false);
    expect(r.channel).toBe("n8n");
    expect(r.error).toBe("not_implemented");
  });

  it("returns not_implemented for every item in sendBatch", async () => {
    const d = new N8nDispatcher();
    const r = await d.sendBatch({
      items: [
        {
          profileId: "p1",
          telefone: "11999998888",
          messageBody: "x",
          magicLink: "https://x",
          magicLinkToken: "tok",
          magicLinkExpiresAt: new Date().toISOString(),
        },
      ],
    });
    expect(r.results.every((x) => !x.ok && x.error === "not_implemented")).toBe(
      true
    );
  });
});
