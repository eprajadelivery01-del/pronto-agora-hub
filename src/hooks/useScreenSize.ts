import { useState, useEffect } from "react";

export interface ScreenSize {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  orientation: "portrait" | "landscape";
}

/**
 * Custom hook to dynamically measure screen dimensions and set CSS --vh variable
 * for exact 100% viewport height calculations across mobile and desktop devices.
 */
export function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>(() => {
    const width = typeof window !== "undefined" ? window.innerWidth : 1200;
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    return {
      width,
      height,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024 && width < 1440,
      isLargeDesktop: width >= 1440,
      orientation: width >= height ? "landscape" : "portrait",
    };
  });

  useEffect(() => {
    function handleResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Update CSS custom property --vh for exact dynamic viewport height
      const vh = height * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);

      setScreenSize({
        width,
        height,
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isDesktop: width >= 1024 && width < 1440,
        isLargeDesktop: width >= 1440,
        orientation: width >= height ? "landscape" : "portrait",
      });
    }

    // Initial setup
    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return screenSize;
}
