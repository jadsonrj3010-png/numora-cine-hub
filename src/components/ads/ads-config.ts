/**
 * Advertising configuration — Google AdSense.
 *
 * Fill `adsenseClient` with the publisher ID (ca-pub-XXXXXXXXXXXXXXXX).
 * While empty, nothing from Google loads and slots show a reserved frame (never fake ads).
 * Opening full-screen ad: enable "Auto ads" + "Vignette ads" in the AdSense dashboard
 * (Google's policy-compliant full-screen format). Custom splash screens with AdSense are forbidden.
 * Video: only pre-roll (before the movie); never mid-roll.
 */
export type AdPlacement = "home-banner" | "between-sections" | "pre-roll" | "mid-roll";

export const ADS_CONFIG = {
  provider: "adsense" as null | "adsense",
  adsenseClient: "ca-pub-6637792517121897",
  showReservedSlots: true,
  slots: {
    "home-banner": { id: "" }, // data-ad-slot (opcional; vazio = anúncio responsivo automático)
    "between-sections": { id: "" },
    "pre-roll": { vastTag: "" },
    "mid-roll": { vastTag: "", everyMinutes: 0 }, // desativado: sem anúncios durante o filme
  },
};

export const adsEnabled = () => ADS_CONFIG.provider === "adsense" && /^ca-pub-\d{10,20}$/.test(ADS_CONFIG.adsenseClient);
