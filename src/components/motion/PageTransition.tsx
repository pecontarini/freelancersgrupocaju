import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
}

/** Routes that should skip the heavy transition (operator/public surfaces). */
const FAST_FADE_PATTERNS: RegExp[] = [
  /^\/checkin/,
  /^\/estacao-checkin/,
  /^\/checklist\//,
  /^\/checklist-corrections\//,
  /^\/contagem-utensilios/,
  /^\/confirm-shift\//,
];

function isFastRoute(pathname: string) {
  return FAST_FADE_PATTERNS.some((re) => re.test(pathname));
}

/**
 * CSS-only cinematic page transitions.
 * - Heavy routes: clip-reveal + fade + translate (480ms).
 * - Fast/operator routes: simple fade (160ms).
 * Respects prefers-reduced-motion.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayed, setDisplayed] = useState(children);
  const [animKey, setAnimKey] = useState(location.pathname);
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current === location.pathname) {
      // Same route — just keep children fresh (e.g. state change re-render)
      setDisplayed(children);
      return;
    }
    prevPath.current = location.pathname;
    // Re-mount with new key to retrigger CSS animation
    setDisplayed(children);
    setAnimKey(location.pathname);
  }, [location.pathname, children]);

  const fast = isFastRoute(location.pathname);

  return (
    <div
      key={animKey}
      className={cn(
        "min-h-screen w-full",
        fast ? "page-transition-fast" : "page-transition-cinematic"
      )}
    >
      {displayed}
    </div>
  );
}
