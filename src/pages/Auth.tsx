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
import cajuparLogo from "@/assets/logo.png";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

  if (forgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-md rounded-2xl shadow-card">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <div className="w-64 overflow-hidden rounded-2xl shadow-lg">
                <img src={cajuparLogo} alt="CajuPAR" className="h-auto w-full object-contain" />
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
              <img src={cajuparLogo} alt="CajuPAR" className="h-auto w-full object-contain" />
            </div>
          </div>
          <CardDescription className="text-base">Portal da Liderança</CardDescription>
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
