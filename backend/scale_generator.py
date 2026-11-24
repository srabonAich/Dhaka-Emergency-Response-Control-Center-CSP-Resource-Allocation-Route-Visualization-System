import random
from typing import List, Tuple, Dict, Any
from backend.models import (
    EmergencyIncident, ResourceCenter, ResourceInventory,
    EmergencyCategory, CATEGORY_REQUIREMENTS, PRIORITY_MAX_TIMES
)
from backend.dhaka_landmarks import DHAKA_LANDMARKS, RAW_RESOURCE_CENTERS
from backend.graph_loader import dhaka_network

CATEGORIES: List[EmergencyCategory] = [
    "Medical Emergency",
    "Fire",
    "Accident",
    "Flood",
    "Earthquake",
    "Crime",
    "Other"
]

def generate_scale_scenario(
    scale: str = "Small"
) -> Tuple[List[EmergencyIncident], List[ResourceCenter]]:
    """
    Generates incidents and active resource centers for Small, Medium, or Large presets.
    - Small: 25 incidents, 6 resource centers
    - Medium: 120 incidents, 14 resource centers
    - Large: 220 incidents, 28 resource centers
    """
    random.seed(42 if scale == "Small" else (108 if scale == "Medium" else 2024))

    if scale == "Small":
        num_incidents = 25
        num_centers = 6
        cap_multiplier = 0.5
    elif scale == "Medium":
        num_incidents = 120
        num_centers = 14
        cap_multiplier = 1.0
    else:  # Large
        num_incidents = 220
        num_centers = len(RAW_RESOURCE_CENTERS)  # all 28
        cap_multiplier = 2.0

    # Build Resource Centers
    selected_raw_centers = RAW_RESOURCE_CENTERS[:num_centers]
    centers: List[ResourceCenter] = []

    for raw in selected_raw_centers:
        inv: Dict[str, ResourceInventory] = {}
        for r_type, b_inv in raw["base_inventory"].items():
            scaled_cap = max(2, int(b_inv["cap"] * cap_multiplier))
            inv[r_type] = ResourceInventory(
                total_capacity=scaled_cap,
                available_units=scaled_cap,
                unit_cost=b_inv["cost"],
                capability_tags=b_inv["tags"]
            )
        node_id = dhaka_network.find_nearest_node(raw["lat"], raw["lng"])
        centers.append(ResourceCenter(
            id=raw["id"],
            name=raw["name"],
            area=raw["area"],
            lat=raw["lat"],
            lng=raw["lng"],
            node_id=node_id,
            operational=True,
            inventory=inv
        ))

    # Build Emergency Incidents
    incidents: List[EmergencyIncident] = []
    # Weighted priority distribution: 25% Critical(5), 35% High(4), 25% Medium(3), 15% Low(1-2)
    priority_pool = [5, 5, 4, 4, 4, 3, 3, 2, 1]

    for idx in range(num_incidents):
        lm = DHAKA_LANDMARKS[idx % len(DHAKA_LANDMARKS)]
        # Add slight jitter to simulate realistic spread across Dhaka
        jitter_lat = random.uniform(-0.007, 0.007)
        jitter_lng = random.uniform(-0.007, 0.007)
        inc_lat = round(lm["lat"] + jitter_lat, 6)
        inc_lng = round(lm["lng"] + jitter_lng, 6)
        node_id = dhaka_network.find_nearest_node(inc_lat, inc_lng)

        cat = random.choice(CATEGORIES)
        prio = random.choice(priority_pool)
        req_types = CATEGORY_REQUIREMENTS[cat]
        req_dict: Dict[str, int] = {}
        for rt in req_types:
            req_dict[rt] = random.choice([1, 1, 2]) if prio >= 4 else 1

        incidents.append(EmergencyIncident(
            id=f"INC-{idx+1:03d}",
            title=f"{cat} near {lm['name']}",
            category=cat,
            priority=prio,
            lat=inc_lat,
            lng=inc_lng,
            node_id=node_id,
            required_resources=req_dict,
            escalated=False,
            escalation_count=0,
            budget_max=16000.0 if prio >= 4 else 12000.0,
            time_max_minutes=PRIORITY_MAX_TIMES.get(prio, 40.0),
            status="PENDING"
        ))

    return incidents, centers
