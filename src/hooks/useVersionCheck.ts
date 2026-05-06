import { useEffect, useRef, useState } from "react";

declare const __BUILD_ID__: string;

const CURRENT_BUILD_ID =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

const POLL_MS = 60_000;
const AUTO_RELOAD_AFTER_MS = 5 * 60_000; // 5min ignorado → recarrega quando aba ficar oculta

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteBuildId, setRemoteBuildId] = useState<string | null>(null);
  const detectedAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { buildId?: string };
        if (cancelled || !data?.buildId) return;
        if (data.buildId !== CURRENT_BUILD_ID) {
          if (!detectedAtRef.current) detectedAtRef.current = Date.now();
          setRemoteBuildId(data.buildId);
          setUpdateAvailable(true);
        }
      } catch {
        // silencioso — rede instável não deve causar barulho
      }
    };

    check();
    const interval = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
      else if (
        updateAvailable &&
        detectedAtRef.current &&
        Date.now() - detectedAtRef.current > AUTO_RELOAD_AFTER_MS
      ) {
        // aba escondida há tempo suficiente: recarrega sem incomodar
        reloadWithBust(remoteBuildId);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [updateAvailable, remoteBuildId]);

  const reloadNow = () => reloadWithBust(remoteBuildId);

  return {
    updateAvailable,
    currentBuildId: CURRENT_BUILD_ID,
    remoteBuildId,
    reloadNow,
  };
}

function reloadWithBust(buildId: string | null) {
  try {
    // Limpa caches do service worker (se houver) antes de recarregar
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  } catch {}
  const url = new URL(window.location.href);
  url.searchParams.set("v", buildId ?? String(Date.now()));
  window.location.replace(url.toString());
}
