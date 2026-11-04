import os
import sys
import time
import subprocess
import webbrowser
import socket

PORT = 4321
URL = f"http://127.0.0.1:{PORT}"

if sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def is_port_open(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(('127.0.0.1', port)) == 0
    except Exception:
        return False

def find_browser_app_executable():
    """Find Brave, Edge, or Chrome to launch in clean frameless --app mode"""
    candidates = [
        r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"),
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)

    print("======================================================")
    print("   [+] SONGLESS (SPOTIFY EDITION) DESKTOP LAUNCHER     ")
    print("======================================================")
    print(f"Starting local server at {URL}...")

    # Start Flask server if not already running
    if not is_port_open(PORT):
        from backend.app import app
        import threading

        server_thread = threading.Thread(
            target=lambda: app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False),
            daemon=True
        )
        server_thread.start()

        # Wait for server to come online
        retries = 30
        while retries > 0 and not is_port_open(PORT):
            time.sleep(0.3)
            retries -= 1

    print("Server online! Opening standalone desktop window...")
    browser_exe = find_browser_app_executable()

    if browser_exe:
        print(f"Launching via {os.path.basename(browser_exe)} in app mode...")
        profile_dir = os.path.join(base_dir, ".profile")
        cmd = [
            browser_exe,
            f"--app={URL}",
            f"--user-data-dir={profile_dir}",
            "--window-size=740,940",
            "--window-position=300,100"
        ]
        try:
            subprocess.Popen(cmd)
        except Exception as e:
            print(f"Could not open browser in app mode ({e}), opening default browser...")
            webbrowser.open(URL)
    else:
        print("Opening default browser...")
        webbrowser.open(URL)

    print("\n[!] Songless Desktop is running! Press Ctrl+C in this terminal to quit.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("Stopping server. Goodbye!")

if __name__ == "__main__":
    main()
