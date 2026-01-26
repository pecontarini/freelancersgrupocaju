import { useState, useMemo } from "react";
import {
  TrendingUp,
  Award,
  Target,
  Trophy,
  Medal,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";

interface RemuneracaoVariavelTabProps {
  selectedUnidadeId: string | null;
}

// Simulated data - in production, this would come from Supabase
const mockStoreData = [
  { id: "cp", nome: "CP", faturamento: 85, nps: 78, supervisao: 92, position: 1 },
  { id: "nz", nome: "NZ", faturamento: 72, nps: 85, supervisao: 88, position: 2 },
  { id: "cj", nome: "CJ", faturamento: 68, nps: 72, supervisao: 85, position: 3 },
];

const bonusTiers = {
  ouro: { min: 90, color: "from-amber-400 to-amber-600", bonus: 3500 },
  prata: { min: 75, color: "from-slate-300 to-slate-500", bonus: 2500 },
  bronze: { min: 60, color: "from-amber-600 to-amber-800", bonus: 1500 },
};

export function RemuneracaoVariavelTab({
  selectedUnidadeId,
}: RemuneracaoVariavelTabProps) {
  const [simulatedFaturamento, setSimulatedFaturamento] = useState([75]);
  const [simulatedNps, setSimulatedNps] = useState([75]);
  const [simulatedSupervisao, setSimulatedSupervisao] = useState([85]);

  const averageScore = useMemo(() => {
    return (
      (simulatedFaturamento[0] + simulatedNps[0] + simulatedSupervisao[0]) / 3
    );
  }, [simulatedFaturamento, simulatedNps, simulatedSupervisao]);

  const currentTier = useMemo(() => {
    if (averageScore >= bonusTiers.ouro.min) return "ouro";
    if (averageScore >= bonusTiers.prata.min) return "prata";
    if (averageScore >= bonusTiers.bronze.min) return "bronze";
    return null;
  }, [averageScore]);

  const currentBonus = currentTier ? bonusTiers[currentTier].bonus : 0;

  const getGaugeColor = (value: number) => {
    if (value >= 90) return "text-emerald-500";
    if (value >= 75) return "text-amber-500";
    if (value >= 60) return "text-orange-500";
    return "text-red-500";
  };

  const GaugeIndicator = ({
    value,
    label,
    target,
  }: {
    value: number;
    label: string;
    target: number;
  }) => {
    const percentage = Math.min((value / 100) * 100, 100);
    const rotation = (percentage / 100) * 180 - 90;

    return (
      <Card className="rounded-2xl shadow-card">
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="relative h-32 w-32">
            {/* Background arc */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 50">
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
                strokeLinecap="round"
              />
              {/* Progress arc */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${percentage * 1.26}, 126`}
                className="transition-all duration-500"
              />
            </svg>
            {/* Value display */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
              <span className={`text-3xl font-bold ${getGaugeColor(value)}`}>
                {value}%
              </span>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium uppercase text-muted-foreground">
            {label}
          </p>
          <p className="text-xs text-muted-foreground">Meta: {target}%</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">
            Performance Mensal
          </h2>
          <p className="text-muted-foreground">
            {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* KPI Gauges */}
      <div className="grid gap-4 md:grid-cols-3">
        <GaugeIndicator
          value={simulatedFaturamento[0]}
          label="Faturamento"
          target={100}
        />
        <GaugeIndicator value={simulatedNps[0]} label="NPS" target={85} />
        <GaugeIndicator
          value={simulatedSupervisao[0]}
          label="Supervisão"
          target={90}
        />
      </div>

      {/* Ranking Inter-Unidades */}
      <Card className="rounded-2xl shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <Trophy className="h-5 w-5 text-amber-500" />
            Ranking Inter-Unidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Pos.</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">Faturamento</TableHead>
                <TableHead className="text-center">NPS</TableHead>
                <TableHead className="text-center">Supervisão</TableHead>
                <TableHead className="text-right">Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockStoreData.map((store, index) => {
                const avg = (
                  (store.faturamento + store.nps + store.supervisao) /
                  3
                ).toFixed(0);
                return (
                  <TableRow
                    key={store.id}
                    className={
                      store.id === selectedUnidadeId
                        ? "bg-primary/5"
                        : undefined
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {index === 0 && (
                          <Medal className="h-5 w-5 text-amber-500" />
                        )}
                        {index === 1 && (
                          <Medal className="h-5 w-5 text-slate-400" />
                        )}
                        {index === 2 && (
                          <Medal className="h-5 w-5 text-amber-700" />
                        )}
                        {index > 2 && (
                          <span className="text-muted-foreground">
                            {index + 1}º
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{store.nome}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          store.faturamento >= 80 ? "default" : "secondary"
                        }
                      >
                        {store.faturamento}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={store.nps >= 80 ? "default" : "secondary"}
                      >
                        {store.nps}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={
                          store.supervisao >= 85 ? "default" : "secondary"
                        }
                      >
                        {store.supervisao}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {avg}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bonus Simulator */}
      <Card className="rounded-2xl shadow-card overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <Star className="h-5 w-5 text-amber-500" />
            Simulador de Bônus
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Sliders */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase">
                  Faturamento
                </label>
                <span className="text-sm font-bold text-primary">
                  {simulatedFaturamento[0]}%
                </span>
              </div>
              <Slider
                value={simulatedFaturamento}
                onValueChange={setSimulatedFaturamento}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase">NPS</label>
                <span className="text-sm font-bold text-primary">
                  {simulatedNps[0]}%
                </span>
              </div>
              <Slider
                value={simulatedNps}
                onValueChange={setSimulatedNps}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium uppercase">
                  Supervisão
                </label>
                <span className="text-sm font-bold text-primary">
                  {simulatedSupervisao[0]}%
                </span>
              </div>
              <Slider
                value={simulatedSupervisao}
                onValueChange={setSimulatedSupervisao}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          {/* Result */}
          <div className="rounded-2xl bg-gradient-to-br from-muted/50 to-muted p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground uppercase">
                  Média Geral
                </p>
                <p className="text-3xl font-bold">{averageScore.toFixed(0)}%</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground uppercase">
                  Bônus Estimado
                </p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(currentBonus)}
                </p>
              </div>
            </div>

            {/* Tier Badges */}
            <div className="mt-6 flex gap-3">
              <div
                className={`flex-1 rounded-xl p-3 text-center transition-all ${
                  currentTier === "ouro"
                    ? "bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-lg scale-105"
                    : "bg-muted/50"
                }`}
              >
                <Trophy className="h-6 w-6 mx-auto mb-1" />
                <p className="text-xs font-medium uppercase">Ouro</p>
                <p className="text-xs">≥90%</p>
              </div>
              <div
                className={`flex-1 rounded-xl p-3 text-center transition-all ${
                  currentTier === "prata"
                    ? "bg-gradient-to-r from-slate-300 to-slate-500 text-white shadow-lg scale-105"
                    : "bg-muted/50"
                }`}
              >
                <Medal className="h-6 w-6 mx-auto mb-1" />
                <p className="text-xs font-medium uppercase">Prata</p>
                <p className="text-xs">≥75%</p>
              </div>
              <div
                className={`flex-1 rounded-xl p-3 text-center transition-all ${
                  currentTier === "bronze"
                    ? "bg-gradient-to-r from-amber-600 to-amber-800 text-white shadow-lg scale-105"
                    : "bg-muted/50"
                }`}
              >
                <Award className="h-6 w-6 mx-auto mb-1" />
                <p className="text-xs font-medium uppercase">Bronze</p>
                <p className="text-xs">≥60%</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
