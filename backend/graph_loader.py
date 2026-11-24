import os
import math
import logging
from typing import Dict, List, Tuple, Optional, Any
import networkx as nx
from scipy.spatial import KDTree
import numpy as np

logger = logging.getLogger("graph_loader")
logging.basicConfig(level=logging.INFO)

GRAPH_FILE = os.path.join(os.path.dirname(__file__), "dhaka_emergency_network.graphml")

# Haversine distance in meters
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class DhakaRoadNetwork:
    def __init__(self):
        self.graph: nx.DiGraph = nx.DiGraph()
        self.kdtree: Optional[KDTree] = None
        self.node_ids: List[int] = []
        self.node_coords: np.ndarray = np.empty((0, 2))
        self.blocked_edges: set = set()
        self.hazard_zones: List[Dict[str, Any]] = []

    def load_or_build(self) -> None:
        """Loads cached graphml or attempts OSMnx download with fallback to synthetic grid."""
        if os.path.exists(GRAPH_FILE):
            try:
                logger.info(f"Loading cached graph from {GRAPH_FILE}...")
                raw_g = nx.read_graphml(GRAPH_FILE)
                # Ensure integer node IDs and float attributes
                self.graph = nx.DiGraph()
                for n, data in raw_g.nodes(data=True):
                    nid = int(n) if str(n).isdigit() else hash(n) % 10000000
                    lat = float(data.get('y', data.get('lat', 23.777)))
                    lng = float(data.get('x', data.get('lng', 90.399)))
                    self.graph.add_node(nid, y=lat, x=lng, lat=lat, lng=lng)

                for u, v, data in raw_g.edges(data=True):
                    uid = int(u) if str(u).isdigit() else hash(u) % 10000000
                    vid = int(v) if str(v).isdigit() else hash(v) % 10000000
                    if uid in self.graph and vid in self.graph:
                        length = float(data.get('length', 100.0))
                        speed = float(data.get('speed_kph', 40.0))
                        name = str(data.get('name', 'Dhaka City Road'))
                        time_sec = length / max(1.0, speed * 1000.0 / 3600.0)
                        self.graph.add_edge(uid, vid,
                                            length=length,
                                            speed_kph=speed,
                                            free_flow_time=time_sec,
                                            traffic_factor=1.0,
                                            blocked=False,
                                            hazard_zone=False,
                                            name=name)

                if len(self.graph.nodes) > 100:
                    self._rebuild_spatial_index()
                    logger.info(f"Loaded {len(self.graph.nodes)} nodes and {len(self.graph.edges)} edges from cache.")
                    return
            except Exception as e:
                logger.warning(f"Failed to load cached graphml: {e}. Falling back to building.")

        # Quick check if Overpass API is online and responsive (< 1.5s socket check)
        loaded = False
        import socket
        can_reach_overpass = False
        try:
            s = socket.create_connection(("overpass-api.de", 443), timeout=1.5)
            s.close()
            can_reach_overpass = True
        except Exception:
            can_reach_overpass = False

        if can_reach_overpass and os.environ.get("ENABLE_OSMNX", "0") == "1":
            try:
                import osmnx as ox
                ox.settings.timeout = 5
                ox.settings.requests_timeout = 5
                logger.info("Attempting OSMnx download for Dhaka city center...")
                g_osm = ox.graph_from_point((23.777176, 90.399452), dist=3500, network_type='drive')
                largest_scc = max(nx.strongly_connected_components(g_osm), key=len)
                subgraph = g_osm.subgraph(largest_scc).copy()
                self._import_from_osmnx(subgraph)
                nx.write_graphml(subgraph, GRAPH_FILE)
                loaded = True
                logger.info(f"OSMnx graph acquired and cached with {len(self.graph.nodes)} nodes.")
            except Exception as e:
                logger.info(f"OSMnx download exception: {e}. Using high-fidelity synthetic Dhaka network.")
        else:
            logger.info("Overpass API offline/disabled. Using high-fidelity synthetic Dhaka city network.")

        if not loaded:
            self._build_synthetic_dhaka_network()
            try:
                nx.write_graphml(self.graph, GRAPH_FILE)
                logger.info(f"Synthetic Dhaka graph cached to {GRAPH_FILE}")
            except Exception as e:
                logger.warning(f"Could not write synthetic graphml cache: {e}")

        self._rebuild_spatial_index()

    def _import_from_osmnx(self, osm_g: Any) -> None:
        self.graph = nx.DiGraph()
        for n, data in osm_g.nodes(data=True):
            lat = float(data.get('y', 23.777))
            lng = float(data.get('x', 90.399))
            self.graph.add_node(n, y=lat, x=lng, lat=lat, lng=lng)

        for u, v, data in osm_g.edges(data=True):
            length = float(data.get('length', 100.0))
            maxspeed = data.get('maxspeed', 40.0)
            if isinstance(maxspeed, list):
                maxspeed = maxspeed[0]
            try:
                speed_kph = float(str(maxspeed).split()[0])
            except:
                speed_kph = 40.0
            name = str(data.get('name', 'Dhaka Corridor'))
            time_sec = length / max(1.0, speed_kph * 1000.0 / 3600.0)
            self.graph.add_edge(u, v,
                                length=length,
                                speed_kph=speed_kph,
                                free_flow_time=time_sec,
                                traffic_factor=1.0,
                                blocked=False,
                                hazard_zone=False,
                                name=name)

    def _build_synthetic_dhaka_network(self) -> None:
        """
        Builds a comprehensive, strongly connected road graph of Dhaka city.
        Encompasses Mirpur, Dhanmondi, Shahbagh, Farmgate, Tejgaon, Gulshan, Banani,
        Mohakhali, Uttara, Motijheel, Old Dhaka, Badda, Rampura, and Mohammadpur.
        """
        self.graph = nx.DiGraph()
        nodes_info: Dict[int, Tuple[float, float, str]] = {}
        nid = 1

        # Key Strategic Corridors with fine-grained coordinate waypoints
        corridors = {
            # 1. Mirpur Road (South to North-West)
            "Mirpur Road": [
                (23.7120, 90.3880, "Azimpur / Nilkhet Junction"),
                (23.7260, 90.3840, "New Market / Science Lab"),
                (23.7380, 90.3800, "Kalabagan Bus Stand"),
                (23.7530, 90.3750, "Dhanmondi 27 Junction"),
                (23.7600, 90.3680, "Asad Gate & Manik Mia Concourse"),
                (23.7680, 90.3640, "Shyamoli Square"),
                (23.7800, 90.3580, "Kalyanpur Bus Stand"),
                (23.7870, 90.3520, "Technical Junction"),
                (23.7920, 90.3450, "Gabtoli Gateway")
            ],
            # 2. Begum Rokeya Sarani (Mirpur 10 down to Agargaon and Bijoy Sarani)
            "Begum Rokeya Sarani": [
                (23.8240, 90.3620, "Mirpur 12 Terminal"),
                (23.8150, 90.3660, "Mirpur 11 Circle"),
                (23.8075, 90.3692, "Mirpur 10 Roundabout"),
                (23.7980, 90.3710, "Kazipara Central"),
                (23.7900, 90.3730, "Shewrapara Metro"),
                (23.7780, 90.3780, "Agargaon Admin Hub"),
                (23.7640, 90.3870, "Bijoy Sarani Rokeya Crossing")
            ],
            # 3. Airport / VIP Road Arterial (North to South Central)
            "Airport - VIP Road Corridor": [
                (23.8735, 90.3980, "Uttara North Hub"),
                (23.8520, 90.4020, "Airport Terminal 1 & 2"),
                (23.8370, 90.4100, "Khilkhet Railway Overpass"),
                (23.8225, 90.4045, "Kurmitola & Army HQ"),
                (23.7940, 90.4040, "Banani Kakoli Crossing"),
                (23.7780, 90.4010, "Mohakhali Wireless Gate"),
                (23.7680, 90.3930, "Jahangir Gate / Old Airport"),
                (23.7640, 90.3870, "Bijoy Sarani VIP Crossing"),
                (23.7570, 90.3880, "Farmgate Ananda Crossing"),
                (23.7500, 90.3930, "Kawran Bazar SAARC Fountain"),
                (23.7430, 90.3950, "Bangla Motor Junction"),
                (23.7383, 90.3958, "Shahbagh Circle"),
                (23.7310, 90.4050, "High Court & Matsya Bhaban"),
                (23.7258, 90.3975, "Dhaka Medical College Gate"),
                (23.7226, 90.4078, "Fulbaria & Siddique Bazar")
            ],
            # 4. Pragati Sarani (North-East Arterial)
            "Pragati Sarani Corridor": [
                (23.8200, 90.4240, "Kuril Flyover Hub"),
                (23.8145, 90.4285, "Bashundhara Gate Link"),
                (23.8050, 90.4260, "Nadda Junction"),
                (23.7950, 90.4250, "Notun Bazar Crossing"),
                (23.7880, 90.4255, "Shahjadpur Central"),
                (23.7785, 90.4260, "Badda Link Road"),
                (23.7680, 90.4230, "Madhubagh & Hatirjheel North"),
                (23.7610, 90.4210, "Rampura Bridge Crossing"),
                (23.7510, 90.4255, "Khilgaon Malibagh Crossing"),
                (23.7400, 90.4280, "Sayedabad North")
            ],
            # 5. Satmasjid Road (West Dhanmondi)
            "Satmasjid Road": [
                (23.7660, 90.3590, "Mohammadpur Town Hall"),
                (23.7570, 90.3660, "Shankar Bus Stand"),
                (23.7538, 90.3700, "Dhanmondi 27 West"),
                (23.7460, 90.3720, "Dhanmondi 15 / Abahani Ground"),
                (23.7380, 90.3740, "Dhanmondi 8 & Zigatola"),
                (23.7320, 90.3760, "Dhanmondi 2 & City College"),
                (23.7260, 90.3840, "Science Lab Intersection")
            ],
            # 6. Hatirjheel Expressway Loop (Tejgaon - Mohakhali - Rampura - Moghbazar)
            "Hatirjheel Expressway Loop": [
                (23.7680, 90.3930, "Hatirjheel West Gate (Tejgaon)"),
                (23.7730, 90.4020, "Hatirjheel Police Plaza Link"),
                (23.7720, 90.4140, "Hatirjheel Gudara Ghat"),
                (23.7680, 90.4230, "Hatirjheel Rampura Link"),
                (23.7620, 90.4160, "Hatirjheel Moghbazar Link"),
                (23.7640, 90.4020, "Hatirjheel Central Island Link")
            ],
            # 7. Motijheel & Old Dhaka Spine
            "Motijheel - Old Dhaka Corridor": [
                (23.7335, 90.4175, "Motijheel Shapla Chattar"),
                (23.7280, 90.4210, "Ittefaq Crossing / Rajuk"),
                (23.7226, 90.4078, "Fulbaria Central"),
                (23.7185, 90.3885, "Lalbagh Fort Gate"),
                (23.7125, 90.4020, "Mitford Hospital Gate"),
                (23.7100, 90.4110, "Victoria Park Sadarghat"),
                (23.7115, 90.4355, "Jatrabari Roundabout")
            ]
        }

        # Build nodes from corridors and add linear chain edges
        corridor_node_chains: Dict[str, List[int]] = {}
        for cname, pts in corridors.items():
            chain = []
            for lat, lng, desc in pts:
                # Check if node already exists nearby (< 50m) to cross-link
                existing_nid = None
                for ex_id, (ex_lat, ex_lng, _) in nodes_info.items():
                    if haversine_distance(lat, lng, ex_lat, ex_lng) < 60.0:
                        existing_nid = ex_id
                        break
                if existing_nid is None:
                    curr_nid = nid
                    nid += 1
                    nodes_info[curr_nid] = (lat, lng, desc)
                    self.graph.add_node(curr_nid, y=lat, x=lng, lat=lat, lng=lng, name=desc)
                    chain.append(curr_nid)
                else:
                    chain.append(existing_nid)
            corridor_node_chains[cname] = chain

        # Connect corridor sequential waypoints (bidirectional avenues)
        for cname, chain in corridor_node_chains.items():
            speed = 50.0 if "Airport" in cname or "Hatirjheel" in cname else 40.0
            for i in range(len(chain) - 1):
                u, v = chain[i], chain[i+1]
                lat1, lon1, _ = nodes_info[u]
                lat2, lon2, _ = nodes_info[v]
                dist = haversine_distance(lat1, lon1, lat2, lon2)
                time_sec = dist / max(1.0, speed * 1000.0 / 3600.0)
                self.graph.add_edge(u, v, length=dist, speed_kph=speed, free_flow_time=time_sec,
                                    traffic_factor=1.0, blocked=False, hazard_zone=False, name=cname)
                self.graph.add_edge(v, u, length=dist, speed_kph=speed, free_flow_time=time_sec,
                                    traffic_factor=1.0, blocked=False, hazard_zone=False, name=cname)

        # Cross-linking Arterials: Major Dhaka Transverse Connectors
        cross_links = [
            # Manik Mia Avenue: Mirpur Rd (Asad Gate) <-> Farmgate VIP Rd
            ("Manik Mia Avenue", (23.7600, 90.3680), (23.7570, 90.3880), 50.0),
            # Panthapath: Dhanmondi 27 East <-> Kawran Bazar SAARC Fountain (passes Square Hosp)
            ("Panthapath Expressway", (23.7530, 90.3750), (23.7500, 90.3930), 45.0),
            # Bijoy Sarani: Rokeya Sarani <-> VIP Rd Old Airport
            ("Bijoy Sarani Avenue", (23.7640, 90.3870), (23.7680, 90.3930), 50.0),
            # Kemal Ataturk Avenue: Banani Kakoli <-> Gulshan 2
            ("Kemal Ataturk Ave", (23.7940, 90.4040), (23.7925, 90.4167), 45.0),
            # Gulshan 1 to Badda Link
            ("Gulshan-Badda Link Road", (23.7800, 90.4150), (23.7785, 90.4260), 40.0),
            # Gulshan 2 to Notun Bazar
            ("Madani Avenue Link", (23.7925, 90.4167), (23.7950, 90.4250), 45.0),
            # Mohakhali Flyover to Tejgaon
            ("Tejgaon-Mohakhali Link", (23.7780, 90.4010), (23.7600, 90.3980), 40.0),
            # Moghbazar-Mouchak-Malibagh Flyover
            ("Moghbazar Flyover Corridor", (23.7500, 90.4050), (23.7510, 90.4255), 45.0),
            # Farmgate to Green Road / Panthapath
            ("Green Road", (23.7570, 90.3880), (23.7480, 90.3830), 35.0),
            # Shahbagh to Motijheel
            ("Topkhana Road", (23.7383, 90.3958), (23.7335, 90.4175), 40.0),
            # Old Dhaka Sadarghat to Jatrabari
            ("Dholai Khal Road", (23.7100, 90.4110), (23.7115, 90.4355), 35.0),
            # Mirpur 10 to Technical Junction (Darussalam Road)
            ("Darussalam Road", (23.8075, 90.3692), (23.7870, 90.3520), 40.0),
            # Agargaon to Shyamoli (Sher-e-Bangla Nagar Road)
            ("Sher-e-Bangla Nagar Link", (23.7780, 90.3780), (23.7680, 90.3640), 40.0),
            # Kuril to Uttara Expressway
            ("Airport-Kuril Connector", (23.8370, 90.4100), (23.8200, 90.4240), 55.0),
            # Rampura to Malibagh / Khilgaon
            ("DIT Road", (23.7610, 90.4210), (23.7510, 90.4255), 40.0),
            # Mohammadpur to Asad Gate
            ("Asad Avenue", (23.7660, 90.3590), (23.7600, 90.3680), 40.0)
        ]

        for link_name, pt1, pt2, speed in cross_links:
            # find closest existing nodes for pt1 and pt2
            best_u = min(nodes_info.keys(), key=lambda k: haversine_distance(pt1[0], pt1[1], nodes_info[k][0], nodes_info[k][1]))
            best_v = min(nodes_info.keys(), key=lambda k: haversine_distance(pt2[0], pt2[1], nodes_info[k][0], nodes_info[k][1]))
            if best_u != best_v:
                d = haversine_distance(nodes_info[best_u][0], nodes_info[best_u][1], nodes_info[best_v][0], nodes_info[best_v][1])
                t = d / max(1.0, speed * 1000.0 / 3600.0)
                self.graph.add_edge(best_u, best_v, length=d, speed_kph=speed, free_flow_time=t,
                                    traffic_factor=1.0, blocked=False, hazard_zone=False, name=link_name)
                self.graph.add_edge(best_v, best_u, length=d, speed_kph=speed, free_flow_time=t,
                                    traffic_factor=1.0, blocked=False, hazard_zone=False, name=link_name)

        # Generate intermediate residential grid mesh nodes to give high spatial resolution (~400 nodes)
        clusters = [
            ("Dhanmondi Sector", 23.746, 90.375, 4, 4, 0.005),
            ("Gulshan Residential", 23.785, 90.412, 4, 4, 0.005),
            ("Banani Residential", 23.792, 90.402, 3, 3, 0.005),
            ("Mirpur Sector", 23.805, 90.365, 4, 4, 0.006),
            ("Uttara Sector", 23.865, 90.395, 4, 4, 0.006),
            ("Tejgaon Industrial", 23.762, 90.392, 3, 3, 0.005),
            ("Badda Waterfront", 23.775, 90.422, 3, 3, 0.005),
            ("Mohammadpur Housing", 23.762, 90.355, 3, 3, 0.005),
            ("Old Dhaka Alleys", 23.715, 90.400, 4, 3, 0.004)
        ]

        for c_title, base_lat, base_lng, rows, cols, step in clusters:
            grid_nids = []
            for r in range(rows):
                row_ids = []
                for c in range(cols):
                    glat = base_lat + (r - rows / 2) * step
                    glng = base_lng + (c - cols / 2) * step
                    curr_id = nid
                    nid += 1
                    g_desc = f"{c_title} Block {r+1}-{c+1}"
                    nodes_info[curr_id] = (glat, glng, g_desc)
                    self.graph.add_node(curr_id, y=glat, x=glng, lat=glat, lng=glng, name=g_desc)
                    row_ids.append(curr_id)
                grid_nids.append(row_ids)

            # Connect internal grid
            for r in range(rows):
                for c in range(cols):
                    u = grid_nids[r][c]
                    # Right neighbor
                    if c + 1 < cols:
                        v = grid_nids[r][c+1]
                        dist = haversine_distance(nodes_info[u][0], nodes_info[u][1], nodes_info[v][0], nodes_info[v][1])
                        t = dist / (30.0 * 1000.0 / 3600.0)
                        self.graph.add_edge(u, v, length=dist, speed_kph=30.0, free_flow_time=t, traffic_factor=1.0, blocked=False, hazard_zone=False, name=f"{c_title} Internal")
                        self.graph.add_edge(v, u, length=dist, speed_kph=30.0, free_flow_time=t, traffic_factor=1.0, blocked=False, hazard_zone=False, name=f"{c_title} Internal")
                    # Down neighbor
                    if r + 1 < rows:
                        v = grid_nids[r+1][c]
                        dist = haversine_distance(nodes_info[u][0], nodes_info[u][1], nodes_info[v][0], nodes_info[v][1])
                        t = dist / (30.0 * 1000.0 / 3600.0)
                        self.graph.add_edge(u, v, length=dist, speed_kph=30.0, free_flow_time=t, traffic_factor=1.0, blocked=False, hazard_zone=False, name=f"{c_title} Internal")
                        self.graph.add_edge(v, u, length=dist, speed_kph=30.0, free_flow_time=t, traffic_factor=1.0, blocked=False, hazard_zone=False, name=f"{c_title} Internal")

            # Connect all corner and border nodes to the 2 closest arterial nodes (bidirectional)
            art_nodes = [k for k in nodes_info.keys() if k < 70]
            for r in range(rows):
                for c in range(cols):
                    if r in (0, rows-1) or c in (0, cols-1):
                        corner = grid_nids[r][c]
                        clat, clng, _ = nodes_info[corner]
                        if art_nodes:
                            # 2 closest arterial nodes
                            sorted_art = sorted(art_nodes, key=lambda k: haversine_distance(clat, clng, nodes_info[k][0], nodes_info[k][1]))
                            for closest_art in sorted_art[:2]:
                                dist = haversine_distance(clat, clng, nodes_info[closest_art][0], nodes_info[closest_art][1])
                                t = dist / (35.0 * 1000.0 / 3600.0)
                                self.graph.add_edge(corner, closest_art, length=dist, speed_kph=35.0, free_flow_time=t, traffic_factor=1.0, blocked=False, hazard_zone=False, name=f"{c_title} Feeder")
                                self.graph.add_edge(closest_art, corner, length=dist, speed_kph=35.0, free_flow_time=t, traffic_factor=1.0, blocked=False, hazard_zone=False, name=f"{c_title} Feeder")

        # Guarantee strong connectivity: extract largest strongly connected component
        if not nx.is_strongly_connected(self.graph):
            largest_scc = max(nx.strongly_connected_components(self.graph), key=len)
            self.graph = self.graph.subgraph(largest_scc).copy()

    def _rebuild_spatial_index(self) -> None:
        """Builds KDTree index for quick nearest-node queries."""
        self.node_ids = list(self.graph.nodes())
        coords = []
        for nid in self.node_ids:
            node = self.graph.nodes[nid]
            lat = float(node.get('lat', node.get('y', 23.777)))
            lng = float(node.get('lng', node.get('x', 90.399)))
            coords.append([lat, lng])
        self.node_coords = np.array(coords)
        if len(self.node_coords) > 0:
            self.kdtree = KDTree(self.node_coords)

    def find_nearest_node(self, lat: float, lng: float) -> int:
        """Returns the node_id closest to the specified lat/lng."""
        if self.kdtree is None or len(self.node_ids) == 0:
            return 1
        _, idx = self.kdtree.query([lat, lng])
        return self.node_ids[idx]

    def set_edge_constraint(self, u: int, v: int, blocked: Optional[bool] = None,
                            traffic_factor: Optional[float] = None, hazard_zone: Optional[bool] = None) -> bool:
        """Modifies edge attributes dynamically."""
        changed = False
        for edge_tuple in [(u, v), (v, u)]:
            eu, ev = edge_tuple
            if self.graph.has_edge(eu, ev):
                if blocked is not None:
                    self.graph[eu][ev]['blocked'] = blocked
                if traffic_factor is not None:
                    self.graph[eu][ev]['traffic_factor'] = max(1.0, min(5.0, traffic_factor))
                if hazard_zone is not None:
                    self.graph[eu][ev]['hazard_zone'] = hazard_zone
                changed = True
        return changed

    def add_hazard_zone(self, lat: float, lng: float, radius_meters: float = 600.0) -> int:
        """Marks edges within a hazard radius as impassable."""
        zone_id = len(self.hazard_zones) + 1
        self.hazard_zones.append({"id": zone_id, "lat": lat, "lng": lng, "radius": radius_meters})
        affected_edges = 0
        for u, v, data in self.graph.edges(data=True):
            u_lat = self.graph.nodes[u]['lat']
            u_lng = self.graph.nodes[u]['lng']
            if haversine_distance(lat, lng, u_lat, u_lng) <= radius_meters:
                data['hazard_zone'] = True
                affected_edges += 1
        return affected_edges

    def clear_hazard_zones(self) -> None:
        self.hazard_zones.clear()
        for u, v, data in self.graph.edges(data=True):
            data['hazard_zone'] = False
            data['blocked'] = False
            data['traffic_factor'] = 1.0

    def compute_route(self, source_node: int, target_node: int) -> Optional[Dict[str, Any]]:
        """
        Calculates shortest path using Dijkstra with dynamic travel time weights.
        Returns travel time (minutes), distance (km), node path, and coordinate list.
        """
        def edge_weight(u, v, d):
            if d.get('blocked', False) or d.get('hazard_zone', False):
                return float('inf')
            base_time = d.get('free_flow_time', 60.0)
            traffic = d.get('traffic_factor', 1.0)
            return base_time * traffic

        try:
            path = nx.shortest_path(self.graph, source=source_node, target=target_node, weight=edge_weight)
            total_time_sec = 0.0
            total_dist_m = 0.0
            coords = []
            for i in range(len(path) - 1):
                u, v = path[i], path[i+1]
                edge_data = self.graph[u][v]
                w = edge_weight(u, v, edge_data)
                if math.isinf(w):
                    return None
                total_time_sec += w
                total_dist_m += edge_data.get('length', 100.0)

            for nid in path:
                n = self.graph.nodes[nid]
                coords.append([float(n['lat']), float(n['lng'])])

            return {
                "path_nodes": path,
                "path_coords": coords,
                "distance_km": round(total_dist_m / 1000.0, 3),
                "travel_time_min": round(total_time_sec / 60.0, 2)
            }
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

    def precompute_routes_matrix(self, center_node_ids: List[int], incident_node_ids: List[int]) -> Dict[Tuple[int, int], Dict[str, Any]]:
        """
        Precomputes travel times and paths from all Resource Center nodes to all Incident nodes.
        Uses single-source Dijkstra per center.
        """
        matrix: Dict[Tuple[int, int], Dict[str, Any]] = {}
        unique_centers = set(center_node_ids)
        target_set = set(incident_node_ids)

        def edge_weight(u, v, d):
            if d.get('blocked', False) or d.get('hazard_zone', False):
                return float('inf')
            return d.get('free_flow_time', 60.0) * d.get('traffic_factor', 1.0)

        for c_node in unique_centers:
            if c_node not in self.graph:
                continue
            try:
                lengths, paths = nx.single_source_dijkstra(self.graph, source=c_node, weight=edge_weight)
                for inc_node in target_set:
                    if inc_node in paths:
                        path = paths[inc_node]
                        time_sec = lengths[inc_node]
                        if math.isinf(time_sec):
                            continue
                        dist_m = sum(self.graph[path[i]][path[i+1]].get('length', 100.0) for i in range(len(path)-1))
                        matrix[(c_node, inc_node)] = {
                            "path_nodes": path,
                            "distance_km": round(dist_m / 1000.0, 3),
                            "travel_time_min": round(time_sec / 60.0, 2)
                        }
            except Exception as e:
                logger.error(f"Error in precomputing routes for center {c_node}: {e}")

        return matrix

    def get_path_coords(self, path_nodes: List[int]) -> List[List[float]]:
        """Constructs coordinate polyline for given node path on demand."""
        return [[float(self.graph.nodes[nid]['lat']), float(self.graph.nodes[nid]['lng'])] for nid in path_nodes]

# Singleton instance
dhaka_network = DhakaRoadNetwork()
