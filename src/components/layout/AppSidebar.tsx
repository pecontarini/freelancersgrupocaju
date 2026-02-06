import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  Package,
  Settings,
  Building2,
  LogOut,
  User,
  ChevronRight,
  ClipboardCheck,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

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
import grupoCajuLogo from "@/assets/grupo-caju-logo.png";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  {
    title: "BUDGETS GERENCIAIS",
    id: "budgets",
    icon: Wallet,
    description: "Controle diário de gastos",
  },
  {
    title: "REMUNERAÇÃO VARIÁVEL",
    id: "remuneracao",
    icon: TrendingUp,
    description: "Performance e metas",
  },
  {
    title: "DIAGNÓSTICO AUDITORIA",
    id: "diagnostico",
    icon: ClipboardCheck,
    description: "Análise de não conformidades",
  },
  {
    title: "PLANO DE AÇÃO",
    id: "planoacao",
    icon: AlertTriangle,
    description: "Correção de não conformidades",
  },
  {
    title: "PERFORMANCE LIDERANÇA",
    id: "performance",
    icon: BarChart3,
    description: "Diagnóstico por responsável",
  },
  {
    title: "CMV (UNITÁRIOS)",
    id: "cmv",
    icon: Package,
    description: "Controle de insumos",
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

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const { user, signOut } = useAuth();
  const { isAdmin, unidades, profile } = useUserProfile();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex flex-col items-center justify-center gap-2">
          {isCollapsed ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="font-display text-sm font-bold">C</span>
            </div>
          ) : (
            <>
              <div className="w-full overflow-hidden rounded-xl">
                <img
                  src={grupoCajuLogo}
                  alt="Grupo Caju"
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
              {menuItems.map((item) => (
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

      <SidebarFooter className="border-t border-sidebar-border pt-4">
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
                    {isAdmin ? "Administrador" : "Gerente"}
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
