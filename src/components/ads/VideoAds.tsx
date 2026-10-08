import { useEffect } from "react";
import { ADS_CONFIG, adsEnabled } from "./ads-config";

/**
 * Pre-roll ad before playback (the ONLY video ad placement — no ads during the movie).
 * With no ad network connected it completes immediately.
 * Hook a VAST/IMA SDK here using ADS_CONFIG.slots["pre-roll"].vastTag.
 */
export function PreRollAd({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    if (!adsEnabled() || !ADS_CONFIG.slots["pre-roll"].vastTag) onComplete();
  }, [onComplete]);
  return null;
}

/** Mid-roll ads are disabled by product decision: never interrupt the movie. */
export function shouldPlayMidRoll(_currentSeconds: number, _lastBreakSeconds: number) {
  return false;
}
