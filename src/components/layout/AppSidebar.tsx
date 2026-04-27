import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Wallet,
  
  Settings,
  Building2,
  LogOut,
  User,
  ChevronRight,
  ClipboardCheck,
  AlertTriangle,
  BarChart2,
  Users,
  LayoutGrid,
  Calendar,
} from "lucide-react";
import { usePendingConfirmations } from "@/hooks/usePendingConfirmations";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useTheme } from "next-themes";
import cajuparLogoDark from "@/assets/cajupar-logo-dark.png";
import cajuparLogoLight from "@/assets/e532899c-a0de-44cf-aabb-b3978367f3d7.png";
import cajuparSymbol from "@/assets/cajupar-symbol.png";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  {
    title: "UNITÁRIOS GERENTES",
    id: "unitarios-gerentes",
    icon: LayoutGrid,
    description: "Budgets, CMV e Utensílios",
  },
  {
    title: "GESTÃO DE PESSOAS",
    id: "gestao-pessoas",
    icon: Users,
    description: "Escalas e Presença Freelancers",
  },
  {
    title: "DIAGNÓSTICO AUDITORIA",
    id: "diagnostico",
    icon: ClipboardCheck,
    description: "Análise de não conformidades",
  },
  {
    title: "AGENDA DO LÍDER",
    id: "agenda-lider",
    icon: Calendar,
    description: "Chat IA, missões e planos de ação",
  },
];

const adminMenuItems = [
  {
    title: "DORES DA OPERAÇÃO",
    id: "cx",
    icon: AlertTriangle,
    description: "Gestão centralizada de CX",
  },
  {
    title: "CONFIGURAÇÕES",
    id: "configuracoes",
    icon: Settings,
    description: "Configurar sistema",
  },
  {
    title: "VISÃO REDE",
    id: "rede",
    icon: Building2,
    description: "Consolidado da rede",
  },
];

const gestaoMenuItems = [
  {
    title: "PAINEL DE INDICADORES",
    id: "painel",
    icon: BarChart2,
    description: "Resultados e indicadores da rede",
  },
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, isOperator, isGerenteUnidade, isChefeSetor, unidades, profile } = useUserProfile();
  const canSeeGestao = (isAdmin || isOperator || isGerenteUnidade) && !isChefeSetor;
  const { state } = useSidebar();
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? cajuparLogoLight : cajuparLogoDark;
  const isCollapsed = state === "collapsed";
  const { data: confirmations } = usePendingConfirmations();
  const escalaPending = (confirmations?.pending ?? 0) + (confirmations?.denied ?? 0);

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  return (
    <Sidebar collapsible="icon" className="glass-sidebar bg-sidebar/70">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex flex-col items-center justify-center gap-2">
          {isCollapsed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden">
              <img src={cajuparSymbol} alt="CajuPAR" className="h-8 w-8 object-contain" />
            </div>
          ) : (
            <>
              <div className="w-full overflow-hidden rounded-xl">
                <img
                  src={logoSrc}
                  alt="CajuPAR"
                  className="h-auto w-full object-contain"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Portal da Liderança
              </span>
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase text-xs tracking-wider">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {(isChefeSetor
                ? menuItems.filter((i) => i.id === "gestao-pessoas")
                : menuItems
              ).map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => handleTabClick(item.id)}
                    isActive={activeTab === item.id}
                    tooltip={item.title}
                    className="group transition-all duration-200 relative"
                  >
                    <item.icon className="h-4 w-4 transition-colors group-hover:text-primary" />
                    <span className="font-medium">{item.title}</span>
                    {item.id === "gestao-pessoas" && escalaPending > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1">
                        {escalaPending}
                      </span>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {canSeeGestao && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="uppercase text-xs tracking-wider">
                Gestão
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {gestaoMenuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => handleTabClick(item.id)}
                        isActive={activeTab === item.id}
                        tooltip={item.title}
                        className="group transition-all duration-200"
                      >
                        <item.icon className="h-4 w-4 transition-colors group-hover:text-primary" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {isAdmin && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="uppercase text-xs tracking-wider">
                Administração
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminMenuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => handleTabClick(item.id)}
                        isActive={activeTab === item.id}
                        tooltip={item.title}
                        className="group transition-all duration-200"
                      >
                        <item.icon className="h-4 w-4 transition-colors group-hover:text-primary" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border pt-4 space-y-2">
        <div className="flex justify-center">
          <ThemeToggle />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 px-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              {!isCollapsed && (
                <div className="flex flex-1 flex-col items-start text-left">
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {profile?.full_name || user?.email?.split("@")[0]}
                  </span>
                    <span className="text-xs text-muted-foreground">
                      {isAdmin ? "Administrador" : isChefeSetor ? "Chefe de Setor" : "Gerente"}
                    </span>
                </div>
              )}
              {!isCollapsed && <ChevronRight className="h-4 w-4 ml-auto" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="right"
            className="w-56 bg-popover"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">
                {profile?.full_name || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
