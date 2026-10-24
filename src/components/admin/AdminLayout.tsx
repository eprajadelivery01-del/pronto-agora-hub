import { useAdminRealtime } from "@/services/realtime";
import { ReactNode, useState, useEffect } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  fullHeight?: boolean;
}

export function AdminLayout({ children, title, subtitle, fullHeight }: AdminLayoutProps) {
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
    <div className={cn("flex bg-background font-sans", fullHeight ? "h-screen max-h-screen overflow-hidden" : "min-h-screen")}>
      <AdminSidebar onCollapsedChange={setSidebarCollapsed} />
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", fullHeight && "h-full max-h-full overflow-hidden")}>
        <AdminHeader title={title} subtitle={subtitle} />
        <main className={cn(
          "flex-1 animate-fade-in flex flex-col min-h-0",
          fullHeight ? "overflow-hidden p-0 h-full" : "overflow-auto p-4 md:p-6"
        )}>
          <div className={cn("flex-1 min-h-0", fullHeight && "flex flex-col h-full w-full")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
