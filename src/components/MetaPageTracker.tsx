import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/metaPixel";

export default function MetaPageTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    trackPageView(`${pathname}${search}`);
  }, [pathname, search]);

  return null;
}