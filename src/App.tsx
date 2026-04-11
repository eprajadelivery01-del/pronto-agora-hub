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
import DashboardPage from "./pages/DashboardPage";
import DeliveriesPage from "./pages/DeliveriesPage";
import MapPage from "./pages/MapPage";
import UsersPage from "./pages/UsersPage";
import CustomersPage from "./pages/CustomersPage";
import CompaniesPage from "./pages/CompaniesPage";
import DriversPage from "./pages/DriversPage";
import RegionsPage from "./pages/RegionsPage";
import OccurrencesPage from "./pages/OccurrencesPage";
import ReviewsPage from "./pages/ReviewsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import SystemLogsPage from "./pages/SystemLogsPage";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import NotFound from "./pages/NotFound";
import BusinessLoginPage from "./pages/BusinessLoginPage";
import BusinessHomePage from "./pages/business/BusinessHomePage";
import BusinessProductsPage from "./pages/business/BusinessProductsPage";
import BusinessProfilePage from "./pages/business/BusinessProfilePage";

import ChatPage from "./pages/ChatPage";


import ScrollToTop from "@/components/shared/ScrollToTop";
import { PageTransition } from "@/components/shared/PageTransition";

import BusinessOrdersPage from "./pages/business/BusinessOrdersPage";
import BusinessFinancePage from "./pages/business/BusinessFinancePage";
import BusinessHistoryPage from "./pages/business/BusinessHistoryPage";
import BusinessCustomersPage from "./pages/business/BusinessCustomersPage";

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
                
                {/* Lojista Routes */}
                <Route path="/business" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessHomePage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/orders" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessOrdersPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/products" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessProductsPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/finance" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessFinancePage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/customers" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessCustomersPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/history" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessHistoryPage /></ProtectedRoute></PageTransition>} />
                <Route path="/business/profile" element={<PageTransition><ProtectedRoute requiredRole="company"><BusinessProfilePage /></ProtectedRoute></PageTransition>} />
                
                <Route path="/" element={<Navigate to="/admin" replace />} />

                <Route path="/admin" element={<PageTransition><ProtectedRoute requiredRole="admin"><DashboardPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/deliveries" element={<PageTransition><ProtectedRoute requiredRole="admin"><DeliveriesPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/chat" element={<PageTransition><ProtectedRoute requiredRole="admin"><ChatPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/map" element={<PageTransition><ProtectedRoute requiredRole="admin"><MapPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/users" element={<PageTransition><ProtectedRoute requiredRole="admin"><UsersPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/customers" element={<PageTransition><ProtectedRoute requiredRole="admin"><CustomersPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/companies" element={<PageTransition><ProtectedRoute requiredRole="admin"><CompaniesPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/drivers" element={<PageTransition><ProtectedRoute requiredRole="admin"><DriversPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/regions" element={<PageTransition><ProtectedRoute requiredRole="admin"><RegionsPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/occurrences" element={<PageTransition><ProtectedRoute requiredRole="admin"><OccurrencesPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/reviews" element={<PageTransition><ProtectedRoute requiredRole="admin"><ReviewsPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/reports" element={<PageTransition><ProtectedRoute requiredRole="admin"><ReportsPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/settings" element={<PageTransition><ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/logs" element={<PageTransition><ProtectedRoute requiredRole="admin"><SystemLogsPage /></ProtectedRoute></PageTransition>} />
                <Route path="/admin/profile" element={<PageTransition><ProtectedRoute requiredRole="admin"><ProfilePage /></ProtectedRoute></PageTransition>} />

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
