import React, { useEffect, useRef } from 'react';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  className?: string;
  height?: number;
}

// Lightweight loader for Leaflet from CDN to avoid npm dependency
const loadLeaflet = (): Promise<typeof window & { L: any }> => {
  return new Promise((resolve) => {
    const w = window as any;
    if (w.L) {
      resolve(w);
      return;
    }

    // Inject CSS
    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject JS
    const scriptId = 'leaflet-js-cdn';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => resolve(window as any);
      document.body.appendChild(script);
    } else {
      const existing = document.getElementById(scriptId) as HTMLScriptElement;
      if (existing && (window as any).L) {
        resolve(window as any);
      } else {
        existing.onload = () => resolve(window as any);
      }
    }
  });
};

export const LocationMap: React.FC<LocationMapProps> = ({ latitude, longitude, zoom = 16, className, height = 300 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    loadLeaflet().then((w) => {
      if (!isMounted || !containerRef.current) return;
      const L = (w as any).L;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { zoomControl: false }).setView([latitude, longitude], zoom);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(mapRef.current);
        markerRef.current = L.marker([latitude, longitude]).addTo(mapRef.current);
      } else {
        mapRef.current.setView([latitude, longitude], zoom);
        if (markerRef.current) {
          markerRef.current.setLatLng([latitude, longitude]);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, zoom]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height }}
    />
  );
};

export default LocationMap;
