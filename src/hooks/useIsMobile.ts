import { useState, useEffect } from "react";

let isMobileGlobal = window.innerWidth < 640;
const listeners = new Set<(isMobile: boolean) => void>();

let resizeListenerAttached = false;
function handleResize() {
  const newIsMobile = window.innerWidth < 640;
  if (isMobileGlobal !== newIsMobile) {
    isMobileGlobal = newIsMobile;
    listeners.forEach(listener => listener(isMobileGlobal));
  }
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(isMobileGlobal);
  
  useEffect(() => {
    listeners.add(setIsMobile);
    if (!resizeListenerAttached) {
      window.addEventListener("resize", handleResize);
      resizeListenerAttached = true;
    }
    return () => {
      listeners.delete(setIsMobile);
      if (listeners.size === 0) {
        window.removeEventListener("resize", handleResize);
        resizeListenerAttached = false;
      }
    };
  }, []);
  
  return isMobile;
}

