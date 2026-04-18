import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Users, X, Loader2, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { AgendaParticipante, ParticipanteStatus } from "@/hooks/useAgendaEventos";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ProfileResult {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface Props {
  value: AgendaParticipante[];
  onChange: (next: AgendaParticipante[]) => void;
}

const STATUS_DOT: Record<ParticipanteStatus, string> = {
  aceito: "bg-emerald-500",
  recusado: "bg-destructive",
  talvez: "bg-amber-500",
  pendente: "bg-muted-foreground/60",
};

const STATUS_LABEL: Record<ParticipanteStatus, string> = {
  aceito: "Aceito",
  recusado: "Recusado",
  talvez: "Talvez",
  pendente: "Aguardando",
};

function initialsFrom(name?: string | null, email?: string): string {
  const src = (name && name.trim()) || (email?.split("@")[0] ?? "");
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || src.slice(0, 2)).toUpperCase();
}

export function ParticipanteSelector({ value, onChange }: Props) {
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Buscar perfis quando draft >= 2 chars
  useEffect(() => {
    const term = draft.trim();
    if (term.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setOpen(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const { data, error: qErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url")
        .or(`full_name.ilike.${like},email.ilike.${like}`)
        .limit(8);
      if (cancelled) return;
      setSearching(false);
      if (qErr) {
        console.error("[ParticipanteSelector] search error", qErr);
        setResults([]);
        return;
      }
      // Filtrar já adicionados
      const existing = new Set(value.map((p) => p.email.toLowerCase()));
      setResults(
        ((data ?? []) as ProfileResult[]).filter(
          (r) => r.email && !existing.has(r.email.toLowerCase())
        )
      );
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [draft, value]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const addParticipant = (p: AgendaParticipante) => {
    const email = p.email.trim().toLowerCase();
    if (!email) return;
    if (value.some((v) => v.email.toLowerCase() === email)) {
      setError("Pessoa já adicionada.");
      return;
    }
    onChange([...value, { ...p, email }]);
    setDraft("");
    setError(null);
    setOpen(false);
    setResults([]);
  };

  const addExternal = (raw: string) => {
    const email = raw.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      setError("E-mail inválido.");
      return;
    }
    addParticipant({ email, status: "pendente" });
  };

  const handleSelectProfile = (p: ProfileResult) => {
    addParticipant({
      user_id: p.user_id,
      nome: p.full_name ?? p.email ?? "",
      email: (p.email ?? "").toLowerCase(),
      avatar_url: p.avatar_url ?? null,
      status: "pendente",
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      // Se tiver resultado, adiciona o primeiro; caso contrário tenta como e-mail
      if (results.length > 0) {
        handleSelectProfile(results[0]);
      } else {
        addExternal(draft);
      }
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const remove = (email: string) =>
    onChange(value.filter((p) => p.email.toLowerCase() !== email.toLowerCase()));

  return (
    <div className="space-y-2" ref={wrapRef}>
      <Label htmlFor="participantes-search" className="flex items-center gap-1.5">
        <Users className="h-4 w-4 text-primary" />
        Participantes <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
      </Label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <span
              key={p.email}
              title={`${p.nome ?? p.email} · ${STATUS_LABEL[p.status]}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-0.5 pr-2 text-xs font-medium text-primary"
            >
              <span className="relative">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/25 text-[9px] font-bold uppercase text-primary">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    initialsFrom(p.nome, p.email)
                  )}
                </span>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                    STATUS_DOT[p.status]
                  )}
                  aria-label={STATUS_LABEL[p.status]}
                />
              </span>
              <span className="max-w-[160px] truncate">{p.nome ?? p.email}</span>
              <button
                type="button"
                onClick={() => remove(p.email)}
                className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                aria-label={`Remover ${p.email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          id="participantes-search"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => draft.trim().length >= 2 && setOpen(true)}
          placeholder="Buscar pessoa ou digitar e-mail"
          autoComplete="off"
        />

        {open && (results.length > 0 || searching || (draft.trim().length >= 2 && !searching)) && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-lg">
            {searching && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando…
              </div>
            )}
            {!searching &&
              results.map((p) => (
                <button
                  type="button"
                  key={p.user_id}
                  onClick={() => handleSelectProfile(p)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold uppercase text-primary">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      initialsFrom(p.full_name, p.email ?? "")
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.full_name ?? "Sem nome"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                  </span>
                </button>
              ))}
            {!searching && results.length === 0 && draft.trim().length >= 2 && (
              <button
                type="button"
                onClick={() => addExternal(draft)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">Convidar como e-mail externo</span>
                  <span className="block truncate font-medium">{draft.trim()}</span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
