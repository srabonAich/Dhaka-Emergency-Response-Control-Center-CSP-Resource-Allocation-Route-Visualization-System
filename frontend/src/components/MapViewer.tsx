import React, { useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Polygon,
  CircleMarker,
  ZoomControl,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  EmergencyIncident,
  ResourceCenter,
  RouteInfo,
  CSPTraceEvent,
  ClickMode,
  RoadBlockConstraint,
} from '../types';

interface MapViewerProps {
  incidents: EmergencyIncident[];
  centers: ResourceCenter[];
  activeRoutes: RouteInfo[];
  currentTraceEvent: CSPTraceEvent | null;
  animationCompleted: boolean;
  clickMode: ClickMode;
  onMapClick: (lat: number, lng: number) => void;
  onIncidentClick: (incident: EmergencyIncident) => void;
  onCenterClick: (center: ResourceCenter) => void;
  roadblocks: RoadBlockConstraint[];
}

// Map Click Listener
function MapClickHandler({
  onClick,
  clickMode,
}: {
  onClick: (lat: number, lng: number) => void;
  clickMode: ClickMode;
}) {
  useMapEvents({
    click(e) {
      if (clickMode === 'add_incident' || clickMode === 'block_road') {
        onClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export const MapViewer: React.FC<MapViewerProps> = ({
  incidents,
  centers,
  activeRoutes,
  currentTraceEvent,
  animationCompleted,
  clickMode,
  onMapClick,
  onIncidentClick,
  onCenterClick,
  roadblocks,
}) => {
  // Center of Dhaka City
  const defaultCenter: [number, number] = [23.777176, 90.399452];

  // Map of centers by id for quick coordinate resolution
  const centerMap = useMemo(() => {
    const map = new Map<string, ResourceCenter>();
    centers.forEach((c) => map.set(c.id, c));
    return map;
  }, [centers]);

  // Map of incidents by id
  const incidentMap = useMemo(() => {
    const map = new Map<string, EmergencyIncident>();
    incidents.forEach((i) => map.set(i.id, i));
    return map;
  }, [incidents]);

  // Helper to extract incident_id from var_id (e.g. X_INC_01_Ambulance_0 -> INC_01)
  const getIncidentIdFromVar = (varId?: string): string | null => {
    if (!varId) return null;
    const parts = varId.split('_');
    if (parts.length >= 3) {
      return `${parts[1]}_${parts[2]}`;
    }
    return null;
  };

  // Color generator for Resource Types
  const getResourceColor = (rType: string) => {
    switch (rType) {
      case 'Ambulance':
        return '#38bdf8'; // Sky blue
      case 'Fire Brigade':
        return '#f87171'; // Red
      case 'Rescue Team':
        return '#fb923c'; // Orange
      case 'Police Personnel':
        return '#a855f7'; // Purple
      case 'Relief Team':
        return '#4ade80'; // Emerald
      default:
        return '#94a3b8';
    }
  };

  // Incident Priority Colors
  const getPriorityColor = (priority: number, escalated: boolean) => {
    if (escalated) return '#ef4444'; // Flashing Red
    switch (priority) {
      case 5:
        return '#ef4444'; // Critical Red
      case 4:
        return '#f97316'; // High Orange
      case 3:
        return '#eab308'; // Medium Yellow
      case 2:
      case 1:
      default:
        return '#3b82f6'; // Low Blue
    }
  };

  // Custom Icon for Resource Centers
  const createCenterIcon = (center: ResourceCenter) => {
    const isOff = !center.operational;
    const totalAvail = Object.values(center.inventory).reduce(
      (acc, curr) => acc + curr.available_units,
      0
    );

    const isConflictCenter =
      currentTraceEvent?.center_id === center.id &&
      (currentTraceEvent?.event_type === 'CONFLICT' ||
        currentTraceEvent?.event_type === 'LOCAL_PICK_CONFLICTED');

    const svgHtml = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        ${
          isConflictCenter
            ? `
          <div style="
            position: absolute;
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background-color: #ef4444;
            opacity: 0.45;
            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
        `
            : ''
        }
        <div style="
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background-color: ${isOff ? '#4b5563' : isConflictCenter ? '#dc2626' : '#10b981'};
          border: 2px solid #ffffff;
          box-shadow: 0 4px 10px rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 11px;
        ">
          ${isOff ? 'OFF' : totalAvail}
        </div>
        <div style="
          position: absolute;
          bottom: -18px;
          background: rgba(17, 24, 39, 0.85);
          padding: 1px 4px;
          border-radius: 4px;
          font-size: 9px;
          white-space: nowrap;
          color: #d1d5db;
          border: 1px solid #374151;
          pointer-events: none;
        ">
          ${center.name.split(' ')[0]}
        </div>
      </div>
    `;

    return L.divIcon({
      html: svgHtml,
      className: 'custom-center-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16],
    });
  };

  // Conflict set variables during CBJ
  const conflictSetIncidents = useMemo(() => {
    if (!currentTraceEvent?.conflict_set) return new Set<string>();
    const incs = new Set<string>();
    currentTraceEvent.conflict_set.forEach((v) => {
      const inc = getIncidentIdFromVar(v);
      if (inc) incs.add(inc);
    });
    return incs;
  }, [currentTraceEvent]);

  // Skipped variables during CBJ
  const skippedIncidents = useMemo(() => {
    if (!currentTraceEvent?.skipped_vars) return new Set<string>();
    const incs = new Set<string>();
    currentTraceEvent.skipped_vars.forEach((v) => {
      const inc = getIncidentIdFromVar(v);
      if (inc) incs.add(inc);
    });
    return incs;
  }, [currentTraceEvent]);

  // Custom Icon for Incidents
  const createIncidentIcon = (incident: EmergencyIncident) => {
    const color = getPriorityColor(incident.priority, incident.escalated);
    const isEscalated = incident.escalated;
    const isCurrentActive =
      currentTraceEvent?.incident_id === incident.id ||
      getIncidentIdFromVar(currentTraceEvent?.var_id) === incident.id;

    const isInConflictSet = conflictSetIncidents.has(incident.id);
    const isSkipped = skippedIncidents.has(incident.id);

    // Heuristic badge if current event has heuristic data
    let heuristicText = '';
    if (isCurrentActive && currentTraceEvent) {
      if (currentTraceEvent.event_type === 'HEURISTIC_MRV' && currentTraceEvent.domain_size !== undefined) {
        heuristicText = `MRV: ${currentTraceEvent.domain_size}`;
      } else if (currentTraceEvent.event_type === 'HEURISTIC_DEGREE' && currentTraceEvent.degree_count !== undefined) {
        heuristicText = `Deg: ${currentTraceEvent.degree_count}`;
      } else if (currentTraceEvent.event_type === 'HEURISTIC_LCV') {
        heuristicText = `LCV`;
      }
    }

    const svgHtml = `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        ${
          isCurrentActive || isEscalated || isInConflictSet
            ? `
          <div style="
            position: absolute;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background-color: ${isInConflictSet ? '#f97316' : color};
            opacity: 0.4;
            animation: ${isCurrentActive ? 'ping 1.4s infinite' : 'pulse 1.2s infinite'};
          "></div>
        `
            : ''
        }
        <div style="
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background-color: ${isInConflictSet ? '#ea580c' : isSkipped ? '#64748b' : color};
          border: 2px solid #ffffff;
          box-shadow: 0 0 12px ${isInConflictSet ? '#f97316' : color};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          opacity: ${isSkipped ? '0.6' : '1'};
        ">
          ${isEscalated ? '!' : incident.priority}
        </div>

        ${
          incident.status === 'ASSIGNED'
            ? `
          <div style="
            position: absolute;
            top: -6px;
            right: -6px;
            width: 10px;
            height: 10px;
            background: #10b981;
            border-radius: 50%;
            border: 1.5px solid #ffffff;
          "></div>
        `
            : ''
        }

        ${
          isSkipped
            ? `
          <div style="
            position: absolute;
            top: -14px;
            background: #475569;
            color: #cbd5e1;
            padding: 0px 4px;
            border-radius: 3px;
            font-size: 8px;
            font-weight: bold;
            border: 1px solid #94a3b8;
            white-space: nowrap;
          ">
            SKIPPED
          </div>
        `
            : ''
        }

        ${
          heuristicText
            ? `
          <div style="
            position: absolute;
            top: -20px;
            background: #6366f1;
            color: #ffffff;
            padding: 1px 5px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 800;
            border: 1px solid #a5b4fc;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            white-space: nowrap;
            animation: bounce 1s infinite;
          ">
            ${heuristicText}
          </div>
        `
            : ''
        }
      </div>
    `;

    return L.divIcon({
      html: svgHtml,
      className: 'custom-incident-marker',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -12],
    });
  };

  // 1. Probing Candidate Line during search (TRY_VALUE, CONFLICT, LOCAL_PICK_CONFLICTED, SELECT_VAR)
  const probingLine = useMemo(() => {
    if (
      currentTraceEvent &&
      (currentTraceEvent.event_type === 'TRY_VALUE' ||
        currentTraceEvent.event_type === 'CONFLICT' ||
        currentTraceEvent.event_type === 'LOCAL_PICK_CONFLICTED' ||
        currentTraceEvent.event_type === 'LOCAL_REPAIR' ||
        currentTraceEvent.event_type === 'SELECT_VAR')
    ) {
      const incId =
        currentTraceEvent.incident_id || getIncidentIdFromVar(currentTraceEvent.var_id);
      const inc = incId ? incidentMap.get(incId) : null;
      const ctr = currentTraceEvent.center_id ? centerMap.get(currentTraceEvent.center_id) : null;
      if (inc && ctr) {
        return {
          positions: [
            [ctr.lat, ctr.lng] as [number, number],
            [inc.lat, inc.lng] as [number, number],
          ],
          isConflict:
            currentTraceEvent.event_type === 'CONFLICT' ||
            currentTraceEvent.event_type === 'LOCAL_PICK_CONFLICTED',
        };
      }
    }
    return null;
  }, [currentTraceEvent, incidentMap, centerMap]);

  // 2. Node Consistency Pruned Line (NODE_PRUNE): Crossed out line between center and incident
  const nodePruneLine = useMemo(() => {
    if (currentTraceEvent && currentTraceEvent.event_type === 'NODE_PRUNE') {
      const incId =
        currentTraceEvent.incident_id || getIncidentIdFromVar(currentTraceEvent.var_id);
      const inc = incId ? incidentMap.get(incId) : null;
      const ctr = currentTraceEvent.center_id ? centerMap.get(currentTraceEvent.center_id) : null;
      if (inc && ctr) {
        return [
          [ctr.lat, ctr.lng] as [number, number],
          [inc.lat, inc.lng] as [number, number],
        ];
      }
    }
    return null;
  }, [currentTraceEvent, incidentMap, centerMap]);

  // 3. Path Consistency (3-Consistency) Triangle: Polygon connecting the 3 incidents
  const pathConsistencyTriangle = useMemo(() => {
    if (
      currentTraceEvent &&
      (currentTraceEvent.event_type === 'PC_TRIPLE_CHECK' ||
        currentTraceEvent.event_type === 'PC_CONFLICT' ||
        currentTraceEvent.event_type === 'PC_PRUNE') &&
      currentTraceEvent.triple_vars &&
      currentTraceEvent.triple_vars.length === 3
    ) {
      const coords: [number, number][] = [];
      currentTraceEvent.triple_vars.forEach((vId) => {
        const incId = getIncidentIdFromVar(vId);
        const inc = incId ? incidentMap.get(incId) : null;
        if (inc) {
          coords.push([inc.lat, inc.lng]);
        }
      });
      if (coords.length === 3) {
        return coords;
      }
    }
    return null;
  }, [currentTraceEvent, incidentMap]);

  // 4. Arc Consistency Directed Arc (AC3_CHECK_ARC, AC3_PRUNE, AC3_REQUEUE)
  const ac3Arc = useMemo(() => {
    if (
      currentTraceEvent &&
      (currentTraceEvent.event_type === 'AC3_CHECK_ARC' ||
        currentTraceEvent.event_type === 'AC3_PRUNE' ||
        currentTraceEvent.event_type === 'AC3_REQUEUE') &&
      currentTraceEvent.from_var &&
      currentTraceEvent.to_var
    ) {
      const inc1Id = getIncidentIdFromVar(currentTraceEvent.from_var);
      const inc2Id = getIncidentIdFromVar(currentTraceEvent.to_var);
      const inc1 = inc1Id ? incidentMap.get(inc1Id) : null;
      const inc2 = inc2Id ? incidentMap.get(inc2Id) : null;
      if (inc1 && inc2) {
        return {
          positions: [
            [inc1.lat, inc1.lng] as [number, number],
            [inc2.lat, inc2.lng] as [number, number],
          ],
          isPrune: currentTraceEvent.event_type === 'AC3_PRUNE',
        };
      }
    }
    return null;
  }, [currentTraceEvent, incidentMap]);

  // 5. Conflict-Directed Backjump Arc (CBJ_BACKJUMP)
  const backjumpArc = useMemo(() => {
    if (
      currentTraceEvent &&
      currentTraceEvent.event_type === 'CBJ_BACKJUMP' &&
      currentTraceEvent.from_var &&
      currentTraceEvent.to_var
    ) {
      const inc1Id = getIncidentIdFromVar(currentTraceEvent.from_var);
      const inc2Id = getIncidentIdFromVar(currentTraceEvent.to_var);
      const inc1 = inc1Id ? incidentMap.get(inc1Id) : null;
      const inc2 = inc2Id ? incidentMap.get(inc2Id) : null;
      if (inc1 && inc2) {
        return [
          [inc1.lat, inc1.lng] as [number, number],
          [inc2.lat, inc2.lng] as [number, number],
        ];
      }
    }
    return null;
  }, [currentTraceEvent, incidentMap]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        preferCanvas={true}
        zoomControl={false}
        className="w-full h-full dark-tiles"
      >
        {/* Explicit Zoom Control at bottom right as mandated */}
        <ZoomControl position="bottomright" />

        {/* Free, Keyless OpenStreetMap Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={18}
        />

        {/* Map Click Event Handler */}
        <MapClickHandler onClick={onMapClick} clickMode={clickMode} />

        {/* 1. Roadblock & Hazard Zones */}
        {roadblocks.map((rb, i) => (
          <CircleMarker
            key={`rb-${i}`}
            center={[rb.lat || 23.75, rb.lng || 90.39]}
            radius={rb.hazard_zone ? 35 : 12}
            pathOptions={{
              color: rb.hazard_zone ? '#ef4444' : '#eab308',
              fillColor: rb.hazard_zone ? '#ef4444' : '#eab308',
              fillOpacity: rb.hazard_zone ? 0.35 : 0.8,
              dashArray: rb.hazard_zone ? '4, 4' : undefined,
            }}
          >
            <Popup>
              <div className="text-xs p-1">
                <span className="font-bold text-amber-400">
                  {rb.hazard_zone ? 'HAZARD ZONE (Impassable)' : 'ROADBLOCK / DELAY'}
                </span>
                <p>Traffic Factor: {rb.traffic_factor}x</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* 2. Dispatch Routes: Incremental during animation or complete upon finish */}
        {activeRoutes.map((route, idx) => {
          const color = getResourceColor(route.resource_type);
          return (
            <Polyline
              key={`route-${route.var_id}-${idx}`}
              positions={route.path_coords}
              pathOptions={{
                color: color,
                weight: 3.5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            >
              <Popup>
                <div className="text-xs p-1 space-y-1">
                  <div className="font-bold text-cyan-300">
                    {route.resource_type} Dispatch
                  </div>
                  <div>
                    Unit ID: <span className="font-mono font-bold text-emerald-300">{route.unit_id}</span>
                  </div>
                  <div>
                    From: <span className="font-semibold">{route.center_name}</span>
                  </div>
                  <div>
                    Incident: <span className="font-semibold">{route.incident_id}</span>
                  </div>
                  <div>
                    Travel Time:{' '}
                    <span className="text-amber-300 font-bold">{route.travel_time_min} mins</span>
                  </div>
                  <div>Distance: {route.distance_km} km</div>
                  <div>Cost: ${route.cost}</div>
                </div>
              </Popup>
            </Polyline>
          );
        })}

        {/* 3. Live Probing Line (TRY_VALUE, CONFLICT, LOCAL_REPAIR) */}
        {probingLine && (
          <Polyline
            positions={probingLine.positions}
            pathOptions={{
              color: probingLine.isConflict ? '#ef4444' : '#06b6d4',
              weight: 3,
              dashArray: '6, 6',
              opacity: 0.95,
            }}
          />
        )}

        {/* 4. Node Consistency Prune Line */}
        {nodePruneLine && (
          <Polyline
            positions={nodePruneLine}
            pathOptions={{
              color: '#f43f5e',
              weight: 2.5,
              dashArray: '4, 4',
              opacity: 0.8,
            }}
          />
        )}

        {/* 5. Path Consistency (3-Consistency) Purple Triangle */}
        {pathConsistencyTriangle && (
          <Polygon
            positions={pathConsistencyTriangle}
            pathOptions={{
              color: '#d946ef',
              fillColor: '#c026d3',
              fillOpacity: 0.25,
              weight: 3,
              dashArray: '5, 5',
            }}
          />
        )}

        {/* 6. Arc Consistency Ripple Line */}
        {ac3Arc && (
          <Polyline
            positions={ac3Arc.positions}
            pathOptions={{
              color: ac3Arc.isPrune ? '#ef4444' : '#818cf8',
              weight: ac3Arc.isPrune ? 3.5 : 2,
              dashArray: ac3Arc.isPrune ? '3, 3' : '6, 4',
              opacity: 0.9,
            }}
          />
        )}

        {/* 7. Conflict-Directed Backjump Curve */}
        {backjumpArc && (
          <Polyline
            positions={backjumpArc}
            pathOptions={{
              color: '#f97316',
              weight: 4,
              opacity: 1,
              dashArray: '8, 4',
            }}
          />
        )}

        {/* 8. Resource Centers */}
        {centers.map((center) => (
          <Marker
            key={center.id}
            position={[center.lat, center.lng]}
            icon={createCenterIcon(center)}
            eventHandlers={{
              click: () => onCenterClick(center),
            }}
          >
            <Popup>
              <div className="text-xs space-y-1.5 p-1 min-w-[210px]">
                <div className="flex items-center justify-between border-b border-gray-700 pb-1">
                  <span className="font-bold text-emerald-400">{center.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      center.operational
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : 'bg-red-900/60 text-red-300'
                    }`}
                  >
                    {center.operational ? 'OPERATIONAL' : 'OFFLINE'}
                  </span>
                </div>
                <div className="text-gray-400">Area: {center.area}</div>
                <div className="font-semibold text-gray-200 mt-1">Resource Inventory:</div>
                <div className="space-y-1">
                  {Object.entries(center.inventory).map(([rType, inv]) => (
                    <div key={rType} className="flex justify-between items-center text-[11px]">
                      <span style={{ color: getResourceColor(rType) }}>{rType}:</span>
                      <span className="font-mono font-bold">
                        {inv.available_units} / {inv.total_capacity}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-1 border-t border-gray-700 text-[10px] text-gray-400 italic">
                  Click center in 'Toggle Center' mode to switch operational state (C7).
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 9. Emergency Incidents */}
        {incidents.map((inc) => (
          <Marker
            key={inc.id}
            position={[inc.lat, inc.lng]}
            icon={createIncidentIcon(inc)}
            eventHandlers={{
              click: () => onIncidentClick(inc),
            }}
          >
            <Popup>
              <div className="text-xs space-y-1.5 p-1 min-w-[200px]">
                <div className="flex items-center justify-between border-b border-gray-700 pb-1">
                  <span className="font-bold text-gray-100">{inc.id}</span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: `${getPriorityColor(inc.priority, inc.escalated)}33`,
                      color: getPriorityColor(inc.priority, inc.escalated),
                    }}
                  >
                    Priority {inc.priority} {inc.escalated ? '(ESCALATED)' : ''}
                  </span>
                </div>
                <div className="font-semibold text-amber-300">{inc.title}</div>
                <div className="text-gray-300">
                  Category: <span className="font-bold">{inc.category}</span>
                </div>
                <div className="text-gray-300">
                  Max Response: <span className="font-bold text-sky-300">{inc.time_max_minutes} min</span>
                </div>
                <div className="text-gray-300">Budget: ${inc.budget_max}</div>
                <div className="text-gray-300">
                  Status: <span className="font-bold">{inc.status}</span>
                </div>

                <div className="border-t border-gray-700 pt-1 mt-1">
                  <span className="font-semibold text-gray-200">Required Units:</span>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {Object.entries(inc.required_resources).map(([rt, cnt]) => (
                      <span
                        key={rt}
                        className="text-[10px] px-1 py-0.5 rounded bg-gray-800"
                        style={{ color: getResourceColor(rt) }}
                      >
                        {rt}: {cnt}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-1.5">
                  <button
                    onClick={() => onIncidentClick(inc)}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-2 rounded text-[11px] shadow transition"
                  >
                    Escalate / Worsen Situation
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
