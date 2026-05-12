import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, AlertTriangle } from "lucide-react";

export interface DispatchQueueItem {
  profileId: string;
  nome: string;
  telefone: string | null;
  waMeUrl: string | null;
  magicLink: string;
  messageBody: string;
  sent: boolean;
  error?: string;
}

interface Props {
  items: DispatchQueueItem[];
  onClose: () => void;
}

export default function BatchDispatchDrawer({ items, onClose }: Props) {
  const [state, setState] = useState<DispatchQueueItem[]>(items);

  const markSent = async (idx: number) => {
    const item = state[idx];
    if (!item || item.sent) return;
    // Persist as 'sent' in queue
    await supabase
      .from("whatsapp_dispatch_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("magic_link_token", new URL(item.magicLink).pathname.split("/").pop() ?? "");
    setState((s) => s.map((it, i) => (i === idx ? { ...it, sent: true } : it)));
  };

  const openWa = (idx: number) => {
    const item = state[idx];
    if (!item?.waMeUrl) return;
    window.open(item.waMeUrl, "_blank", "noopener");
  };

  const sentCount = state.filter((s) => s.sent).length;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Fila de disparo — wa.me</SheetTitle>
          <SheetDescription>
            {sentCount}/{state.length} marcados como enviados. Abra cada
            WhatsApp e marque depois de enviar.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">Enviado</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.map((it, i) => (
                <TableRow key={it.profileId}>
                  <TableCell>
                    <Checkbox
                      checked={it.sent}
                      onCheckedChange={() => markSent(i)}
                      disabled={!!it.error || !it.waMeUrl}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {it.nome}
                    {it.error && (
                      <Badge variant="destructive" className="ml-2 gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {it.error}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {it.telefone ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openWa(i)}
                      disabled={!it.waMeUrl || !!it.error}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Abrir WhatsApp
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
