import { useEffect, useRef, useState } from 'react';
import { Map, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  INDIA_MAINLAND_POLYGON,
  INDIA_ISLANDS_POLYGONS,
  INDIAN_PORTS,
  MARINE_SANCTUARIES
} from './indiaMapData';

// Clean free OpenStreetMap-based style — no API key needed
const MAP_STYLE = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: 'osm-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

export default function RealIndiaMap({
  selectedIncident,
  setSelectedIncident,
  mapLayers,
  setMapLayers,
  spillMarkers
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Exact geographic bounding box for Whole Sovereign India
  // Lon: 67.0E to 98.0E, Lat: 6.0N to 37.5N
  const INDIA_BOUNDS = [[67.0, 6.0], [98.0, 37.5]];

  // 1. Sovereign Mainland Boundary GeoJSON
  const mainlandGeoJSON = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: INDIA_MAINLAND_POLYGON || []
    }
  };

  // 2. Island Territories GeoJSON (Andaman & Nicobar, Lakshadweep, Sundarbans)
  const islandsGeoJSON = {
    type: 'FeatureCollection',
    features: (INDIA_ISLANDS_POLYGONS || []).map((poly, idx) => ({
      type: 'Feature',
      properties: { id: idx },
      geometry: {
        type: 'Polygon',
        coordinates: [poly]
      }
    }))
  };

  // 3. 200 nm Sovereign Exclusive Economic Zone (EEZ)
  const eezGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Mainland EEZ 200 nm' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [67.0, 23.8], [67.2, 21.0], [68.2, 17.5], [70.5, 13.5],
            [73.5, 8.5], [75.5, 5.5], [77.5, 4.8], [80.0, 5.2],
            [84.0, 7.0], [87.5, 11.5], [89.5, 17.5], [89.8, 21.5]
          ]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Andaman & Nicobar EEZ 200 nm' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [91.2, 14.2], [90.8, 10.5], [92.0, 6.2], [95.0, 6.2],
            [95.6, 10.5], [95.2, 14.2], [91.2, 14.2]
          ]
        }
      }
    ]
  };

  // 4. CMEMS Ocean Current Streams
  const currentsGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Arabian Sea Drift' },
        geometry: {
          type: 'LineString',
          coordinates: [[69.0, 22.0], [70.5, 17.0], [73.5, 10.0]]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Konkan Coastal Jet' },
        geometry: {
          type: 'LineString',
          coordinates: [[70.5, 20.5], [72.0, 16.0], [74.8, 9.0]]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Malabar Inshore Stream' },
        geometry: {
          type: 'LineString',
          coordinates: [[71.8, 19.2], [73.2, 14.8], [76.0, 8.5]]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Bay of Bengal Gyre' },
        geometry: {
          type: 'LineString',
          coordinates: [[85.5, 8.5], [87.0, 14.5], [85.0, 19.5]]
        }
      },
      {
        type: 'Feature',
        properties: { name: 'Coromandel Flow' },
        geometry: {
          type: 'LineString',
          coordinates: [[83.5, 10.0], [85.0, 15.5], [83.0, 19.0]]
        }
      }
    ]
  };

  // Initialize MapLibre — interaction disabled so the whole India view is always visible
  useEffect(() => {
    if (!mapContainer.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const map = new Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      // Zoom 3.4 at center [80, 20] shows whole India — Kashmir to Kanyakumari
      center: [80, 20],
      zoom: 3.4,
      minZoom: 2.6,
      maxZoom: 13.0,
      // Interactive mode enabled — smooth zooming and panning
      dragPan: true,
      scrollZoom: true,
      dragRotate: false,
      doubleClickZoom: true,
      touchZoomRotate: true,
      keyboard: true,
      boxZoom: true
    });

    mapRef.current = map;

    map.on('load', () => {
      map.jumpTo({
        center: [80, 20],
        zoom: 3.4,
        pitch: 0,
        bearing: 0
      });

      // 1. Sovereign Mainland Outline Layer
      try {
        map.addSource('india-mainland', { type: 'geojson', data: mainlandGeoJSON });
        map.addLayer({
          id: 'india-mainland-outline',
          type: 'line',
          source: 'india-mainland',
          paint: {
            'line-color': '#0284c7',
            'line-width': 1.8,
            'line-opacity': 0.75
          }
        });
      } catch (err) {
        console.warn('Mainland source/layer error:', err);
      }

      // 2. Island Territories Layer
      try {
        map.addSource('india-islands', { type: 'geojson', data: islandsGeoJSON });
        map.addLayer({
          id: 'india-islands-outline',
          type: 'line',
          source: 'india-islands',
          paint: {
            'line-color': '#0284c7',
            'line-width': 1.6,
            'line-opacity': 0.75
          }
        });
      } catch (err) {
        console.warn('Islands source/layer error:', err);
      }

      // 3. 200 nm Sovereign EEZ Boundary Layer — vivid maritime blue with dash
      try {
        map.addSource('eez-boundary', { type: 'geojson', data: eezGeoJSON });
        map.addLayer({
          id: 'eez-line',
          type: 'line',
          source: 'eez-boundary',
          layout: { visibility: mapLayers.eez !== false ? 'visible' : 'none' },
          paint: {
            'line-color': '#1d4ed8',
            'line-width': 2.8,
            'line-dasharray': [5, 3],
            'line-opacity': 0.95
          }
        });
      } catch (err) {
        console.warn('EEZ source/layer error:', err);
      }

      // 4. CMEMS Hydrodynamic Ocean Current Streamlines — vivid teal with dash
      try {
        map.addSource('cmems-currents', { type: 'geojson', data: currentsGeoJSON });
        map.addLayer({
          id: 'currents-line',
          type: 'line',
          source: 'cmems-currents',
          layout: { visibility: mapLayers.currents !== false ? 'visible' : 'none' },
          paint: {
            'line-color': '#0d9488',
            'line-width': 2.8,
            'line-dasharray': [6, 4],
            'line-opacity': 0.95
          }
        });
      } catch (err) {
        console.warn('Currents source/layer error:', err);
      }

      // 5. Mount Rich Interactive DOM Markers
      renderDomMarkers(map);

      setMapLoaded(true);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      map.remove();
    };
  }, []);

  // Function to create clean, clearly labeled markers with names marked directly on the map
  const renderDomMarkers = (map) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // A. Oil Spill Markers — high-visibility pulsing radar beacons with directly marked names
    (spillMarkers || []).forEach(sp => {
      const el = document.createElement('div');
      el.className = 'custom-map-marker marker-slick';
      el.dataset.type = 'slick';
      el.style.display = mapLayers.slicks ? 'flex' : 'none';

      const isCrit = sp.priority === 'critical' || sp.coral;
      const coreColor = isCrit ? '#dc2626' : '#ea580c';
      const isSelected = selectedIncident?.centroid_lat === sp.lat && selectedIncident?.centroid_lon === sp.lon;
      if (isSelected) el.classList.add('active');

      // Smart direction: Western slicks point WEST into Arabian Sea, Eastern slicks point EAST
      const isWest = sp.lon < 75.0;
      const flexDir = isWest ? 'row-reverse' : 'row';
      const anchor = isWest ? 'right' : 'left';

      const shortName = sp.name
        .replace(' Offshore Sector', '')
        .replace(' Deepwater Channel', '')
        .replace(' Coral Biosphere', '')
        .replace(' Deepwater Basin', '');

      el.style.flexDirection = flexDir;
      el.style.alignItems = 'center';
      el.style.gap = '5px';
      el.style.cursor = 'pointer';

      el.innerHTML = `
        <div class="pin-beacon" style="position: relative; width: 16px; height: 16px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; inset: 0; border-radius: 50%; border: 2px solid ${coreColor}; animation: markerPulse 2s infinite;"></div>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${coreColor}; border: 1.5px solid #ffffff; box-shadow: 0 0 6px ${coreColor}; z-index: 2;"></div>
        </div>
        <div class="pin-label" style="background: rgba(15, 23, 42, 0.92); color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; white-space: nowrap; border: 1px solid ${coreColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.35); backdrop-filter: blur(4px); display: flex; align-items: center; gap: 4px;">
          <span>${shortName}</span>
          <span style="font-size: 7.5px; padding: 0.5px 3px; border-radius: 2px; background: ${coreColor}; color: #fff; font-weight: 800; text-transform: uppercase;">${sp.severity}</span>
        </div>
      `;

      el.title = `${sp.name} — ${sp.area} km² [${sp.lat.toFixed(3)}°N, ${sp.lon.toFixed(3)}°E]`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedIncident({
          spill_name: sp.name,
          severity: sp.severity,
          priority: sp.priority,
          affected_area_sq_km: sp.area,
          coast_proximity_km: sp.coastDist,
          overlaps_coral: sp.coral === true || sp.coral === 'true',
          nearest_mpa_name: sp.coral ? 'Marine Protected Biosphere' : 'Offshore Deepwater Channel',
          nearest_mpa_distance_km: sp.mpaDist,
          centroid_lat: sp.lat,
          centroid_lon: sp.lon,
          vulnerability_details: sp.desc
        });
      });

      const marker = new Marker({ element: el, anchor })
        .setLngLat([sp.lon, sp.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // B. Ports — clean deep-blue naval port beacon with directly marked names
    INDIAN_PORTS.forEach(p => {
      const el = document.createElement('div');
      el.className = 'custom-map-marker marker-port';
      el.dataset.type = 'port';
      el.style.display = mapLayers.ports ? 'flex' : 'none';

      const isSelected = selectedIncident?.centroid_lat === p.lat && selectedIncident?.centroid_lon === p.lon;
      if (isSelected) el.classList.add('active');

      const shortName = p.name.split(' (')[0].replace(' / Kolkata', '');

      // Smart direction: Kandla points NORTH; other coastal ports point EAST inland/seaward
      let flexDir = 'row';
      let anchor = 'left';
      if (p.name.includes('Kandla')) {
        flexDir = 'column-reverse';
        anchor = 'bottom';
      }

      el.style.flexDirection = flexDir;
      el.style.alignItems = 'center';
      el.style.gap = '4px';
      el.style.cursor = 'pointer';

      el.innerHTML = `
        <div class="pin-beacon" style="width: 9px; height: 9px; border-radius: 50%; background: #1e40af; border: 1.5px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); flex-shrink: 0;"></div>
        <div class="pin-label" style="background: rgba(15, 23, 42, 0.92); color: #eff6ff; padding: 1.5px 5px; border-radius: 4px; font-size: 8.5px; font-weight: 700; white-space: nowrap; border: 1px solid #3b82f6; box-shadow: 0 1px 5px rgba(0,0,0,0.3); backdrop-filter: blur(4px);">
          ${shortName}
        </div>
      `;

      el.title = `Port: ${p.name} (${p.state}) [${p.lat.toFixed(2)}°N, ${p.lon.toFixed(2)}°E]`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedIncident({
          spill_name: p.name,
          severity: 'Major Port',
          priority: 'Port Facility',
          affected_area_sq_km: 'Harbor Channel',
          coast_proximity_km: `${p.state} Coast`,
          overlaps_coral: false,
          nearest_mpa_name: `${p.state} Maritime Gateway`,
          nearest_mpa_distance_km: 'Direct Coastal Link',
          centroid_lat: p.lat,
          centroid_lon: p.lon,
          vulnerability_details: `Major commercial shipping and port terminal in ${p.state}. Exact Coordinates: ${p.lat}°N, ${p.lon}°E.`
        });
      });

      const marker = new Marker({ element: el, anchor })
        .setLngLat([p.lon, p.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    // C. Sanctuaries — clean emerald bio-reserve beacon with directly marked names
    MARINE_SANCTUARIES.forEach(s => {
      const el = document.createElement('div');
      el.className = 'custom-map-marker marker-sanctuary';
      el.dataset.type = 'sanctuary';
      el.style.display = mapLayers.sanctuaries ? 'flex' : 'none';

      const isSelected = selectedIncident?.centroid_lat === s.lat && selectedIncident?.centroid_lon === s.lon;
      if (isSelected) el.classList.add('active');

      let shortLabel = s.name;
      let flexDir = 'column';
      let anchor = 'top';

      if (s.name.includes('Gulf of Kutch')) {
        shortLabel = 'Marine NP';
        flexDir = 'column'; // points SOUTH onto Saurashtra, away from Kandla (north) and Slick (west)
        anchor = 'top';
      } else if (s.name.includes('Gulf of Mannar')) {
        shortLabel = 'Gulf of Mannar';
        flexDir = 'column'; // points SOUTH into Mannar Basin, away from Palk Strait (east)
        anchor = 'top';
      } else if (s.name.includes('Gahirmatha')) {
        shortLabel = 'Gahirmatha';
        flexDir = 'column-reverse'; // points NORTH, away from Paradip (south-east)
        anchor = 'bottom';
      } else if (s.name.includes('Sundarbans')) {
        shortLabel = 'Sundarbans';
        flexDir = 'column-reverse'; // points NORTH
        anchor = 'bottom';
      }

      el.style.flexDirection = flexDir;
      el.style.alignItems = 'center';
      el.style.gap = '3px';
      el.style.cursor = 'pointer';

      el.innerHTML = `
        <div class="pin-beacon" style="width: 9px; height: 9px; border-radius: 50%; background: #059669; border: 1.5px solid #ffffff; box-shadow: 0 1px 4px rgba(0,0,0,0.4); flex-shrink: 0;"></div>
        <div class="pin-label" style="background: rgba(15, 23, 42, 0.92); color: #ecfdf5; padding: 1.5px 5px; border-radius: 4px; font-size: 8.5px; font-weight: 700; white-space: nowrap; border: 1px solid #10b981; box-shadow: 0 1px 5px rgba(0,0,0,0.3); backdrop-filter: blur(4px);">
          ${shortLabel}
        </div>
      `;

      el.title = `Sanctuary: ${s.name} [${s.lat.toFixed(2)}°N, ${s.lon.toFixed(2)}°E] — ${s.type}`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedIncident({
          spill_name: s.name,
          severity: 'Protected MPA',
          priority: 'Eco-Critical',
          affected_area_sq_km: 'Schedule-I',
          coast_proximity_km: 'Coastal / Intertidal',
          overlaps_coral: true,
          nearest_mpa_name: s.type,
          nearest_mpa_distance_km: '0 km (Core Biosphere)',
          centroid_lat: s.lat,
          centroid_lon: s.lon,
          vulnerability_details: `${s.type} • Status: ${s.status}. Exact Coordinates: ${s.lat}°N, ${s.lon}°E.`
        });
      });

      const marker = new Marker({ element: el, anchor })
        .setLngLat([s.lon, s.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });
  };

  // Sync layer visibility with parent state
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer('eez-line')) {
      map.setLayoutProperty('eez-line', 'visibility', mapLayers.eez ? 'visible' : 'none');
    }
    if (map.getLayer('currents-line')) {
      map.setLayoutProperty('currents-line', 'visibility', mapLayers.currents ? 'visible' : 'none');
    }

    markersRef.current.forEach(m => {
      const el = m.getElement();
      const type = el.dataset.type;
      if (type === 'slick') {
        el.style.display = mapLayers.slicks ? 'flex' : 'none';
      } else if (type === 'port') {
        el.style.display = mapLayers.ports ? 'flex' : 'none';
      } else if (type === 'sanctuary') {
        el.style.display = mapLayers.sanctuaries ? 'flex' : 'none';
      }
    });
  }, [mapLayers, mapLoaded]);

  // Highlight active marker and smoothly pan/zoom map if selectedIncident changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    markersRef.current.forEach(m => {
      const el = m.getElement();
      const lngLat = m.getLngLat();
      const isMatch = selectedIncident &&
        Math.abs(lngLat.lat - (selectedIncident.centroid_lat || 0)) < 0.05 &&
        Math.abs(lngLat.lng - (selectedIncident.centroid_lon || 0)) < 0.05;

      if (isMatch) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    if (selectedIncident?.centroid_lat && selectedIncident?.centroid_lon) {
      map.flyTo({
        center: [selectedIncident.centroid_lon, selectedIncident.centroid_lat],
        zoom: Math.max(map.getZoom(), 5.2),
        speed: 1.2,
        curve: 1.3,
        essential: true
      });
    }
  }, [selectedIncident, mapLoaded]);

  // Re-render markers if spillMarkers update
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    renderDomMarkers(map);
  }, [spillMarkers, mapLoaded]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Keyframe animation and clean non-overlapping tooltip styles */}
      <style>{`
        @keyframes markerPulse {
          0% { transform: scale(0.6); opacity: 1; }
          70% { transform: scale(1.7); opacity: 0.12; }
          100% { transform: scale(0.6); opacity: 0; }
        }
        /* Hide MapLibre logo & attribution for cleaner look */
        .maplibregl-ctrl-logo { display: none !important; }
        .maplibregl-ctrl-attrib { display: none !important; }

        /* Custom Marker Container with Directional Permanent Label */
        .custom-map-marker {
          position: relative;
          display: flex;
          align-items: center;
          cursor: pointer;
          z-index: 15;
          user-select: none;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .custom-map-marker:hover {
          transform: scale(1.15);
          z-index: 100;
        }
        .custom-map-marker.active {
          transform: scale(1.2);
          z-index: 110;
        }
        .custom-map-marker.active .pin-label {
          border-color: #ffffff !important;
          box-shadow: 0 0 12px rgba(56, 189, 248, 0.8) !important;
        }
      `}</style>

      {/* MapLibre DOM Container */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%', borderRadius: 16 }} />

      {/* Floating Zoom & Whole India Reset Controls — top-right */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 15,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: 4,
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
      }}>
        <button
          onClick={() => mapRef.current?.zoomIn()}
          style={{
            width: 28, height: 28, border: 'none', background: 'transparent',
            color: '#0f172a', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Zoom In"
        >+</button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          style={{
            width: 28, height: 28, border: 'none', background: 'transparent',
            color: '#0f172a', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Zoom Out"
        >−</button>
        <div style={{ height: 1, background: '#e2e8f0', margin: '2px 2px' }} />
        <button
          onClick={() => mapRef.current?.flyTo({ center: [80, 20], zoom: 3.4, speed: 1.2, essential: true })}
          style={{
            width: 28, height: 28, border: 'none', background: '#f1f5f9',
            color: '#0284c7', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Reset Whole India View"
        >🌐</button>
      </div>

      {/* Floating "India" badge — top-left clean label */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '6px 14px',
        borderRadius: 10,
        border: '1px solid rgba(2, 132, 199, 0.3)',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)'
      }}>
        {/* Crisp SVG Indian Tricolour Flag */}
        <svg width="18" height="12" viewBox="0 0 900 600" style={{ borderRadius: 2, flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }}>
          <rect width="900" height="200" fill="#FF9933" />
          <rect y="200" width="900" height="200" fill="#FFFFFF" />
          <rect y="400" width="900" height="200" fill="#138808" />
          <circle cx="450" cy="300" r="70" fill="none" stroke="#000080" strokeWidth="18" />
        </svg>
        <span style={{
          fontSize: '0.8rem',
          fontWeight: 800,
          color: '#0369a1',
          letterSpacing: '0.4px'
        }}>
          India Maritime EEZ
        </span>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#22c55e',
          boxShadow: '0 0 6px #22c55e',
          display: 'inline-block',
          marginLeft: 2
        }} />
        <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700 }}>Live</span>
      </div>

      {/* Map source attribution — bottom right */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 12,
        zIndex: 10,
        fontSize: '0.65rem',
        color: '#64748b',
        background: 'rgba(255,255,255,0.8)',
        padding: '2px 8px',
        borderRadius: 6
      }}>
        © OpenStreetMap contributors
      </div>
    </div>
  );
}
