import { DollarSign } from "lucide-react";

export function AppHeader() {
  return (
    <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-primary">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">FreelancerPay</h1>
            <p className="text-xs text-muted-foreground">Gestão de Pagamentos</p>
          </div>
        </div>
      </div>
    </header>
  );
}
