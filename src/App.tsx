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
import ChatPage from "./pages/ChatPage";
import BusinessFinancePage from "./pages/business/BusinessFinancePage";
import BusinessHistoryPage from "./pages/business/BusinessHistoryPage";
import BusinessCouponsPage from "./pages/business/BusinessCouponsPage";
import MerchantInvoicesPage from "./pages/business/MerchantInvoicesPage";
import { GlobalChatListener } from "@/hooks/useGlobalChatNotifications";
import { useOrderAlerts } from "@/hooks/useOrderAlerts";
import { SoundEnabler } from "@/components/shared/SoundEnabler";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Admin Panel Pages (Missing in this App.tsx)
import DashboardPage from "./pages/DashboardPage";
import DeliveriesPage from "./pages/DeliveriesPage";
import CompaniesPage from "./pages/CompaniesPage";
import DriversPage from "./pages/DriversPage";
import RegionsPage from "./pages/RegionsPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import ReviewsPage from "./pages/ReviewsPage";
import SettingsPage from "./pages/SettingsPage";
import MapPage from "./pages/MapPage";
import OccurrencesPage from "./pages/OccurrencesPage";
import CustomersPage from "./pages/CustomersPage";

const OrderAlertsListener = () => {
  useOrderAlerts();
  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <SoundEnabler />
          <BrowserRouter>
            <ScrollToTop />
            <CityProvider>
              <AuthProvider>
                <GlobalChatListener />
                <OrderAlertsListener />
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
                  <Route path="/business/invoices" element={<PageTransition><ProtectedRoute requiredRole="company"><MerchantInvoicesPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/business/customers" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessCustomersPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/business/history" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessHistoryPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/business/coupons" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessCouponsPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/business/chat" element={<PageTransition><ProtectedRoute requiredRole="company"><ChatPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/business/profile" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessProfilePage /></ProtectedRoute></PageTransition>} />
                  
                  {/* Admin Panel Routes (Restored) */}
                  <Route path="/admin" element={<PageTransition><ProtectedRoute requiredRole="admin"><DashboardPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/deliveries" element={<PageTransition><ProtectedRoute requiredRole="admin"><DeliveriesPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/corridas" element={<Navigate to="/admin/deliveries" replace />} />
                  <Route path="/admin/companies" element={<PageTransition><ProtectedRoute requiredRole="admin"><CompaniesPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/drivers" element={<PageTransition><ProtectedRoute requiredRole="admin"><DriversPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/regions" element={<PageTransition><ProtectedRoute requiredRole="admin"><RegionsPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/reports" element={<PageTransition><ProtectedRoute requiredRole="admin"><ReportsPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/users" element={<PageTransition><ProtectedRoute requiredRole="admin"><UsersPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/reviews" element={<PageTransition><ProtectedRoute requiredRole="admin"><ReviewsPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/settings" element={<PageTransition><ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/map" element={<PageTransition><ProtectedRoute requiredRole="admin"><MapPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/occurrences" element={<PageTransition><ProtectedRoute requiredRole="admin"><OccurrencesPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/customers" element={<PageTransition><ProtectedRoute requiredRole="admin"><CustomersPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/chat" element={<PageTransition><ProtectedRoute requiredRole="admin"><ChatPage /></ProtectedRoute></PageTransition>} />
                  <Route path="/admin/profile" element={<PageTransition><ProtectedRoute requiredRole="admin"><ProfilePage /></ProtectedRoute></PageTransition>} />
                  
                  <Route path="/" element={<Navigate to="/business" replace />} />

                  <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
                </Routes>
              </AuthProvider>
            </CityProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;