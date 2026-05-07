// Build trigger: 2026-04-13 13:12 - Autocomplete and Address Memory Final
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { CityProvider } from "@/contexts/CityContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import LoginPage from "./pages/LoginPage";
import InvitePage from "./pages/InvitePage";
import ProfilePage from "./pages/ProfilePage";
import SystemLogsPage from "./pages/SystemLogsPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import LegalPage from "./pages/LegalPage";
import NotFound from "./pages/NotFound";
import BusinessLoginPage from "./pages/BusinessLoginPage";
import BusinessHomePage from "./pages/business/BusinessHomePage";
import BusinessProductsPage from "./pages/business/BusinessProductsPage";
import BusinessProfilePage from "./pages/business/BusinessProfilePage";

import BusinessCustomersPage from "./pages/business/BusinessCustomersPage";
import ScrollToTop from "@/components/shared/ScrollToTop";
import { PageTransition } from "@/components/shared/PageTransition";

import BusinessOrdersPage from "./pages/business/BusinessOrdersPage";
import BusinessFinancePage from "./pages/business/BusinessFinancePage";
import BusinessHistoryPage from "./pages/business/BusinessHistoryPage";
import BusinessCouponsPage from "./pages/business/BusinessCouponsPage";

const queryClient = new QueryClient();

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <CityProvider>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
                <Route path="/login/business" element={<PageTransition><BusinessLoginPage /></PageTransition>} />
                <Route path="/invite/:token" element={<PageTransition><InvitePage /></PageTransition>} />
                <Route path="/pending-approval" element={<PageTransition><PendingApprovalPage /></PageTransition>} />
                <Route path="/terms" element={<PageTransition><LegalPage /></PageTransition>} />
                <Route path="/privacy" element={<PageTransition><LegalPage /></PageTransition>} />
                
                {/* Lojista Routes */}
                <Route path="/business" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessHomePage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/orders" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessOrdersPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/products" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessProductsPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/finance" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessFinancePage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/customers" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessCustomersPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/history" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessHistoryPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/coupons" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessCouponsPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/profile" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessProfilePage /></ProtectedRoute></PageTransition>} />
                
                <Route path="/" element={<Navigate to="/business" replace />} />

                <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
              </Routes>
            </AuthProvider>
          </CityProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;