import { Wallet, TrendingUp, ClipboardCheck, User, Menu, Package, FileCheck, CalendarClock, Sun, Moon } from "lucide-react";
import { usePendingConfirmations } from "@/hooks/usePendingConfirmations";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTheme } from "next-themes";
import grupoCajuLogo from "@/assets/grupo-caju-logo.png";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "budgets", label: "Budgets", icon: Wallet },
  { id: "remuneracao", label: "Bônus", icon: TrendingUp },
  { id: "diagnostico", label: "Auditoria", icon: ClipboardCheck },
  { id: "escalas", label: "Escalas", icon: CalendarClock },
];

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const { signOut } = useAuth();
  const { isAdmin, isChefeSetor, profile } = useUserProfile();
  const { theme, setTheme } = useTheme();
  const { data: confirmations } = usePendingConfirmations();
  const escalaPending = (confirmations?.pending ?? 0) + (confirmations?.denied ?? 0);

  const visibleNavItems = isChefeSetor
    ? navItems.filter((i) => i.id === "escalas")
    : navItems;

  return (
    <>
      {/* Mobile Header with Logo and Menu */}
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur-sm px-4 md:hidden">
        <div className="flex items-center gap-2">
          <img src={grupoCajuLogo} alt="Grupo Caju" className="h-8 w-auto" />
        </div>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {profile?.full_name || "Usuário"}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="text-sm text-muted-foreground">
                {isAdmin ? "Administrador" : isChefeSetor ? "Chefe de Setor" : "Gerente de Unidade"}
              </div>
              
              {isAdmin && (
                <div className="space-y-2 border-t pt-4">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => onTabChange("cx")}
                  >
                    Dores da Operação
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => onTabChange("configuracoes")}
                  >
                    Configurações
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => onTabChange("rede")}
                  >
                    Visão Rede
                  </Button>
                </div>
              )}
              
              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tema</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
              <div className="pt-2">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={signOut}
                >
                  Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm md:hidden safe-area-bottom">
        <div className="flex h-16 items-stretch justify-around">
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors min-h-[56px]",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                  {item.id === "escalas" && escalaPending > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-0.5">
                      {escalaPending}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  isActive && "font-bold"
                )}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-1 h-1 w-8 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
          
          {/* Profile button */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground min-h-[56px]">
                <User className="h-5 w-5" />
                <span className="text-[10px] font-medium uppercase tracking-wide">
                  Perfil
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <div>{profile?.full_name || "Usuário"}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {isAdmin ? "Administrador" : isChefeSetor ? "Chefe de Setor" : "Gerente"}
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-3 pb-8">
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12"
                      onClick={() => onTabChange("cx")}
                    >
                      Dores da Operação
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12"
                      onClick={() => onTabChange("configuracoes")}
                    >
                      Configurações
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12"
                      onClick={() => onTabChange("rede")}
                    >
                      Visão Rede
                    </Button>
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tema</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  className="w-full h-12"
                  onClick={signOut}
                >
                  Sair da Conta
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </>
  );
}
