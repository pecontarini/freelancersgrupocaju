import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Delete } from "lucide-react";

interface Props {
  onSubmit: (cpf: string) => void;
  onCancel: () => void;
  title?: string;
  digits?: number;
}

function formatCpf(d: string) {
  const digits = d.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function EstacaoCpfKeypad({ onSubmit, onCancel, title = "Digite seu CPF", digits = 11 }: Props) {
  const [value, setValue] = useState("");

  const press = (d: string) => {
    if (value.length < digits) setValue(value + d);
  };
  const back = () => setValue(value.slice(0, -1));

  const display = digits === 11 ? formatCpf(value) : value;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <Button variant="ghost" size="lg" onClick={onCancel}>
          <ArrowLeft className="h-6 w-6 mr-2" /> Voltar
        </Button>
        <h2 className="text-2xl font-bold">{title}</h2>
        <div className="w-24" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-5xl font-mono font-bold tracking-wider min-h-[60px] text-center">
          {display || (digits === 11 ? "___.___.___-__" : "____")}
        </div>

        <div className="grid grid-cols-3 gap-4 w-full max-w-md">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
            <Button
              key={n}
              variant="outline"
              className="h-20 text-3xl font-bold"
              onClick={() => press(n)}
            >
              {n}
            </Button>
          ))}
          <Button variant="outline" className="h-20 text-xl" onClick={back}>
            <Delete className="h-7 w-7" />
          </Button>
          <Button
            variant="outline"
            className="h-20 text-3xl font-bold"
            onClick={() => press("0")}
          >
            0
          </Button>
          <Button
            className="h-20 text-xl font-bold"
            disabled={value.length !== digits}
            onClick={() => onSubmit(value)}
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
