import { useEffect, useState } from 'react';
import { Camera, Lock, MessageCircle } from 'lucide-react';
import { getSettings, loadCatalogData, normalizeWhatsapp } from '@/lib/data';
import type { SiteSettings } from '@/types';

export default function Footer() {
  const [settings, setSettings] = useState<SiteSettings>(getSettings());

  useEffect(() => {
    let mounted = true;
    loadCatalogData().then(data => {
      if (mounted) setSettings(data.settings);
    });
    return () => { mounted = false; };
  }, []);

  const whatsappUrl = `https://wa.me/${normalizeWhatsapp(settings.whatsappNumber)}`;

  return (
    <footer className="bg-noir-900 text-white">
      <div className="mx-auto max-w-[860px] border-t border-white/10 px-6 py-7 text-center sm:px-11">
        <h2 className="text-3xl font-black uppercase leading-none tracking-[0.18em] sm:text-4xl">
          Frazon
        </h2>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.42em] text-white/75">Store</p>

        <div className="mt-7 flex flex-col items-center justify-center gap-4 text-xs font-black uppercase tracking-[0.08em] sm:flex-row sm:gap-8">
          {settings.instagramUrl && (
            <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white transition-opacity hover:opacity-70">
              <Camera className="h-5 w-5" />
              Instagram
            </a>
          )}
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-white/30 text-white transition-opacity hover:opacity-70 sm:border-l sm:pl-8">
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </a>
          <a href="/admin" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border-white/30 text-white transition-opacity hover:opacity-70 sm:border-l sm:pl-8">
            <Lock className="h-5 w-5" />
            &Aacute;rea administrativa
          </a>
        </div>

        <p className="mt-7 text-[11px] text-white/45">
          &copy; {new Date().getFullYear()} {settings.storeName}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
