import { useEffect, useState } from 'react';
import { Camera, Lock, MessageCircle } from 'lucide-react';
import { getSettings, loadCatalogData, normalizeWhatsapp } from '@/lib/data';
import type { SiteSettings } from '@/types';

const INSTAGRAM_URL = 'https://www.instagram.com/frazonstore/';

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
    <footer className="w-full bg-black text-white">
      <div className="mx-auto max-w-7xl px-3 pb-5 pt-6 text-center sm:px-8 sm:pt-8 lg:px-10">
        <img src="/brand/frazon-logo.png" alt={settings.storeName} className="mx-auto h-[46px] w-auto object-contain md:h-[64px]" />

        <div className="mx-auto mt-6 flex flex-row items-center justify-center text-[10px] font-black uppercase tracking-[0.02em] sm:mt-8 sm:text-sm sm:tracking-[0.05em]">
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2 text-white transition-opacity hover:opacity-70 sm:gap-3 sm:px-0">
            <Camera className="h-5 w-5 sm:h-7 sm:w-7" />
            Instagram
          </a>
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border-l border-white/35 px-2 text-white transition-opacity hover:opacity-70 sm:gap-3 sm:pl-8 sm:pr-0 lg:pl-12">
            <MessageCircle className="h-5 w-5 sm:h-7 sm:w-7" />
            WhatsApp
          </a>
          <a href="/admin" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 border-l border-white/35 px-2 text-white transition-opacity hover:opacity-70 sm:gap-3 sm:pl-8 sm:pr-0 lg:pl-12">
            <Lock className="h-5 w-5 sm:h-7 sm:w-7" />
            &Aacute;rea administrativa
          </a>
        </div>

        <p className="mt-6 text-[10px] text-white/50 sm:mt-8 sm:text-xs">
          &copy; 2024 {settings.storeName}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
