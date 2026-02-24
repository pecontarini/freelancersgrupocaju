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
import NotFound from "./pages/NotFound";

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
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Index />
                    </ProtectedRoute>
                  }
                />
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
