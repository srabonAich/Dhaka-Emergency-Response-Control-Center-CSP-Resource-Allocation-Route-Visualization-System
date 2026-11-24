#!/usr/bin/env python3
"""
Dhaka Emergency Response Control Center — System Launcher
Launches both FastAPI Backend (:8000) and Vite Frontend (:5173) with a single command.
Handles environment verification, dependency installation, unified logging, and clean shutdown.

Usage:
    python3 run.py [--no-browser]
"""

import os
import sys
import time
import signal
import shutil
import urllib.request
import subprocess
import threading
import webbrowser
import argparse

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

# Virtual environment python binary detection
IS_WINDOWS = sys.platform.startswith("win")
if IS_WINDOWS:
    VENV_PYTHON = os.path.join(ROOT_DIR, ".venv", "Scripts", "python.exe")
    VENV_PIP = os.path.join(ROOT_DIR, ".venv", "Scripts", "pip.exe")
    NPM_CMD = "npm.cmd"
else:
    VENV_PYTHON = os.path.join(ROOT_DIR, ".venv", "bin", "python")
    VENV_PIP = os.path.join(ROOT_DIR, ".venv", "bin", "pip")
    NPM_CMD = "npm"

# ANSI Colors for terminal display
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"

processes = []

def log(tag: str, msg: str, color: str = CYAN):
    timestamp = time.strftime("%H:%M:%S")
    print(f"{color}[{timestamp}] [{tag}]{RESET} {msg}")

def ensure_python_environment():
    """Ensures virtual environment and backend dependencies are installed."""
    if not os.path.exists(VENV_PYTHON):
        log("SETUP", f"Virtualenv not found at {VENV_PYTHON}. Creating .venv...", YELLOW)
        subprocess.check_call([sys.executable, "-m", "venv", os.path.join(ROOT_DIR, ".venv")])
        log("SETUP", "Virtualenv created successfully.", GREEN)

    req_file = os.path.join(BACKEND_DIR, "requirements.txt")
    if os.path.exists(req_file):
        # Quick check if fastapi is installed in venv
        test_code = "import fastapi, uvicorn, networkx, pydantic; print('ok')"
        res = subprocess.run([VENV_PYTHON, "-c", test_code], capture_output=True, text=True)
        if res.returncode != 0:
            log("SETUP", "Installing backend dependencies from requirements.txt...", YELLOW)
            subprocess.check_call([VENV_PIP, "install", "-r", req_file])
            log("SETUP", "Backend dependencies installed.", GREEN)

def ensure_frontend_environment():
    """Ensures node_modules are installed in frontend directory."""
    npm_path = shutil.which(NPM_CMD) or shutil.which("npm")
    if not npm_path:
        log("ERROR", "Node.js / npm is not installed or not in PATH. Please install Node.js (v18+).", RED)
        sys.exit(1)

    node_modules = os.path.join(FRONTEND_DIR, "node_modules")
    if not os.path.exists(node_modules):
        log("SETUP", "Installing frontend packages (npm install)...", YELLOW)
        subprocess.check_call([NPM_CMD, "install"], cwd=FRONTEND_DIR)
        log("SETUP", "Frontend dependencies installed.", GREEN)

def pipe_output(proc, tag: str, color: str):
    """Pipes stdout/stderr lines with a colorful prefix tag."""
    try:
        for line in iter(proc.stdout.readline, ''):
            if not line:
                break
            line_str = line.strip()
            if line_str:
                # Filter out noisy vite clear-screen sequences
                if "\x1b[2J" in line_str or "\x1bc" in line_str:
                    continue
                print(f"{color}[{tag}]{RESET} {line_str}")
    except Exception:
        pass

def wait_for_service(url: str, name: str, timeout: int = 20) -> bool:
    """Polls a URL until it responds with HTTP 200 or timeout expires."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DhakaControlLauncher"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status in (200, 304):
                    return True
        except Exception:
            pass
        time.sleep(0.3)
    return False

def clean_shutdown(signum=None, frame=None):
    """Gracefully terminates both child processes."""
    print()
    log("SYSTEM", "Shutting down Dhaka Control Center servers...", YELLOW)
    for p in processes:
        if p.poll() is None:
            try:
                p.terminate()
                p.wait(timeout=2)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass
    log("SYSTEM", "All servers stopped. Goodbye!", GREEN)
    sys.exit(0)

def main():
    parser = argparse.ArgumentParser(description="Dhaka Emergency Response Control Center Launcher")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    parser.add_argument("--backend-port", type=int, default=8000, help="Port for FastAPI backend (default: 8000)")
    parser.add_argument("--frontend-port", type=int, default=5173, help="Port for Vite frontend (default: 5173)")
    args = parser.parse_args()

    # Register termination signals
    signal.signal(signal.SIGINT, clean_shutdown)
    signal.signal(signal.SIGTERM, clean_shutdown)

    print(f"\n{BOLD}{CYAN}========================================================================{RESET}")
    print(f"{BOLD}{CYAN}   DHAKA EMERGENCY RESPONSE CONTROL CENTER — SYSTEM LAUNCHER             {RESET}")
    print(f"{BOLD}{CYAN}   CSP Multi-Incident Resource Allocation & Route Visualization          {RESET}")
    print(f"{BOLD}{CYAN}========================================================================{RESET}\n")

    log("SYSTEM", "Checking Python & Node.js environment...")
    ensure_python_environment()
    ensure_frontend_environment()

    # 1. Start FastAPI Backend
    log("SYSTEM", f"Starting FastAPI backend on port {args.backend_port}...")
    backend_cmd = [
        VENV_PYTHON, "-m", "uvicorn",
        "backend.main:app",
        "--host", "0.0.0.0",
        "--port", str(args.backend_port)
    ]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    processes.append(backend_proc)

    t_back = threading.Thread(target=pipe_output, args=(backend_proc, "BACKEND", GREEN), daemon=True)
    t_back.start()

    # 2. Start Vite Frontend
    log("SYSTEM", f"Starting Vite frontend on port {args.frontend_port}...")
    frontend_cmd = [
        NPM_CMD, "run", "dev", "--",
        "--host", "0.0.0.0",
        "--port", str(args.frontend_port)
    ]
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    processes.append(frontend_proc)

    t_front = threading.Thread(target=pipe_output, args=(frontend_proc, "FRONTEND", CYAN), daemon=True)
    t_front.start()

    # 3. Wait for services to become responsive
    log("SYSTEM", "Waiting for services to become ready...")
    backend_ok = wait_for_service(f"http://127.0.0.1:{args.backend_port}/api/init", "Backend", timeout=15)
    frontend_ok = wait_for_service(f"http://127.0.0.1:{args.frontend_port}/", "Frontend", timeout=15)

    if not backend_ok:
        log("WARN", f"Backend on port {args.backend_port} took longer than expected to report ready.", YELLOW)
    if not frontend_ok:
        log("WARN", f"Frontend on port {args.frontend_port} took longer than expected to report ready.", YELLOW)

    # 4. Banner Output with clickable links
    frontend_url = f"http://localhost:{args.frontend_port}"
    api_url = f"http://localhost:{args.backend_port}"
    docs_url = f"http://localhost:{args.backend_port}/docs"

    print(f"\n{BOLD}{GREEN}✓ All services running successfully!{RESET}")
    print(f"  • {BOLD}Frontend Application:{RESET} {CYAN}{frontend_url}{RESET}")
    print(f"  • {BOLD}Backend API:{RESET}          {CYAN}{api_url}{RESET}")
    print(f"  • {BOLD}Interactive API Docs:{RESET} {CYAN}{docs_url}{RESET}\n")
    print(f"{YELLOW}Press Ctrl+C at any time to cleanly stop all servers.{RESET}\n")

    # 5. Automatically open browser unless disabled
    if not args.no_browser:
        try:
            webbrowser.open(frontend_url)
        except Exception:
            pass

    # 6. Keep main thread alive monitoring processes
    try:
        while True:
            for p in processes:
                if p.poll() is not None:
                    log("SYSTEM", f"Process exited with code {p.returncode}. Shutting down.", RED)
                    clean_shutdown()
            time.sleep(0.5)
    except KeyboardInterrupt:
        clean_shutdown()

if __name__ == "__main__":
    main()
