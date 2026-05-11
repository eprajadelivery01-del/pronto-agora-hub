import { useAdminRealtime } from "@/services/realtime";
import { ReactNode, useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  // Activate global realtime listeners (Deliveries and Drivers)
  useAdminRealtime();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("epj_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar onCollapsedChange={setSidebarCollapsed} />
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <AdminHeader title={title} subtitle={subtitle} />
        <main className="flex-1 p-4 md:p-6 animate-fade-in overflow-auto flex flex-col">
          <div className="flex-1">
            {children}
          </div>
          
          {/* Global Branding Footer */}
          <div className="w-full py-10 flex justify-center opacity-10 pointer-events-none select-none mt-auto">
            <p className="text-[10px] font-black tracking-[0.4em] text-muted-foreground uppercase">
              BONASOFT
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
