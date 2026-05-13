import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { UnidadeProvider } from "@/contexts/UnidadeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ConfirmShift from "./pages/ConfirmShift";
import DailyChecklist from "./pages/DailyChecklist";
import ChecklistCorrections from "./pages/ChecklistCorrections";
import FreelancerCheckin from "./pages/FreelancerCheckin";
import FreelancerCheckinDemo from "./pages/FreelancerCheckinDemo";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import LiquidGlassDemo from "./pages/LiquidGlassDemo";
import LiquidGlassSimulator from "./pages/LiquidGlassSimulator";
import ContagemUtensilios from "./pages/ContagemUtensilios";
import Agenda from "./pages/Agenda";
import EstacaoCheckin from "./pages/EstacaoCheckin";
import MetasPage from "./pages/painel/Metas";
import MetasVariaveisPage from "./pages/painel/MetasVariaveis";
import AprovarEscala from "./pages/AprovarEscala";
import AtualizarPix from "./pages/AtualizarPix";
import CadastrosPendentes from "./pages/CadastrosPendentes";
import EscalaDraft from "./pages/escalas/EscalaDraft";
import Seguranca from "./pages/perfil/Seguranca";
import { PageTransition } from "@/components/motion";
import { VersionUpdateBanner } from "@/components/VersionUpdateBanner";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <BrowserRouter>
          <AuthProvider>
            <UnidadeProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <VersionUpdateBanner />
              <PageTransition>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/confirm-shift/:scheduleId"
                  element={<ConfirmShift />}
                />
                <Route
                  path="/checklist/:accessToken"
                  element={<DailyChecklist />}
                />
                <Route
                  path="/checklist-corrections/:responseId/:accessToken"
                  element={<ChecklistCorrections />}
                />
                <Route path="/checkin" element={<FreelancerCheckin />} />
                <Route path="/checkin-demo" element={<FreelancerCheckinDemo />} />
                <Route path="/estacao-checkin" element={<EstacaoCheckin />} />
                <Route path="/aprovar-escala/:token" element={<AprovarEscala />} />
                <Route path="/atualizar-pix/:token" element={<AtualizarPix />} />
                <Route path="/pessoas/cadastros-pendentes" element={<ProtectedRoute><CadastrosPendentes /></ProtectedRoute>} />
                <Route path="/contagem-utensilios" element={<ProtectedRoute><ContagemUtensilios /></ProtectedRoute>} />
                <Route path="/contagem-utensilios/:lojaId" element={<ContagemUtensilios />} />
                <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
                <Route path="/painel/metas" element={<ProtectedRoute><MetasPage /></ProtectedRoute>} />
                <Route path="/painel/metas-variaveis" element={<ProtectedRoute><MetasVariaveisPage /></ProtectedRoute>} />
                <Route path="/escalas/draft/:draftId" element={<ProtectedRoute><EscalaDraft /></ProtectedRoute>} />
                <Route path="/perfil/seguranca" element={<ProtectedRoute><Seguranca /></ProtectedRoute>} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
                <Route path="/liquid-glass" element={<LiquidGlassDemo />} />
                <Route path="/liquid-glass-simulator" element={<LiquidGlassSimulator />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </PageTransition>
              </TooltipProvider>
            </UnidadeProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
