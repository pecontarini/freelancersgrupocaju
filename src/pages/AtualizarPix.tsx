import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type PixType = "cpf" | "email" | "telefone";

interface PeekResponse {
  ok: boolean;
  error?: string;
  primeiro_nome?: string | null;
  cpf_masked?: string;
  telefone_masked?: string;
  tipo_chave_pix?: string | null;
  chave_pix_masked?: string;
  expires_at?: string;
}

interface ProfileMasked {
  primeiroNome: string | null;
  cpfMasked: string;
  telefoneMasked: string;
  tipoAtual: string | null;
  chaveMasked: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; profile: ProfileMasked; expiresAt: string }
  | { kind: "error"; reason: string }
  | { kind: "success" };

export default function AtualizarPix() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [tipo, setTipo] = useState<PixType>("cpf");
  const [chave, setChave] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", reason: "token_missing" });
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("peek_pix_magic_link", {
        p_token: token,
      });
      if (error) {
        setState({ kind: "error", reason: error.message });
        return;
      }
      const r = data as unknown as PeekResponse;
      if (!r?.ok) {
        setState({ kind: "error", reason: r?.error ?? "unknown" });
        return;
      }
      const profile: ProfileMasked = {
        primeiroNome: r.primeiro_nome ?? null,
        cpfMasked: r.cpf_masked ?? "—",
        telefoneMasked: r.telefone_masked ?? "—",
        tipoAtual: r.tipo_chave_pix ?? null,
        chaveMasked: r.chave_pix_masked ?? "—",
      };
      setState({
        kind: "ready",
        profile,
        expiresAt: r.expires_at ?? "",
      });
      if (
        r.tipo_chave_pix === "cpf" ||
        r.tipo_chave_pix === "email" ||
        r.tipo_chave_pix === "telefone"
      ) {
        setTipo(r.tipo_chave_pix);
      }
    })();
  }, [token]);

  const handleSubmit = async () => {
    if (!token || state.kind !== "ready") return;
    if (!chave.trim()) {
      toast.error("Informe sua chave PIX.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("consume_pix_magic_link", {
      p_token: token,
      p_new_chave_pix: chave.trim(),
      p_new_tipo_chave_pix: tipo,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const r = data as unknown as { ok: boolean; error?: string };
    if (!r.ok) {
      toast.error(`Não foi possível salvar: ${r.error}`);
      return;
    }
    setState({ kind: "success" });
  };

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle>Link inválido ou expirado</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Este link de atualização de PIX não é mais válido.</p>
            <p>Entre em contato com seu gestor para receber um novo link.</p>
            <p className="text-xs opacity-70">Motivo técnico: {state.reason}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <CardTitle>PIX atualizado com sucesso</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Sua chave PIX foi recebida e os pagamentos seguirão para essa
              chave a partir do próximo lote.
            </p>
            <p className="mt-3">Pode fechar esta página. O link já expirou.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile } = state;
  const saudacao = profile.primeiroNome
    ? `Olá, ${profile.primeiroNome} — vamos atualizar seu PIX`
    : "Atualizar minha chave PIX";

  return (
    <div className="min-h-screen p-4 bg-background flex items-start justify-center md:items-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-lg">{saudacao}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div>
              <span className="text-muted-foreground">CPF:</span>{" "}
              <strong>{profile.cpfMasked}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Telefone:</span>{" "}
              {profile.telefoneMasked}
            </div>
            <div>
              <span className="text-muted-foreground">Chave atual:</span>{" "}
              {profile.chaveMasked !== "—"
                ? `${profile.chaveMasked}${profile.tipoAtual ? ` (${profile.tipoAtual})` : ""}`
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Mostramos só o início e o fim de cada dado para você confirmar
              que o link é seu, sem expor informação sensível.
            </p>
          </div>

          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <strong className="text-destructive">Importante:</strong> sua chave
            PIX precisa estar em <strong>seu próprio nome</strong> (CPF, e-mail
            ou telefone seus). PIX em nome de terceiros não será processado.
          </div>

          <div className="space-y-2">
            <Label>Tipo de chave PIX</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as PixType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Chave PIX</Label>
            <Input
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder={
                tipo === "cpf"
                  ? "000.000.000-00"
                  : tipo === "email"
                    ? "voce@exemplo.com"
                    : "(11) 99999-8888"
              }
              inputMode={tipo === "email" ? "email" : "text"}
              autoComplete="off"
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirmar minha chave PIX"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
