import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useGame } from '../context/GameContext';
import { calculateDistanceMeters, Player, Checkpoint } from '../game/radarRules';
import { Crosshair, Eye, Layers } from 'lucide-react';

interface TacticalMapProps {
  focusCoord?: { lat: number; lng: number } | null;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({ focusCoord }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const radarCircleLayerRef = useRef<L.LayerGroup | null>(null);
  const checkpointsLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, { marker: L.Marker; lastHtml: string }>>(new Map());
  const initialCenteredRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapType, setMapType] = useState<'TACTICAL_DARK' | 'OSM'>('TACTICAL_DARK');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const {
    currentUser,
    players,
    radarState,
    userLocation,
    gameState,
    activeCheckpointZone,
    checkpointRemainingSec,
  } = useGame();

  // Roles & Visibility Logic:
  // Requirement 2: "After the game starts, the hiders should only see the location of themselves not anyone else."
  const isDenner = currentUser?.role === 'DENNER';
  const isActiveHider = currentUser?.role === 'HIDER' && currentUser?.status === 'ACTIVE';
  const isRevealActive = radarState.isRevealActive;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = userLocation?.lat || currentUser?.latitude || 40.785091;
    const initialLng = userLocation?.lng || currentUser?.longitude || -73.968285;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    const tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tiles = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: 'abc',
      className: mapType === 'TACTICAL_DARK' ? 'tactical-tiles' : '',
    }).addTo(map);

    tileLayerRef.current = tiles;

    const markersLayer = L.layerGroup().addTo(map);
    const radarLayer = L.layerGroup().addTo(map);
    const checkpointsLayer = L.layerGroup().addTo(map);

    markersLayerRef.current = markersLayer;
    radarCircleLayerRef.current = radarLayer;
    checkpointsLayerRef.current = checkpointsLayer;
    mapInstanceRef.current = map;
    setMapReady(true);

    const handleResize = () => {
      map.invalidateSize();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      map.remove();
      mapInstanceRef.current = null;
      markersMapRef.current.clear();
    };
  }, []);

  // Pan to focused coordinate if requested (e.g., from CheckpointHUD)
  useEffect(() => {
    if (focusCoord && mapInstanceRef.current) {
      mapInstanceRef.current.setView([focusCoord.lat, focusCoord.lng], 18, {
        animate: true,
      });
    }
  }, [focusCoord]);

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

  // Initial center on user location once when GPS locks in
  useEffect(() => {
    if (!mapInstanceRef.current || initialCenteredRef.current || !currentUser) return;
    if (currentUser.latitude !== 0 && currentUser.longitude !== 0) {
      mapInstanceRef.current.setView([currentUser.latitude, currentUser.longitude], 17, {
        animate: false,
      });
      initialCenteredRef.current = true;
    }
  }, [currentUser?.latitude, currentUser?.longitude]);

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
    const targetsToFit = players.filter((p) => {
      if (p.id === currentUser?.id) return true;
      if (isDenner && isRevealActive && p.role === 'HIDER' && p.status === 'ACTIVE') return true;
      if (isDenner && p.role === 'DENNER') return true;
      return false;
    });

    if (targetsToFit.length > 0) {
      const bounds = L.latLngBounds(targetsToFit.map((p) => [p.latitude, p.longitude]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
    }
  };

  // Render & Smoothly Update Markers without destroying DOM
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current || !radarCircleLayerRef.current || !currentUser)
      return;

    // 1. Draw range circles around current user
    radarCircleLayerRef.current.clearLayers();
    const userLatLng: L.LatLngTuple = [currentUser.latitude, currentUser.longitude];

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

    // 1.5 Render Checkpoints for Active Hiders
    if (checkpointsLayerRef.current) {
      checkpointsLayerRef.current.clearLayers();

      if (isActiveHider && currentUser.checkpoints && currentUser.checkpoints.length > 0) {
        currentUser.checkpoints.forEach((cp) => {
          const isZoneActive = activeCheckpointZone?.id === cp.id;
          const isCompleted = cp.completed;

          // 50m radius capture circle
          L.circle([cp.latitude, cp.longitude], {
            radius: cp.radiusMeters, // 50m
            color: isCompleted ? '#10b981' : isZoneActive ? '#06b6d4' : '#0284c7',
            fillColor: isCompleted ? '#10b981' : isZoneActive ? '#06b6d4' : '#0284c7',
            fillOpacity: isCompleted ? 0.22 : isZoneActive ? 0.38 : 0.12,
            weight: isZoneActive ? 3 : 2,
            dashArray: isCompleted ? undefined : isZoneActive ? undefined : '5, 5',
          }).addTo(checkpointsLayerRef.current!);

          const dist = calculateDistanceMeters(
            currentUser.latitude,
            currentUser.longitude,
            cp.latitude,
            cp.longitude
          );

          let cpHtml = '';
          if (isCompleted) {
            cpHtml = `
              <div class="relative flex flex-col items-center pointer-events-auto">
                <div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-emerald-300 text-white flex items-center justify-center font-mono font-black text-xs shadow-lg shadow-emerald-950">
                  ✓
                </div>
                <div class="mt-1 px-1.5 py-0.5 bg-emerald-950/95 border border-emerald-600 rounded text-[9px] font-mono font-bold text-emerald-300 shadow whitespace-nowrap">
                  ${cp.code}: SECURED
                </div>
              </div>
            `;
          } else if (isZoneActive) {
            cpHtml = `
              <div class="relative flex flex-col items-center pointer-events-auto">
                <div class="absolute -inset-2 rounded-full border-2 border-cyan-400 animate-ping opacity-75"></div>
                <div class="w-8 h-8 rounded-full bg-cyan-600 border-2 border-cyan-200 text-white flex items-center justify-center font-mono font-black text-xs shadow-xl animate-pulse">
                  ${cp.code}
                </div>
                <div class="mt-1 px-2 py-0.5 bg-cyan-950/95 border-2 border-cyan-400 rounded-md text-[10px] font-mono font-bold text-cyan-200 shadow-xl whitespace-nowrap">
                  HOLD: ${checkpointRemainingSec}s
                </div>
              </div>
            `;
          } else {
            cpHtml = `
              <div class="relative flex flex-col items-center pointer-events-auto">
                <div class="w-6 h-6 rounded-full bg-sky-950 border-2 border-sky-400 text-sky-200 flex items-center justify-center font-mono font-bold text-xs shadow-md">
                  ${cp.code}
                </div>
                <div class="mt-1 px-1.5 py-0.5 bg-slate-950/95 border border-sky-700/80 rounded text-[9px] font-mono text-sky-300 shadow whitespace-nowrap">
                  WAYPOINT ${cp.code} (${dist}m)
                </div>
              </div>
            `;
          }

          const icon = L.divIcon({
            html: cpHtml,
            className: 'custom-leaflet-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });

          L.marker([cp.latitude, cp.longitude], { icon, interactive: false }).addTo(
            checkpointsLayerRef.current!
          );
        });
      }
    }

    // 2. Track which players should be visible
    const activePlayerIds = new Set<string>();

    players.forEach((player) => {
      const isMe = player.id === currentUser.id;
      const isPlayerDenner = player.role === 'DENNER';
      const isPlayerFound = player.status === 'FOUND';

      /**
       * STRICT REQUIREMENT 2:
       * "After the game starts, the hiders should only see the location of themselves not anyone else."
       *
       * - If user is an ACTIVE HIDER:
       *   ONLY isMe is visible!
       *   (Denner is NOT visible. Other hiders are NOT visible. Found players are NOT visible).
       *
       * - If user is a SEEKER (DENNER):
       *   - Always sees themselves.
       *   - Always sees fellow Seekers.
       *   - Sees active hiders ONLY during the 10-second REVEAL phase (with flashing crimson pins).
       *   - During Safe and Warning phases, active hiders are hidden.
       */
      let isVisible = false;

      if (isMe) {
        isVisible = true;
      } else if (isActiveHider) {
        // Active Hider sees NO ONE ELSE!
        isVisible = false;
      } else if (isDenner) {
        if (isPlayerDenner) {
          // Fellow Seekers are visible
          isVisible = true;
        } else if (isPlayerFound) {
          // Found players show as neutral captured markers for Seekers
          isVisible = true;
        } else {
          // Unfound Hider: visible ONLY during 10-second reveal flash!
          isVisible = isRevealActive;
        }
      }

      if (!isVisible) return;

      activePlayerIds.add(player.id);

      const distance = calculateDistanceMeters(
        currentUser.latitude,
        currentUser.longitude,
        player.latitude,
        player.longitude
      );

      // Create Custom HTML Marker
      let markerHtml = '';

      if (isMe) {
        // Current user icon: High tech reticle
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
              YOU (${player.role === 'DENNER' ? 'SEEKER' : 'HIDER'})
            </div>
          </div>
        `;
      } else if (isPlayerDenner) {
        // Fellow Denner / Seeker Marker: Crimson hunter skull / target badge
        markerHtml = `
          <div class="relative flex flex-col items-center pointer-events-auto">
            <div class="relative flex items-center justify-center">
              <div class="absolute w-9 h-9 rounded-full bg-red-600/40 animate-ping"></div>
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
              SEEKER: ${player.name}
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
        // Active Hider revealed to Denner during 10-second flash!
        markerHtml = `
          <div class="relative flex flex-col items-center pointer-events-auto">
            <!-- Concentric Expanding Radar Waves -->
            <div class="absolute -top-3 w-14 h-14 rounded-full border-2 border-red-500 radar-ping-ring"></div>
            <div class="absolute -top-3 w-14 h-14 rounded-full border-2 border-red-400 radar-ping-ring-delayed"></div>
            
            <!-- Core Blinking Crimson Beacon -->
            <div class="relative z-10 w-7 h-7 rounded-full bg-red-600 ring-4 ring-red-400/80 border-2 border-white flex items-center justify-center text-white flash-marker-red shadow-2xl">
              <div class="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></div>
            </div>

            <!-- Tactical Nameplate -->
            <div class="mt-2 px-2 py-1 bg-red-950/95 border-2 border-red-500 rounded-md shadow-2xl flex flex-col items-center">
              <span class="text-[11px] font-mono font-black text-red-100 tracking-wider uppercase animate-pulse">
                ⚠ ${player.name}
              </span>
              <span class="text-[9px] font-mono text-red-300 font-bold tracking-widest">
                TARGET EXPOSED
              </span>
            </div>
          </div>
        `;
      }

      // Smooth marker repositioning (Requirement 3: Fix location jumping)
      const existing = markersMapRef.current.get(player.id);

      if (existing) {
        // Marker exists: update coordinate smoothly without DOM re-creation
        existing.marker.setLatLng([player.latitude, player.longitude]);

        // If icon HTML changed (e.g., reveal started/ended), update icon
        if (existing.lastHtml !== markerHtml) {
          const customIcon = L.divIcon({
            html: markerHtml,
            className: 'custom-leaflet-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          });
          existing.marker.setIcon(customIcon);
          existing.lastHtml = markerHtml;
        }
      } else {
        // Create new marker
        const customIcon = L.divIcon({
          html: markerHtml,
          className: 'custom-leaflet-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        const newMarker = L.marker([player.latitude, player.longitude], {
          icon: customIcon,
        }).addTo(markersLayerRef.current!);

        markersMapRef.current.set(player.id, { marker: newMarker, lastHtml: markerHtml });
      }
    });

    // Remove any markers that are no longer visible or left the room
    for (const [id, item] of markersMapRef.current.entries()) {
      if (!activePlayerIds.has(id)) {
        markersLayerRef.current.removeLayer(item.marker);
        markersMapRef.current.delete(id);
      }
    }
  }, [
    mapReady,
    players,
    currentUser,
    isRevealActive,
    isActiveHider,
    isDenner,
    activeCheckpointZone?.id,
    checkpointRemainingSec,
    currentUser?.checkpoints,
  ]);

  return (
    <div className="relative w-full h-full min-h-[400px] flex-1 bg-slate-950 overflow-hidden select-none">
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        tabIndex={0}
        aria-label="Tactical Radar Map"
      />

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

      {/* Floating Tactical Controls Toolbar (Top Right, above Warning Banner) */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          aria-label="Center on my location"
          className="p-2 sm:p-2.5 rounded-lg bg-slate-900/95 border border-slate-700/80 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 shadow-xl backdrop-blur transition-all active:scale-95 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
          title="Center on My Location"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {isRevealActive && isDenner && (
          <button
            onClick={handleFitTargets}
            aria-label="Fit all targets into view"
            className="p-2 sm:p-2.5 rounded-lg bg-red-950/95 border border-red-600 text-red-200 hover:bg-red-900 shadow-xl backdrop-blur transition-all active:scale-95 animate-pulse cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
            title="Focus All Targets"
          >
            <Eye className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => setMapType((prev) => (prev === 'TACTICAL_DARK' ? 'OSM' : 'TACTICAL_DARK'))}
          aria-label="Toggle tactical map layer"
          className="p-2 sm:p-2.5 rounded-lg bg-slate-900/95 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 shadow-xl backdrop-blur transition-all active:scale-95 cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center"
          title="Toggle Map Style"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>

      {/* Live Map State Status Pill */}
      <div className="absolute bottom-16 sm:bottom-20 left-3 sm:left-4 z-20 pointer-events-none hidden xs:block sm:block">
        <div className="flex items-center gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-md bg-slate-950/90 border border-slate-800 text-[10px] sm:text-xs font-mono backdrop-blur shadow-lg">
          <div
            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
              isRevealActive
                ? 'bg-red-500 animate-ping'
                : radarState.isWarningActive
                ? 'bg-amber-400 animate-pulse'
                : 'bg-emerald-500'
            }`}
          />
          <span className="text-slate-300 uppercase tracking-wider font-semibold truncate max-w-[200px] sm:max-w-none">
            {isActiveHider
              ? 'STEALTH MODE (ONLY YOU VISIBLE)'
              : isRevealActive
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
