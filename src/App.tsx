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
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import LiquidGlassDemo from "./pages/LiquidGlassDemo";
import LiquidGlassSimulator from "./pages/LiquidGlassSimulator";
import ContagemUtensilios from "./pages/ContagemUtensilios";
import Agenda from "./pages/Agenda";

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
                <Route path="/contagem-utensilios" element={<ProtectedRoute><ContagemUtensilios /></ProtectedRoute>} />
                <Route path="/contagem-utensilios/:lojaId" element={<ContagemUtensilios />} />
                <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
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
              </TooltipProvider>
            </UnidadeProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
