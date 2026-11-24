from typing import List, Dict, Any

# Prominent Dhaka Landmark coordinates for realistic incident sampling and GIS context
DHAKA_LANDMARKS: List[Dict[str, Any]] = [
    {"name": "Shahbagh Intersection", "area": "Shahbagh", "lat": 23.7383, "lng": 90.3958},
    {"name": "Dhanmondi Lake & Rd 27", "area": "Dhanmondi", "lat": 23.7525, "lng": 90.3752},
    {"name": "Farmgate Junction", "area": "Farmgate", "lat": 23.7570, "lng": 90.3880},
    {"name": "Mirpur 10 Circle", "area": "Mirpur", "lat": 23.8069, "lng": 90.3687},
    {"name": "Gulshan 2 Circle", "area": "Gulshan", "lat": 23.7925, "lng": 90.4167},
    {"name": "Banani Road 11", "area": "Banani", "lat": 23.7937, "lng": 90.4042},
    {"name": "Motijheel Commercial Area", "area": "Motijheel", "lat": 23.7330, "lng": 90.4172},
    {"name": "Uttara Sector 7 Plaza", "area": "Uttara", "lat": 23.8728, "lng": 90.3984},
    {"name": "Mohammadpur Town Hall", "area": "Mohammadpur", "lat": 23.7658, "lng": 90.3584},
    {"name": "Badda Link Road", "area": "Badda", "lat": 23.7785, "lng": 90.4255},
    {"name": "Tejgaon Industrial Area", "area": "Tejgaon", "lat": 23.7600, "lng": 90.3980},
    {"name": "Mohakhali Wireless Gate", "area": "Mohakhali", "lat": 23.7780, "lng": 90.4010},
    {"name": "Bashundhara R/A Gate", "area": "Bashundhara", "lat": 23.8150, "lng": 90.4280},
    {"name": "Rampura Bridge", "area": "Rampura", "lat": 23.7610, "lng": 90.4210},
    {"name": "Old Dhaka Victoria Park", "area": "Old Dhaka", "lat": 23.7100, "lng": 90.4110},
    {"name": "Jatrabari Flyover End", "area": "Jatrabari", "lat": 23.7110, "lng": 90.4350},
    {"name": "Kawran Bazar Rail Crossing", "area": "Kawran Bazar", "lat": 23.7500, "lng": 90.3930},
    {"name": "Gabtoli Bus Terminal", "area": "Gabtoli", "lat": 23.7840, "lng": 90.3450},
    {"name": "Hatirjheel Amphitheater", "area": "Hatirjheel", "lat": 23.7675, "lng": 90.4120},
    {"name": "Bijoy Sarani Intersection", "area": "Bijoy Sarani", "lat": 23.7640, "lng": 90.3870},
    {"name": "Agargaon Metro Station", "area": "Agargaon", "lat": 23.7780, "lng": 90.3780},
    {"name": "Malibagh Chowdhury Para", "area": "Malibagh", "lat": 23.7550, "lng": 90.4150},
]

# 28 Pre-populated Resource Centers across Dhaka Metropolitan Area
RAW_RESOURCE_CENTERS: List[Dict[str, Any]] = [
    {
        "id": "RC-DMCH",
        "name": "Dhaka Medical College Hospital Base",
        "area": "Shahbagh",
        "lat": 23.7258,
        "lng": 90.3975,
        "operational": True,
        "base_inventory": {
            "Ambulance": {"cap": 14, "cost": 150.0, "tags": ["ICU Support", "Advanced Life Support", "Basic Transport"]},
            "Rescue Team": {"cap": 4, "cost": 300.0, "tags": ["Triage", "Medical Rescue"]},
            "Relief Team": {"cap": 5, "cost": 180.0, "tags": ["First Aid Relief", "Blood Depot"]}
        }
    },
    {
        "id": "RC-SQUARE",
        "name": "Square Hospital Emergency Hub",
        "area": "Panthapath",
        "lat": 23.7532,
        "lng": 90.3814,
        "operational": True,
        "base_inventory": {
            "Ambulance": {"cap": 10, "cost": 220.0, "tags": ["Cardiac Ambulance", "Trauma Unit"]},
            "Rescue Team": {"cap": 2, "cost": 350.0, "tags": ["Specialist Response"]}
        }
    },
    {
        "id": "RC-KURMITOLA",
        "name": "Kurmitola General Hospital",
        "area": "Cantonment",
        "lat": 23.8225,
        "lng": 90.4045,
        "operational": True,
        "base_inventory": {
            "Ambulance": {"cap": 12, "cost": 160.0, "tags": ["Armed Forces Support", "Isolation Unit"]},
            "Rescue Team": {"cap": 6, "cost": 280.0, "tags": ["Military Disaster Squad"]},
            "Relief Team": {"cap": 8, "cost": 140.0, "tags": ["Mass Casualty Tents"]}
        }
    },
    {
        "id": "RC-SIDDIQUE-FS",
        "name": "Siddique Bazar Fire & Civil Defence HQ",
        "area": "Fulbaria",
        "lat": 23.7226,
        "lng": 90.4078,
        "operational": True,
        "base_inventory": {
            "Fire Brigade": {"cap": 12, "cost": 400.0, "tags": ["Turntable Ladder", "Chemical Foam Unit", "Heavy Water Tender"]},
            "Rescue Team": {"cap": 8, "cost": 320.0, "tags": ["Urban Search & Rescue", "Collapsed Structure Specialist"]},
            "Ambulance": {"cap": 4, "cost": 140.0, "tags": ["Fire Service Medic"]}
        }
    },
    {
        "id": "RC-MIRPUR-FS",
        "name": "Mirpur Fire & Rescue Station",
        "area": "Mirpur-10",
        "lat": 23.8075,
        "lng": 90.3692,
        "operational": True,
        "base_inventory": {
            "Fire Brigade": {"cap": 8, "cost": 380.0, "tags": ["Hydraulic Snorkel", "Water Tender"]},
            "Rescue Team": {"cap": 6, "cost": 310.0, "tags": ["Industrial Zone Rescue", "Boat Squad"]},
            "Ambulance": {"cap": 4, "cost": 150.0, "tags": ["Burn & Trauma Transport"]}
        }
    },
    {
        "id": "RC-TEJGAON-FS",
        "name": "Tejgaon Fire & Emergency Station",
        "area": "Tejgaon",
        "lat": 23.7594,
        "lng": 90.3912,
        "operational": True,
        "base_inventory": {
            "Fire Brigade": {"cap": 9, "cost": 390.0, "tags": ["Industrial Chemical Hazard", "Rapid Water Pump"]},
            "Ambulance": {"cap": 5, "cost": 160.0, "tags": ["Burn Stabilization"]}
        }
    },
    {
        "id": "RC-DMP-TEJGAON",
        "name": "DMP Tejgaon Police Division HQ",
        "area": "Bijoy Sarani",
        "lat": 23.7642,
        "lng": 90.3872,
        "operational": True,
        "base_inventory": {
            "Police Personnel": {"cap": 25, "cost": 100.0, "tags": ["Riot Control", "Crime Scene Unit", "Traffic Dispatch"]},
            "Rescue Team": {"cap": 3, "cost": 250.0, "tags": ["VIP Rapid Response"]}
        }
    },
    {
        "id": "RC-DMP-GULSHAN",
        "name": "DMP Gulshan Division Police Hub",
        "area": "Gulshan-2",
        "lat": 23.7928,
        "lng": 90.4170,
        "operational": True,
        "base_inventory": {
            "Police Personnel": {"cap": 22, "cost": 110.0, "tags": ["Diplomatic Security", "Tactical Squad"]},
            "Ambulance": {"cap": 3, "cost": 180.0, "tags": ["Emergency Patrol Medic"]}
        }
    },
    {
        "id": "RC-DMP-DHANMONDI",
        "name": "DMP Dhanmondi Station",
        "area": "Dhanmondi Rd 27",
        "lat": 23.7538,
        "lng": 90.3745,
        "operational": True,
        "base_inventory": {
            "Police Personnel": {"cap": 18, "cost": 95.0, "tags": ["Crowd Management", "Patrol Car Units"]}
        }
    },
    {
        "id": "RC-RED-CRESCENT",
        "name": "Bangladesh Red Crescent Disaster Depot",
        "area": "Mohakhali",
        "lat": 23.7788,
        "lng": 90.4050,
        "operational": True,
        "base_inventory": {
            "Relief Team": {"cap": 20, "cost": 120.0, "tags": ["Clean Water Tanker", "Emergency Food Ration", "Dry Supplies"]},
            "Rescue Team": {"cap": 10, "cost": 270.0, "tags": ["Flood Disaster Evacuation", "Inflatable Rafts"]},
            "Ambulance": {"cap": 6, "cost": 140.0, "tags": ["Mobile Field Clinic"]}
        }
    },
    {
        "id": "RC-CANTONMENT-BASE",
        "name": "Dhaka Cantonment Disaster Command",
        "area": "Cantonment",
        "lat": 23.8240,
        "lng": 90.3940,
        "operational": True,
        "base_inventory": {
            "Rescue Team": {"cap": 14, "cost": 340.0, "tags": ["Heavy Earth Movers", "Earthquake SAR", "Canine Unit"]},
            "Fire Brigade": {"cap": 6, "cost": 410.0, "tags": ["Aviation Fire Truck"]},
            "Relief Team": {"cap": 15, "cost": 150.0, "tags": ["Military Field Logistics"]}
        }
    },
    {
        "id": "RC-UTTARA-FIRE-TRAUMA",
        "name": "Uttara Fire & Trauma Rescue Station",
        "area": "Uttara Sector 7",
        "lat": 23.8735,
        "lng": 90.3980,
        "operational": True,
        "base_inventory": {
            "Fire Brigade": {"cap": 8, "cost": 370.0, "tags": ["Airport Perimeter Response", "High Rise Foam"]},
            "Ambulance": {"cap": 8, "cost": 160.0, "tags": ["Highway Trauma Response"]},
            "Rescue Team": {"cap": 5, "cost": 290.0, "tags": ["North Suburb SAR"]}
        }
    },
    {
        "id": "RC-BADDA-UNIT",
        "name": "Badda & Rampura Flood Mitigation Unit",
        "area": "Badda",
        "lat": 23.7780,
        "lng": 90.4260,
        "operational": True,
        "base_inventory": {
            "Rescue Team": {"cap": 8, "cost": 280.0, "tags": ["Speedboats", "Flash Flood Retrieval"]},
            "Relief Team": {"cap": 12, "cost": 130.0, "tags": ["Low-lying Community Supplies"]},
            "Police Personnel": {"cap": 10, "cost": 95.0, "tags": ["Evacuation Security"]}
        }
    },
    {
        "id": "RC-MOHAMMADPUR-BASE",
        "name": "Mohammadpur Emergency Base & Trauma",
        "area": "Mohammadpur",
        "lat": 23.7660,
        "lng": 90.3590,
        "operational": True,
        "base_inventory": {
            "Ambulance": {"cap": 8, "cost": 155.0, "tags": ["West Dhaka Transport"]},
            "Police Personnel": {"cap": 14, "cost": 100.0, "tags": ["Beribadh Patrol", "Crime Response"]},
            "Rescue Team": {"cap": 4, "cost": 300.0, "tags": ["Riverbank Flood Squad"]}
        }
    },
    {
        "id": "RC-MOTIJHEEL-HUB",
        "name": "Motijheel Security & Medical Outpost",
        "area": "Motijheel",
        "lat": 23.7335,
        "lng": 90.4175,
        "operational": True,
        "base_inventory": {
            "Police Personnel": {"cap": 20, "cost": 105.0, "tags": ["Financial District Security", "Traffic Command"]},
            "Ambulance": {"cap": 5, "cost": 170.0, "tags": ["CBD Medical Rapid Response"]}
        }
    },
    {
        "id": "RC-EVERCARE-BASHUNDHARA",
        "name": "Evercare Hospital Emergency Base",
        "area": "Bashundhara",
        "lat": 23.8145,
        "lng": 90.4285,
        "operational": True,
        "base_inventory": {
            "Ambulance": {"cap": 9, "cost": 230.0, "tags": ["Critical ICU Carrier", "Pediatric Trauma"]},
            "Rescue Team": {"cap": 2, "cost": 360.0, "tags": ["Advanced Medical Extraction"]}
        }
    },
    {
        "id": "RC-SSMC-OLD-DHAKA",
        "name": "Sir Salimullah Medical (Mitford) Hub",
        "area": "Old Dhaka",
        "lat": 23.7125,
        "lng": 90.4020,
        "operational": True,
        "base_inventory": {
            "Ambulance": {"cap": 9, "cost": 145.0, "tags": ["Narrow Alley Medic", "Buriganga Riverfront"]},
            "Rescue Team": {"cap": 5, "cost": 290.0, "tags": ["Building Collapse Response"]},
            "Fire Brigade": {"cap": 4, "cost": 380.0, "tags": ["Old Quarter Mini Fire Unit"]}
        }
    },
    {
        "id": "RC-JATRABARI-POLICE",
        "name": "Jatrabari Transport & Rapid Police Post",
        "area": "Jatrabari",
        "lat": 23.7115,
        "lng": 90.4355,
        "operational": True,
        "base_inventory": {
            "Police Personnel": {"cap": 16, "cost": 95.0, "tags": ["Highway Patrol", "Traffic Clearance"]},
            "Ambulance": {"cap": 4, "cost": 150.0, "tags": ["Highway Accident Transport"]}
        }
    },
    {
        "id": "RC-BARIDHARA-DIPLOMATIC",
        "name": "Baridhara Special Security Station",
        "area": "Baridhara",
        "lat": 23.7995,
        "lng": 90.4245,
        "operational": True,
        "base_inventory": {
            "Police Personnel": {"cap": 15, "cost": 130.0, "tags": ["Diplomatic Protection", "Tactical Arms"]},
            "Ambulance": {"cap": 3, "cost": 200.0, "tags": ["Rapid Escort Medic"]}
        }
    },
    {
        "id": "RC-KAFRUL-DISASTER",
        "name": "Kafrul Disaster Mitigation Outpost",
        "area": "Kafrul",
        "lat": 23.7905,
        "lng": 90.3855,
        "operational": True,
        "base_inventory": {
            "Rescue Team": {"cap": 5, "cost": 280.0, "tags": ["Dense Urban Search", "Sewerage Hazard Rescue"]},
            "Relief Team": {"cap": 6, "cost": 135.0, "tags": ["Shelter Deployment"]}
        }
    },
    {
        "id": "RC-PALLABI-FIRE",
        "name": "Pallabi & Mirpur-12 Fire Outpost",
        "area": "Pallabi",
        "lat": 23.8245,
        "lng": 90.3625,
        "operational": True,
        "base_inventory": {
            "Fire Brigade": {"cap": 6, "cost": 375.0, "tags": ["Residential Complex Foam Unit"]},
            "Ambulance": {"cap": 4, "cost": 150.0, "tags": ["Standard Transport"]}
        }
    },
    {
        "id": "RC-SUHRAWARDY",
        "name": "Shaheed Suhrawardy Medical College",
        "area": "Sher-e-Bangla Nagar",
        "lat": 23.7712,
        "lng": 90.3708,
        "operational": True,
        "base_inventory": {
            "Ambulance": {"cap": 11, "cost": 155.0, "tags": ["Government Trauma Care", "Surgical Transport"]},
            "Relief Team": {"cap": 7, "cost": 140.0, "tags": ["Medical Camp Deployment"]}
        }
    },
    {
        "id": "RC-GABTOLI-RESCUE",
        "name": "Gabtoli River & Highway Rescue Post",
        "area": "Gabtoli",
        "lat": 23.7845,
        "lng": 90.3455,
        "operational": True,
        "base_inventory": {
            "Rescue Team": {"cap": 6, "cost": 290.0, "tags": ["Turag River Diver Team", "Highway Extraction"]},
            "Police Personnel": {"cap": 12, "cost": 95.0, "tags": ["Inter-district Gateway Security"]}
        }
    },
    {
        "id": "RC-HATIRJHEEL-PATROL",
        "name": "Hatirjheel Waterway & Police Outpost",
        "area": "Hatirjheel",
        "lat": 23.7680,
        "lng": 90.4125,
        "operational": True,
        "base_inventory": {
            "Police Personnel": {"cap": 10, "cost": 100.0, "tags": ["Expressway Surveillance", "Water Patrol"]},
            "Rescue Team": {"cap": 4, "cost": 310.0, "tags": ["Lake Drowning Rescue"]}
        }
    },
    {
        "id": "RC-KHILGAON-FS",
        "name": "Khilgaon & Goran Fire Station",
        "area": "Khilgaon",
        "lat": 23.7510,
        "lng": 90.4255,
        "operational": True,
        "base_inventory": {
            "Fire Brigade": {"cap": 7, "cost": 380.0, "tags": ["Dense Residential Water Tender"]},
            "Ambulance": {"cap": 4, "cost": 145.0, "tags": ["Burn Evacuation"]}
        }
    },
    {
        "id": "RC-AGARGAON-RELIEF",
        "name": "Agargaon Meteorological & Relief Depot",
        "area": "Agargaon",
        "lat": 23.7785,
        "lng": 90.3785,
        "operational": True,
        "base_inventory": {
            "Relief Team": {"cap": 14, "cost": 125.0, "tags": ["Disaster Warning Dispatch", "Emergency Tarpaulins"]},
            "Rescue Team": {"cap": 5, "cost": 295.0, "tags": ["Civil Protection"]}
        }
    },
    {
        "id": "RC-DEMRA-FLOOD",
        "name": "Demra & Shitalakkhya Relief Station",
        "area": "Demra",
        "lat": 23.7255,
        "lng": 90.4655,
        "operational": True,
        "base_inventory": {
            "Rescue Team": {"cap": 7, "cost": 270.0, "tags": ["River Surge Evac", "High-capacity Boat"]},
            "Relief Team": {"cap": 12, "cost": 115.0, "tags": ["Flood Sachet Packets", "Water Purification Kits"]}
        }
    },
    {
        "id": "RC-LALBAGH-HUB",
        "name": "Lalbagh & Hazaribagh Police-Civil Post",
        "area": "Lalbagh",
        "lat": 23.7185,
        "lng": 90.3885,
        "operational": True,
        "base_inventory": {
            "Police Personnel": {"cap": 12, "cost": 95.0, "tags": ["Narrow Street Patrol"]},
            "Ambulance": {"cap": 3, "cost": 140.0, "tags": ["Tannery Industrial Medic"]}
        }
    }
]
