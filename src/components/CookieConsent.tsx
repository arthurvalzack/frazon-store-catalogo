import { useEffect, useState } from "react";
import {
  acceptMarketingCookies,
  getMarketingConsent,
  OPEN_COOKIE_PREFERENCES_EVENT,
  rejectMarketingCookies,
  trackPageView,
  type MarketingConsent,
} from "@/lib/metaPixel";

export default function CookieConsent() {
  const [consent, setConsent] = useState<MarketingConsent>(() =>
    getMarketingConsent()
  );
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    const open = () => setPreferencesOpen(true);
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open);
  }, []);

  function handleAccept(): void {
    acceptMarketingCookies();
    setConsent("accepted");
    setPreferencesOpen(false);

    // O rastreador já pode ter executado antes do consentimento.
    // Portanto, registramos a página atual imediatamente após aceitar.
    trackPageView(`${window.location.pathname}${window.location.search}`);
  }

  function handleReject(): void {
    rejectMarketingCookies();
    setConsent("rejected");
    setPreferencesOpen(false);
  }

  if (consent !== null && !preferencesOpen) {
    return null;
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-3xl border border-noir-200 bg-white p-5 shadow-2xl sm:p-6"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h2
            id="cookie-consent-title"
            className="mb-2 text-sm font-semibold uppercase tracking-wider text-noir-900"
          >
            Preferências de cookies
          </h2>

          <p
            id="cookie-consent-description"
            className="text-sm leading-relaxed text-noir-600"
          >
            Utilizamos cookies necessários para o funcionamento do site e,
            mediante sua autorização, cookies de marketing para medir campanhas
            e melhorar nossos anúncios.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleReject}
            className="min-h-11 border border-noir-900 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-noir-900 transition-colors hover:bg-noir-100 focus:outline-none focus:ring-2 focus:ring-noir-900 focus:ring-offset-2"
          >
            Rejeitar
          </button>

          <button
            type="button"
            onClick={handleAccept}
            className="min-h-11 bg-noir-900 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-noir-700 focus:outline-none focus:ring-2 focus:ring-noir-900 focus:ring-offset-2"
          >
            Aceitar
          </button>
        </div>
      </div>
    </aside>
  );
}