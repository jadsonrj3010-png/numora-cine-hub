import { useEffect, useRef } from "react";
import { ADS_CONFIG, adsEnabled, type AdPlacement } from "./ads-config";

declare global { interface Window { adsbygoogle?: unknown[] } }

/** AdSense display slot ("Publicidade"). Shows a reserved frame until a publisher ID is set. */
export function AdSlot({ placement }: { placement: Extract<AdPlacement, "home-banner" | "between-sections"> }) {
  const pushed = useRef(false);
  const on = adsEnabled();
  useEffect(() => {
    if (!on || pushed.current) return;
    pushed.current = true;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* bloqueador de anúncios */ }
  }, [on]);
  if (!on && !ADS_CONFIG.showReservedSlots) return null;
  const tall = placement === "home-banner";
  const slot = ADS_CONFIG.slots[placement].id;
  return (
    <div className="mx-4 mt-7 lg:mx-8" data-ad-placement={placement}>
      <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Publicidade</p>
      {on ? (
        <ins className="adsbygoogle block w-full" style={{ display: "block", minHeight: tall ? 100 : 60 }}
          data-ad-client={ADS_CONFIG.adsenseClient} {...(slot ? { "data-ad-slot": slot } : {})}
          data-ad-format="auto" data-full-width-responsive="true" />
      ) : (
        <div className={`grid w-full place-items-center rounded-lg border border-dashed border-border bg-card/40 text-xs text-muted-foreground ${tall ? "h-24 sm:h-28" : "h-16 sm:h-24"}`}>
          Espaço reservado para anúncio
        </div>
      )}
    </div>
  );
}
