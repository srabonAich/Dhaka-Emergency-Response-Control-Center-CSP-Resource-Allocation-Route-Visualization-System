# Dhaka Emergency Response Control Center — CSP Resource Allocation & Route Visualization System

A high-performance Emergency Response Control Center for Dhaka City that formulates multi-incident emergency resource allocation as a **Constraint Satisfaction Problem (CSP)** integrated with road-network accessibility and shortest-path routing.

Built with **FastAPI (Python 3.12)** backend and **React + Vite + TypeScript + Tailwind CSS + React-Leaflet** dark-mode frontend.

---

## 1. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│               Frontend: React + Vite + Tailwind + Leaflet              │
│  - MapViewer: Canvas-backed OpenStreetMap (Dhaka City)                 │
│  - Live CSP State Inspector (X variables, D domains, C constraints)    │
│  - Step-by-Step Playback Toolbar (Play/Pause/Step/Skip, 1x-100x Speed) │
│  - Interactive Tools: Add Incident, Escalate Situation, Block Roads    │
│  - Comparative Algorithm Benchmark Table (BT vs CBJ vs AC3 vs Full)   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ JSON API (Proxy :5173/api -> :8000)
┌────────────────────────────────────▼───────────────────────────────────┐
│                     Backend: FastAPI + NetworkX                        │
│  - graph_loader.py: Strongly-connected Dhaka road network + KDTree     │
│  - models.py: Pydantic schemas (Incidents, Centers, Traces, Solutions) │
│  - csp_solver.py: BT, CBJ, AC-3, PC-2, MRV, Degree, LCV from scratch   │
│  - scale_generator.py: Small (25), Medium (120), Large (220) presets    │
│  - main.py: High-speed async REST endpoints with precomputed routes    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mathematical CSP Formulation

1. **Variables ($X$):**
   - Each emergency incident $I_k$ requiring resources spawns variables $X_{k, r, m}$ (Incident $k$, Resource Type $r$, Unit index $m$).
   - Dynamically ordered by Emergency Priority ($5=\text{Critical} \to 1=\text{Low}$).
2. **Domains ($D$):**
   - Domain $D(X_{k, r, m})$ is the set of operational Resource Centers $C_j$ possessing resource type $r$ that satisfy distance, budget, and accessibility limits.
3. **Constraints ($C$):**
   - **C1 (Response Time):** $T(C_j \to I_k) \le T_{\max}(\text{Priority})$
   - **C2 (Budget):** $\text{Dispatch Cost} + \text{Distance Surcharge} \le \text{Budget}_{\max}$
   - **C3 (Resource Availability):** $C_j.\text{inventory}[r].\text{available\_units} > 0$
   - **C4 (Road Accessibility):** Valid unblocked path $P(C_j \to I_k)$ exists on Dhaka graph
   - **C5 (Resource Capacity - Global N-ary):** $\sum_{k} \text{Assigned}(X_{k, r} = C_j) \le \text{Capacity}(C_j, r)$
   - **C6 (Resource Capability - Unary):** Resource assigned matches incident requirements
   - **C7 (Center Availability - Unary):** $C_j.\text{operational} == \text{True}$
4. **Nearest Center Cascade Rule:**
   - Values are probed in order of travel time (1st nearest, 2nd nearest, etc.).
   - If all centers in domain are exhausted, variable cascades to `UNASSIGNED (Resource Exhausted)`.

---

## 3. Implemented CSP Algorithms & Techniques

1. **Standard Backtracking Search (BT):** Depth-first assignment with chronological backtracking.
2. **Conflict-Directed Backjumping (CBJ):** Tracks conflict sets $conf(X_i)$. Upon domain wipeout, jumps directly back to the most recent conflicting variable, skipping unconflicted intermediate levels and recording `BACKJUMP` trace events.
3. **Arc Consistency (AC-3):** Enforces binary consistency and priority reservations across variables competing for finite center capacities.
4. **Path Consistency (PC-2 / 3-Consistency):** Verifies triples of variables $(X_i, X_j, X_k)$ to eliminate unsupported resource allocations before search.
5. **Heuristics:**
   - *Variable Ordering:* Priority-First + **MRV (Minimum Remaining Values)** + **Degree Heuristic**
   - *Value Ordering:* **Nearest-Center-First** + **LCV (Least Constraining Value)**

---

## 4. Problem Scales

- **Small Scale:** 25 Incidents | 6 Resource Centers | ~58 Variables
- **Medium Scale:** 120 Incidents | 14 Resource Centers | ~264 Variables
- **Large Scale:** 220 Incidents | 28 Resource Centers | ~490 Variables

---

## 5. Quickstart & Running

### One-Command Launcher (Recommended)
Run the entire project (backend + frontend) with the bundled Python runner:
```bash
python3 run.py
```
This script automatically:
1. Verifies/creates the Python virtual environment and installs dependencies.
2. Checks Node.js and installs frontend `npm` dependencies if missing.
3. Launches the FastAPI backend (`:8000`) and Vite frontend (`:5173`).
4. Performs health-check readiness polling.
5. Automatically opens your browser at `http://localhost:5173`.
6. Handles graceful shutdown on `Ctrl+C`.

Optional flags:
```bash
python3 run.py --no-browser                # Do not open browser automatically
python3 run.py --backend-port 8000 --frontend-port 5173
```

### Manual Individual Commands
If you prefer running services separately in separate terminals:

**Terminal 1 (Backend):**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```
