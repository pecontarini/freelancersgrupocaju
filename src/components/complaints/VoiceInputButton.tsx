import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// Web Speech API types
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: {
    readonly transcript: string;
    readonly confidence: number;
  };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLocal {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLocal {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLocal) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLocal) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check for browser support
    const SpeechRecognitionConstructor = (window as Window & { 
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }).SpeechRecognition || (window as Window & { 
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    }).webkitSpeechRecognition;
    
    if (!SpeechRecognitionConstructor) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";

    recognition.onresult = (event: SpeechRecognitionEventLocal) => {
      let finalTranscript = "";
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        onTranscript(finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLocal) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      
      if (event.error === "not-allowed") {
        toast({
          title: "Microfone bloqueado",
          description: "Permita o acesso ao microfone nas configurações do navegador.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript, toast]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({
          title: "🎤 Ouvindo...",
          description: "Fale agora. Clique novamente para parar.",
        });
      } catch (error) {
        console.error("Failed to start recognition:", error);
      }
    }
  }, [isListening, toast]);

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      onClick={toggleListening}
      disabled={disabled}
      className="shrink-0"
      title={isListening ? "Parar gravação" : "Ditar com voz"}
    >
      {isListening ? (
        <MicOff className="h-4 w-4 animate-pulse" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
