import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useActionPlanComments, type ActionPlanComment } from "@/hooks/useActionPlans";
import { VoiceInputButton } from "./VoiceInputButton";

interface ActionPlanTimelineProps {
  actionPlanId: string;
}

export function ActionPlanTimeline({ actionPlanId }: ActionPlanTimelineProps) {
  const { comments, isLoading, addComment } = useActionPlanComments(actionPlanId);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    
    setIsSending(true);
    try {
      await addComment.mutateAsync({ actionPlanId, message: newMessage.trim() });
      setNewMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setNewMessage(prev => prev ? `${prev} ${text}` : text);
  };

  return (
    <div className="space-y-3 border-t pt-3 mt-3">
      <h5 className="text-xs font-semibold uppercase flex items-center gap-2 text-muted-foreground">
        <MessageSquare className="h-3 w-3" />
        Linha do Tempo
      </h5>

      {comments.length > 0 ? (
        <ScrollArea className="h-32">
          <div className="space-y-2 pr-4">
            {comments.map((comment) => (
              <CommentBubble key={comment.id} comment={comment} />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhum comentário ainda.
        </p>
      )}

      <div className="flex gap-2">
        <Textarea
          placeholder="Adicione um comentário..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="min-h-[60px] text-sm resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="flex flex-col gap-1">
          <VoiceInputButton 
            onTranscript={handleVoiceTranscript}
            disabled={isSending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentBubble({ comment }: { comment: ActionPlanComment }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
          <User className="h-3 w-3 text-primary" />
        </div>
        <span className="text-xs text-muted-foreground">
          {format(new Date(comment.created_at), "dd/MM HH:mm", { locale: ptBR })}
        </span>
      </div>
      <p className="text-foreground">{comment.message}</p>
    </div>
  );
}
