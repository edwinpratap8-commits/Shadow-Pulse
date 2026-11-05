import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { useGame } from '../context/GameContext';
import { calculateDistanceMeters, Player } from '../game/radarRules';
import { Navigation, Crosshair, Eye, ShieldAlert, Sparkles, Layers } from 'lucide-react';

export const TacticalMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const radarCircleLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<'TACTICAL_DARK' | 'OSM'>('TACTICAL_DARK');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const {
    currentUser,
    players,
    radarState,
    userLocation,
    gameState,
  } = useGame();

  // Determine if unfound hiders should be visible right now to this user:
  // - If user is a HIDER (active): only sees themselves (unless in debug mode or reveal)
  // - If user is DENNER: sees unfound hiders ONLY during 10-second REVEAL phase!
  // - If user is a FOUND HIDER (Co-Seeker): unlocks Denner radar map -> sees unfound hiders during REVEAL phase!
  const isDenner = currentUser?.role === 'DENNER';
  const isFoundHider = currentUser?.role === 'HIDER' && currentUser?.status === 'FOUND';
  const canSeeAllDuringReveal = isDenner || isFoundHider;
  const isRevealActive = radarState.isRevealActive;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = userLocation?.lat || 40.785091;
    const initialLng = userLocation?.lng || -73.968285;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    // OpenStreetMap standard tile layer with zero API keys and dark tactical CSS styling
    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tiles = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abc',
      className: mapType === 'TACTICAL_DARK' ? 'tactical-tiles' : '',
    }).addTo(map);

    tileLayerRef.current = tiles;

    const markersLayer = L.layerGroup().addTo(map);
    const radarLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    radarCircleLayerRef.current = radarLayer;
    mapInstanceRef.current = map;
    setMapReady(true);

    // Invalidate size after animation / render
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer if user toggles map style
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const newTiles = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abc',
      className: mapType === 'TACTICAL_DARK' ? 'tactical-tiles' : '',
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTiles;
  }, [mapType]);

  // Recenter map on user location
  const handleRecenter = () => {
    if (!mapInstanceRef.current || !currentUser) return;
    mapInstanceRef.current.setView([currentUser.latitude, currentUser.longitude], 17, {
      animate: true,
    });
  };

  // Fit all visible targets during reveal
  const handleFitTargets = () => {
    if (!mapInstanceRef.current || players.length === 0) return;
    const bounds = L.latLngBounds(players.map((p) => [p.latitude, p.longitude]));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
  };

  // Render & Update Markers on Map
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current || !radarCircleLayerRef.current || !currentUser)
      return;

    markersLayerRef.current.clearLayers();
    radarCircleLayerRef.current.clearLayers();

    // 1. Draw range circles around current user
    const userLatLng: L.LatLngTuple = [currentUser.latitude, currentUser.longitude];

    // Range rings (100m, 250m)
    L.circle(userLatLng, {
      radius: 100,
      color: isRevealActive ? '#ef4444' : '#10b981',
      weight: 1,
      dashArray: '4, 8',
      fill: false,
      opacity: 0.35,
    }).addTo(radarCircleLayerRef.current);

    L.circle(userLatLng, {
      radius: 250,
      color: isRevealActive ? '#ef4444' : '#10b981',
      weight: 1,
      dashArray: '2, 10',
      fill: false,
      opacity: 0.2,
    }).addTo(radarCircleLayerRef.current);

    // 2. Render Players based on Role & Visibility rules
    players.forEach((player) => {
      const isMe = player.id === currentUser.id;
      const isPlayerDenner = player.role === 'DENNER';
      const isPlayerFound = player.status === 'FOUND';

      // Visibility Rules:
      // - You always see yourself.
      // - Denner is visible to other players (or yourself).
      // - Found hiders are visible as deactivated/co-seeker pins.
      // - Active hiders are visible to Denner / Co-Seekers ONLY during REVEAL phase!
      // - Active hiders see fellow active hiders or only themselves based on tactical stealth.
      let isVisible = false;

      if (isMe) {
        isVisible = true;
      } else if (isPlayerDenner) {
        // Denner is visible on tactical radar
        isVisible = true;
      } else if (isPlayerFound) {
        // Found players show as neutral/captured markers
        isVisible = true;
      } else {
        // Active Hider:
        if (canSeeAllDuringReveal && isRevealActive) {
          // 10-Second Live Location Flash: Broadcasted to Denner and Found Co-Seekers!
          isVisible = true;
        } else if (!isDenner && !isFoundHider) {
          // Fellow Hiders: always see teammates in green stealth mode
          isVisible = true;
        } else {
          // Hidden from Denner during Safe & Warning phases!
          isVisible = false;
        }
      }

      if (!isVisible) return;

      const distance = calculateDistanceMeters(
        currentUser.latitude,
        currentUser.longitude,
        player.latitude,
        player.longitude
      );

      // Create Custom HTML Marker
      let markerHtml = '';

      if (isMe) {
        // Current user icon: High tech cyan/emerald reticle
        const colorClass = isPlayerDenner
          ? 'bg-red-500 ring-red-400'
          : isPlayerFound
          ? 'bg-amber-500 ring-amber-400'
          : 'bg-emerald-500 ring-emerald-400';

        markerHtml = `
          <div class="relative flex flex-col items-center pointer-events-auto">
            <div class="relative flex items-center justify-center">
              <div class="absolute w-8 h-8 rounded-full ${colorClass} opacity-40 animate-ping"></div>
              <div class="w-5 h-5 rounded-full ${colorClass} ring-4 border-2 border-slate-950 flex items-center justify-center shadow-lg">
                <div class="w-2 h-2 rounded-full bg-white"></div>
              </div>
            </div>
            <div class="mt-1 px-1.5 py-0.5 bg-slate-950/90 border border-slate-700 rounded text-[10px] font-mono font-bold text-slate-200 tracking-wider shadow whitespace-nowrap">
              YOU (${player.role})
            </div>
          </div>
        `;
      } else if (isPlayerDenner) {
        // Denner Marker: Crimson hunter skull / target badge
        markerHtml = `
          <div class="relative flex flex-col items-center pointer-events-auto">
            <div class="relative flex items-center justify-center">
              <div class="absolute w-10 h-10 rounded-full bg-red-600/40 animate-ping"></div>
              <div class="w-6 h-6 rounded-full bg-red-600 ring-4 ring-red-500/50 border-2 border-slate-950 flex items-center justify-center text-white shadow-xl">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="22" y1="12" x2="18" y2="12"/>
                  <line x1="6" y1="12" x2="2" y2="12"/>
                  <line x1="12" y1="6" x2="12" y2="2"/>
                  <line x1="12" y1="22" x2="12" y2="18"/>
                </svg>
              </div>
            </div>
            <div class="mt-1 px-2 py-0.5 bg-red-950/95 border border-red-700/80 rounded text-[10px] font-mono font-bold text-red-200 tracking-wider shadow-lg whitespace-nowrap">
              SEEKER: ${player.name} (${distance}m)
            </div>
          </div>
        `;
      } else if (isPlayerFound) {
        // Found Hider: Neutral slate badge
        markerHtml = `
          <div class="relative flex flex-col items-center opacity-75 pointer-events-auto">
            <div class="w-4 h-4 rounded-full bg-slate-600 border border-slate-400 flex items-center justify-center text-slate-200">
              <div class="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
            </div>
            <div class="mt-1 px-1.5 py-0.5 bg-slate-900/90 border border-slate-700 rounded text-[9px] font-mono text-slate-400 whitespace-nowrap">
              FOUND: ${player.name}
            </div>
          </div>
        `;
      } else {
        // Active Hider:
        if (isRevealActive) {
          // *** 10-SECOND LIVE LOCATION FLASH BEACON ***
          // Requirement: Brightly pulsing/flashing radar pins with concentric expanding rings & player names
          markerHtml = `
            <div class="relative flex flex-col items-center pointer-events-auto">
              <!-- Concentric Expanding Radar Waves -->
              <div class="absolute -top-3 w-14 h-14 rounded-full border-2 border-red-500 radar-ping-ring"></div>
              <div class="absolute -top-3 w-14 h-14 rounded-full border-2 border-red-400 radar-ping-ring-delayed"></div>
              
              <!-- Core Blinking Crimson Beacon -->
              <div class="relative z-10 w-7 h-7 rounded-full bg-red-600 ring-4 ring-red-400/80 border-2 border-white flex items-center justify-center text-white flash-marker-red shadow-2xl">
                <div class="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
              </div>

              <!-- Tactical Nameplate & Range -->
              <div class="mt-2 px-2 py-1 bg-red-950/95 border-2 border-red-500 rounded-md shadow-2xl flex flex-col items-center">
                <span class="text-[11px] font-mono font-black text-red-100 tracking-wider uppercase animate-pulse">
                  ⚠ ${player.name}
                </span>
                <span class="text-[9px] font-mono text-red-300 font-semibold">
                  ${distance}m AWAY
                </span>
              </div>
            </div>
          `;
        } else {
          // Safe stealth teammate badge (only seen by fellow active hiders)
          markerHtml = `
            <div class="relative flex flex-col items-center pointer-events-auto">
              <div class="w-4 h-4 rounded-full bg-emerald-600 ring-2 ring-emerald-400/50 border border-slate-950 flex items-center justify-center">
                <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
              <div class="mt-1 px-1.5 py-0.5 bg-slate-900/90 border border-emerald-800 rounded text-[9px] font-mono text-emerald-300 whitespace-nowrap">
                ${player.name} (${distance}m)
              </div>
            </div>
          `;
        }
      }

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker([player.latitude, player.longitude], { icon: customIcon }).addTo(
        markersLayerRef.current!
      );
    });
  }, [mapReady, players, currentUser, radarState.isRevealActive, isRevealActive, canSeeAllDuringReveal]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex-1 bg-slate-950 overflow-hidden select-none">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" tabIndex={0} aria-label="Tactical Radar Map" />

      {/* High-Tech Tactical Scanline CRT Overlay */}
      <div className="absolute inset-0 scanlines-overlay pointer-events-none z-10 opacity-40" />

      {/* Radar Sweep Beam Overlay during Seeking Phase */}
      {gameState === 'ACTIVE_SEEKING' && (
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center overflow-hidden">
          <div className="relative w-[340px] h-[340px] sm:w-[500px] sm:h-[500px] rounded-full border border-emerald-500/20">
            {/* Center crosshair */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-emerald-500/20" />
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-emerald-500/20" />
            {/* Rotating radar sector beam */}
            <div
              className={`absolute inset-0 rounded-full radar-sweep-beam ${
                isRevealActive
                  ? 'bg-gradient-to-tr from-transparent via-red-500/10 to-red-500/30'
                  : 'bg-gradient-to-tr from-transparent via-emerald-500/5 to-emerald-500/20'
              }`}
            />
          </div>
        </div>
      )}

      {/* Floating Tactical Controls Toolbar */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          aria-label="Center on my location"
          className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 shadow-xl backdrop-blur transition-all active:scale-95"
          title="Center on My Location"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {isRevealActive && canSeeAllDuringReveal && (
          <button
            onClick={handleFitTargets}
            aria-label="Fit all targets into view"
            className="p-2.5 rounded-lg bg-red-950/90 border border-red-600 text-red-200 hover:bg-red-900 shadow-xl backdrop-blur transition-all active:scale-95 animate-pulse"
            title="Focus All Targets"
          >
            <Eye className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => setMapType((prev) => (prev === 'TACTICAL_DARK' ? 'OSM' : 'TACTICAL_DARK'))}
          aria-label="Toggle tactical map layer"
          className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xl backdrop-blur transition-all active:scale-95"
          title="Toggle Map Style"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {/* Live Map State Status Pill */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-950/85 border border-slate-800 text-xs font-mono backdrop-blur shadow-lg">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isRevealActive
                ? 'bg-red-500 animate-ping'
                : radarState.isWarningActive
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-500'
            }`}
          />
          <span className="text-slate-300 uppercase tracking-wider font-semibold">
            {isRevealActive
              ? 'GPS BROADCAST ACTIVE'
              : radarState.isWarningActive
              ? 'WARNING IMMINENT'
              : 'RADAR SILENT'}
          </span>
        </div>
      </div>
    </div>
  );
};
