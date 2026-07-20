import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useBrandLogo, BRAND_NAME } from "@/lib/brand";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Auth() {
  const navigate = useNavigate();
  const { src: brandLogo, alt: brandAlt } = useBrandLogo();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [setPasswordMode, setSetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingInvite, setCheckingInvite] = useState(false);
  const [inviteSessionReady, setInviteSessionReady] = useState(false);

  // Detect invite / password recovery flow (session created via magic link)
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const hasInviteHint =
      hash.includes("type=invite") ||
      hash.includes("type=recovery") ||
      new URLSearchParams(search).get("invite") === "1";
    if (hasInviteHint) {
      setSetPasswordMode(true);
      setCheckingInvite(true);
      supabase.auth.getSession().then(({ data: { session } }) => {
        setInviteSessionReady(Boolean(session));
        setCheckingInvite(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setSetPasswordMode(true);
      if ((event === "SIGNED_IN" && hasInviteHint) || event === "PASSWORD_RECOVERY") {
        setInviteSessionReady(Boolean(session));
        setCheckingInvite(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteSessionReady) {
      toast.error("Este link é inválido, expirou ou já foi substituído. Solicite um novo link.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha definida! Bem-vindo(a).");
    window.history.replaceState(null, "", window.location.pathname);
    navigate("/");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Informe seu e-mail.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      toast.error("E-mail inválido. Verifique o formato.");
      return;
    }
    if (resendCooldown > 0) {
      toast.error(`Aguarde ${resendCooldown}s para reenviar.`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setRecoveryEmailSent(true);
      setResendCooldown(60);
      toast.success("Link de recuperação enviado!", {
        description: "Verifique sua caixa de entrada e a pasta de spam.",
      });
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      toast.error(error.message === "Invalid login credentials" 
        ? "E-mail ou senha inválidos" 
        : error.message);
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/");
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada com sucesso! Você já pode fazer login.");
      setEmail("");
      setPassword("");
    }
    setLoading(false);
  };

  if (setPasswordMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-card">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <div className="w-64 overflow-hidden rounded-2xl shadow-lg">
                <img src={brandLogo} alt={brandAlt} className="h-auto w-full object-contain" />
              </div>
            </div>
            <CardTitle className="text-xl">Defina sua senha</CardTitle>
            <CardDescription>Crie uma senha para acessar sua conta.</CardDescription>
          </CardHeader>
          <CardContent>
            {checkingInvite ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !inviteSessionReady ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Este link é inválido, expirou ou foi substituído por um link mais recente.
                </p>
                <Button type="button" className="w-full" onClick={() => window.location.assign("/auth")}>
                  Voltar ao login
                </Button>
              </div>
            ) : (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-9"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-9"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar e entrar"
                )}
              </Button>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (forgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-card">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <div className="w-64 overflow-hidden rounded-2xl shadow-lg">
                <img src={brandLogo} alt={brandAlt} className="h-auto w-full object-contain" />
              </div>
            </div>
            <CardDescription className="text-base">Recuperação de Senha</CardDescription>
          </CardHeader>
          <CardContent>
            {recoveryEmailSent ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Link enviado!</p>
                    <p className="text-sm text-muted-foreground">
                      Enviamos um link de recuperação para <span className="font-medium text-foreground">{email.trim()}</span>.
                    </p>
                    <p className="text-xs text-muted-foreground pt-1">
                      Não recebeu? Verifique sua caixa de spam ou lixo eletrônico.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading || resendCooldown > 0}
                  onClick={(e) => handleForgotPassword(e as unknown as React.FormEvent)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reenviando...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Reenviar em ${resendCooldown}s`
                  ) : (
                    "Reenviar link"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setForgotPassword(false);
                    setRecoveryEmailSent(false);
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enviaremos um link seguro para você redefinir sua senha.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar link de recuperação"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotPassword(false)}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Voltar ao login
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-card">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="w-64 overflow-hidden rounded-2xl shadow-lg">
              <img src={brandLogo} alt={brandAlt} className="h-auto w-full object-contain" />
            </div>
          </div>
          <CardDescription className="text-base">{BRAND_NAME}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setForgotPassword(true)}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Esqueceu a senha?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    "Solicitar Acesso"
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Ao criar uma conta, você poderá acessar o sistema imediatamente.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
