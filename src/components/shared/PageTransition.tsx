import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const { pathname } = useLocation();

  return (
    <div
      key={pathname}
      className="page-transition-wrapper"
    >
      {children}
    </div>
  );
}
