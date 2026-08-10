import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus, Users, Pencil, Trash2, Star, ExternalLink, Sparkles, Upload, Loader2, Link2, Copy, KeyRound } from "lucide-react";
import { BrandSplash } from "@/components/motion";
import { buildTenantUrl } from "@/lib/tenantResolver";

interface TenantRow {
  id: string;
  slug: string;
  nome: string;
  ativo: boolean;
  theme: any;
  copy: any;
  logo_url: string | null;
  logo_dark_url: string | null;
  logo_symbol_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  user_count: number;
}

interface TenantMember {
  user_id: string;
  email: string;
  full_name: string | null;
  is_default: boolean;
  linked_at: string;
}

const emptyForm = {
  slug: "",
  nome: "",
  primary: "220 90% 56%",
  primaryStrong: "220 90% 45%",
  accent: "220 90% 56%",
  appName: "",
  tagline: "",
  browserTitle: "",
  metaDescription: "",
  logo_url: "",
  logo_dark_url: "",
  logo_symbol_url: "",
  favicon_url: "",
  ativo: true,
};

export default function AdminTenants() {
  const { isSuperAdmin, isLoading: profileLoading } = useUserProfile();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [membersOf, setMembersOf] = useState<TenantRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleLogoFileSelected = async (file: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp)$/.test(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG, SVG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB).");
      return;
    }

    setAiBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoPreview(dataUrl);

      // 1) Sobe pro Storage (bucket privado tenant-logos)
      const slugPart = (form.slug || "novo").replace(/[^a-z0-9-]/g, "") || "novo";
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${slugPart}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("tenant-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // URL assinada de longa duração (10 anos)
      const { data: signed, error: signErr } = await supabase.storage
        .from("tenant-logos")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr) throw signErr;

      // 2) IA extrai as cores
      const { data: colors, error: fnErr } = await supabase.functions.invoke(
        "extract-brand-colors",
        { body: { imageDataUrl: dataUrl } },
      );
      if (fnErr) throw fnErr;

      setForm((prev) => ({
        ...prev,
        logo_url: signed?.signedUrl ?? prev.logo_url,
        primary: colors?.primary ?? prev.primary,
        primaryStrong: colors?.primaryStrong ?? prev.primaryStrong,
        accent: colors?.accent ?? prev.accent,
      }));
      toast.success("Logo enviada e cores extraídas pela IA");
    } catch (err: any) {
      console.error(err);
      toast.error("Falha: " + (err?.message ?? String(err)));
    } finally {
      setAiBusy(false);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_tenants");
    if (error) toast.error("Erro ao carregar empresas: " + error.message);
    else setTenants((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin]);

  if (profileLoading) return <BrandSplash variant="full" message="Carregando..." />;
  // Guarda de rota já validou super_admin via <AdminRoute>. Fallback defensivo:
  if (!isSuperAdmin) return null;

  const openCreate = () => {
    setForm(emptyForm);
    setLogoPreview(null);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (t: TenantRow) => {
    setForm({
      slug: t.slug,
      nome: t.nome,
      primary: t.theme?.primary ?? "220 90% 56%",
      primaryStrong: t.theme?.primaryStrong ?? "220 90% 45%",
      accent: t.theme?.accent ?? t.theme?.primary ?? "220 90% 56%",
      appName: t.copy?.appName ?? t.nome,
      tagline: t.copy?.tagline ?? "",
      browserTitle: t.copy?.browserTitle ?? t.nome,
      metaDescription: t.copy?.metaDescription ?? "",
      logo_url: t.logo_url ?? "",
      logo_dark_url: t.logo_dark_url ?? "",
      logo_symbol_url: t.logo_symbol_url ?? "",
      favicon_url: t.favicon_url ?? "",
      ativo: t.ativo,
    });
    setLogoPreview(t.logo_url ?? null);
    setEditing(t);
    setCreating(false);
  };

  const buildPayload = () => ({
    _theme: {
      primary: form.primary.trim(),
      primaryStrong: form.primaryStrong.trim(),
      accent: form.accent.trim(),
    },
    _copy: {
      appName: form.appName.trim() || form.nome.trim(),
      tagline: form.tagline.trim() || null,
      browserTitle: form.browserTitle.trim() || form.nome.trim(),
      metaDescription: form.metaDescription.trim() || null,
      terms: { unit: "unidade", unitPlural: "unidades", group: "grupo" },
    },
    _logo_url: form.logo_url.trim() || null,
    _logo_dark_url: form.logo_dark_url.trim() || null,
    _logo_symbol_url: form.logo_symbol_url.trim() || null,
    _favicon_url: form.favicon_url.trim() || null,
  });

  const submit = async () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    if (creating && !/^[a-z0-9][a-z0-9_-]*$/.test(form.slug))
      return toast.error("Slug inválido (use a-z, 0-9, hífen)");

    const payload = buildPayload();
    if (creating) {
      const { error } = await supabase.rpc("admin_create_tenant", {
        _slug: form.slug.trim(),
        _nome: form.nome.trim(),
        ...payload,
      });
      if (error) return toast.error("Erro: " + error.message);
      toast.success("Empresa criada");
    } else if (editing) {
      const { error } = await supabase.rpc("admin_update_tenant", {
        _id: editing.id,
        _nome: form.nome.trim(),
        _ativo: form.ativo,
        ...payload,
      });
      if (error) return toast.error("Erro: " + error.message);
      toast.success("Empresa atualizada");
    }
    setCreating(false);
    setEditing(null);
    load();
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Empresas</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie tenants, branding e usuários vinculados.
            </p>
          </div>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova empresa
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((t) => (
            <Card key={t.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{t.nome}</h3>
                  <a
                    href={buildTenantUrl(t.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    {t.slug}.2board.app <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                {!t.ativo && <Badge variant="secondary">Inativo</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded border"
                  style={{ background: `hsl(${t.theme?.primary ?? "220 10% 50%"})` }}
                />
                <span className="text-xs text-muted-foreground">
                  {t.copy?.appName ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" /> {t.user_count} usuário(s)
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => openEdit(t)} className="gap-1">
                  <Pencil className="h-3 w-3" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMembersOf(t)} className="gap-1">
                  <Users className="h-3 w-3" /> Usuários
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{creating ? "Nova empresa" : `Editar ${editing?.nome}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Slug (identificador URL)</Label>
                <Input
                  value={form.slug}
                  disabled={!creating}
                  onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                  placeholder="minha-empresa"
                />
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome do portal (exibido)</Label>
                <Input
                  value={form.appName}
                  onChange={(e) => setForm({ ...form, appName: e.target.value })}
                  placeholder="Portal da Liderança"
                />
              </div>
              <div>
                <Label>Tagline</Label>
                <Input
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Ex: Grupo XYZ"
                />
              </div>
            </div>

            <div>
              <Label>Título da aba</Label>
              <Input
                value={form.browserTitle}
                onChange={(e) => setForm({ ...form, browserTitle: e.target.value })}
              />
            </div>
            <div>
              <Label>Meta description</Label>
              <Textarea
                value={form.metaDescription}
                onChange={(e) => setForm({ ...form, metaDescription: e.target.value })}
                rows={2}
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Logo + cores por IA
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Envie a logo e a IA sugere as cores da marca automaticamente.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => handleLogoFileSelected(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aiBusy}
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {aiBusy ? "Analisando..." : "Enviar logo"}
                </Button>
              </div>
              {logoPreview && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <div className="h-16 w-16 rounded bg-background border flex items-center justify-center overflow-hidden">
                    <img src={logoPreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    {(["primary", "primaryStrong", "accent"] as const).map((k) => (
                      <div key={k} className="text-center">
                        <div className="h-6 rounded border" style={{ background: `hsl(${form[k]})` }} />
                        <p className="text-[10px] mt-1 text-muted-foreground">{k}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Cores (HSL sem "hsl()")</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Primary</Label>
                  <Input
                    value={form.primary}
                    onChange={(e) => setForm({ ...form, primary: e.target.value })}
                    placeholder="20 74% 48%"
                  />
                  <div
                    className="h-6 mt-1 rounded border"
                    style={{ background: `hsl(${form.primary})` }}
                  />
                </div>
                <div>
                  <Label>Primary Strong</Label>
                  <Input
                    value={form.primaryStrong}
                    onChange={(e) => setForm({ ...form, primaryStrong: e.target.value })}
                  />
                  <div
                    className="h-6 mt-1 rounded border"
                    style={{ background: `hsl(${form.primaryStrong})` }}
                  />
                </div>
                <div>
                  <Label>Accent</Label>
                  <Input
                    value={form.accent}
                    onChange={(e) => setForm({ ...form, accent: e.target.value })}
                  />
                  <div
                    className="h-6 mt-1 rounded border"
                    style={{ background: `hsl(${form.accent})` }}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium">Logos e favicon (URLs)</p>
              <Input placeholder="URL logo principal / claro" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
              <Input placeholder="URL logo (fundo escuro)" value={form.logo_dark_url} onChange={(e) => setForm({ ...form, logo_dark_url: e.target.value })} />
              <Input placeholder="URL símbolo (quadrado)" value={form.logo_symbol_url} onChange={(e) => setForm({ ...form, logo_symbol_url: e.target.value })} />
              <Input placeholder="URL favicon" value={form.favicon_url} onChange={(e) => setForm({ ...form, favicon_url: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Suba os logos no seu CDN/hosting e cole os URLs aqui.
              </p>
            </div>

            {!creating && (
              <div className="flex items-center gap-2 border-t pt-4">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Empresa ativa</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancelar
            </Button>
            <Button onClick={submit}>{creating ? "Criar" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TenantMembersDialog tenant={membersOf} onClose={() => setMembersOf(null)} />
    </div>
  );
}

function TenantMembersDialog({
  tenant,
  onClose,
}: {
  tenant: TenantRow | null;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [generatingLinkFor, setGeneratingLinkFor] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ email: string; link: string; kind: "invite" | "recovery" } | null>(null);

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_tenant_users", {
      _tenant_id: tenant.id,
    });
    if (error) toast.error(error.message);
    else setMembers((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    if (tenant) load();
  }, [tenant]);

  const addMember = async () => {
    if (!tenant || !email.trim()) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("admin-invite-tenant-user", {
      body: {
        email: email.trim(),
        tenant_id: tenant.id,
        is_default: isDefault,
        full_name: fullName.trim() || undefined,
      },
    });
    setInviting(false);
    if (error) return toast.error(error.message);
    const d = data as any;
    if (d?.error) return toast.error(d.error);
    toast.success(d?.invited ? "Usuário criado e vinculado" : "Usuário vinculado");
    if (d?.invite_link) {
      setLinkDialog({ email: email.trim(), link: d.invite_link, kind: d.link_kind ?? "invite" });
    }
    setEmail("");
    setFullName("");
    setIsDefault(false);
    load();
  };

  const generateLinkFor = async (memberEmail: string) => {
    if (generatingLinkFor) return;
    setGeneratingLinkFor(memberEmail);
    const { data, error } = await supabase.functions.invoke("admin-invite-tenant-user", {
      body: {
        email: memberEmail,
        link_only: true,
        tenant_id: tenant?.id,
      },
    });
    setGeneratingLinkFor(null);
    if (error) return toast.error(error.message);
    const d = data as any;
    if (d?.error) return toast.error(d.error);
    if (d?.invite_link) {
      setLinkDialog({ email: memberEmail, link: d.invite_link, kind: d.link_kind ?? "recovery" });
    } else {
      toast.error("Não foi possível gerar o link");
    }
  };

  const removeMember = async (userId: string) => {
    if (!tenant) return;
    const { error } = await supabase.rpc("admin_unlink_user_from_tenant", {
      _user_id: userId,
      _tenant_id: tenant.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Vínculo removido");
    load();
  };

  return (
    <Dialog open={!!tenant} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Usuários de {tenant?.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 border-b pb-4">
          <Label>Vincular ou convidar usuário</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome completo (opcional, usado no convite)"
          />
          <div className="flex gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              type="email"
            />
            <Button onClick={addMember} disabled={inviting}>
              {inviting ? "Enviando..." : "Vincular"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Se o e-mail já tiver conta, ele é vinculado direto. Se não, enviamos um convite por e-mail para criar a senha e acessar a empresa.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Definir como empresa padrão do usuário
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto space-y-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário vinculado.</p>
          ) : (
            members.map((m) => (
              <div key={m.user_id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.full_name ?? m.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                {m.is_default && (
                  <Badge variant="secondary" className="gap-1 mr-2">
                    <Star className="h-3 w-3" /> padrão
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => generateLinkFor(m.email)}
                  disabled={generatingLinkFor !== null}
                  className="h-8 w-8"
                  title="Gerar link de acesso/redefinir senha"
                >
                  {generatingLinkFor === m.email ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMember(m.user_id)}
                  className="h-8 w-8"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        {linkDialog && (
          <Dialog open={!!linkDialog} onOpenChange={(o) => !o && setLinkDialog(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {linkDialog.kind === "invite" ? "Link de convite" : "Link para definir/redefinir senha"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Envie este link para <strong>{linkDialog.email}</strong>. Ao abrir, a pessoa define a senha e entra na empresa.
                </p>
                <div className="flex gap-2">
                  <Input readOnly value={linkDialog.link} onFocus={(e) => e.currentTarget.select()} />
                  <Button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(linkDialog.link);
                        toast.success("Link copiado");
                      } catch {
                        toast.error("Copie manualmente");
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use somente este link mais recente. Ele expira em ~1 hora e um novo link invalida o anterior.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
