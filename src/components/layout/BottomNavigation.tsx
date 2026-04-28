import {
  ClipboardCheck,
  User,
  Menu,
  Package,
  Sun,
  Moon,
  Calendar,
  BarChart2,
  LayoutGrid,
  Users,
} from "lucide-react";
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
import cajuparLogoDark from "@/assets/cajupar-logo-dark.png";
import cajuparLogoLight from "@/assets/cajupar-logo-light.png";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const navItems = [
  { id: "unitarios-gerentes", label: "Unitários", icon: LayoutGrid },
  { id: "gestao-pessoas", label: "Pessoas", icon: Users },
  { id: "diagnostico", label: "Auditoria", icon: ClipboardCheck },
  { id: "agenda-lider", label: "Agenda", icon: Calendar },
  { id: "painel", label: "Painel", icon: BarChart2 },
];

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const { signOut } = useAuth();
  const { isAdmin, isChefeSetor, profile } = useUserProfile();
  const { theme, setTheme } = useTheme();
  const { data: confirmations } = usePendingConfirmations();
  const escalaPending = (confirmations?.pending ?? 0) + (confirmations?.denied ?? 0);

  const visibleNavItems = isChefeSetor
    ? navItems.filter((i) => i.id === "gestao-pessoas")
    : navItems;

  return (
    <>
      {/* Mobile Header — Vision Glass */}
      <header className="vision-glass-header fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 md:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={theme === "dark" ? cajuparLogoLight : cajuparLogoDark}
            alt="CajuPAR"
            className="h-8 w-auto"
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
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
              <div className="space-y-2 border-t pt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => onTabChange("agenda-lider")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Agenda do Líder
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => onTabChange("utensilios")}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Utensílios
                </Button>
                {isAdmin && (
                  <>
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
                  </>
                )}
              </div>
              <div className="border-t pt-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tema</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
              </div>
              <div className="pt-2">
                <Button variant="destructive" className="w-full" onClick={signOut}>
                  Sair
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Floating Vision Glass Dock */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <nav
          className="vision-dock pointer-events-auto mx-3 flex items-center justify-between gap-1 px-2 py-2"
          aria-label="Navegação principal"
        >
          {visibleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            const showBadge = item.id === "gestao-pessoas" && escalaPending > 0;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                data-active={isActive}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                className={cn("vision-dock-item flex-shrink-0", isActive && "flex-1")}
              >
                <span className="relative flex items-center justify-center">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                  {showBadge && (
                    <span
                      className={cn(
                        "absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center",
                        "rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground",
                        "ring-2 ring-background/80",
                      )}
                    >
                      {escalaPending}
                    </span>
                  )}
                </span>
                <span className="vision-dock-label">{item.label}</span>
              </button>
            );
          })}

          {/* Profile button */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Perfil"
                className="vision-dock-item flex-shrink-0"
              >
                <span className="flex items-center justify-center">
                  <User className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto rounded-t-3xl">
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
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 rounded-2xl"
                  onClick={() => onTabChange("agenda-lider")}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Agenda do Líder
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-12 rounded-2xl"
                  onClick={() => onTabChange("utensilios")}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Utensílios
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12 rounded-2xl"
                      onClick={() => onTabChange("configuracoes")}
                    >
                      Configurações
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start h-12 rounded-2xl"
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
                    className="h-10 w-10 rounded-full"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                  </Button>
                </div>
                <Button variant="destructive" className="w-full h-12 rounded-2xl" onClick={signOut}>
                  Sair da Conta
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </>
  );
}
