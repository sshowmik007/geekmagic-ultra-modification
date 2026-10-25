#!/usr/bin/env python3
"""
GeekMagic SmallTV-Ultra - Real-Time AI Agent Companion Sync
Directly extracts real-time telemetry from active AI agents (Gemini, Codex, Claude, OpenCode)
and streams live tokens, dynamic model context limits, and rate-limit countdowns to SmallTV.
"""

import os
import sys
import glob
import time
import json
import argparse
import urllib.request
import urllib.error
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from hmac import compare_digest

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

DEFAULT_CONFIG = {
    "smalltv_ip": "192.168.0.198",
    "provider_mode": "auto",  # "auto", "gemini", "codex", "opencode", "claude"
    "push_interval_sec": 10,
    "freshness_timeout_sec": 90,
    "bridge_port": 4310,
    "bridge_host": "127.0.0.1",
    "bridge_token": "",
    "gemini_brain_dir": os.path.expanduser(r"~/.gemini/antigravity/brain"),
    "codex_home_dir": os.path.expanduser(r"~/.codex"),
    "claude_home_dir": os.path.expanduser(r"~/.claude"),
}

_PLUGIN_EVENTS = {}
_PLUGIN_EVENTS_LOCK = threading.Lock()

def normalize_plugin_event(payload, bridge_token=""):
    """Validate a plugin event without inventing missing provider data."""
    if not isinstance(payload, dict) or not isinstance(payload.get("provider"), str) or not payload["provider"].strip():
        return None
    if bridge_token and not compare_digest(str(payload.get("token", "")), bridge_token):
        return None
    observed_at = payload.get("observedAt", time.time())
    try:
        observed_at = float(observed_at)
    except (TypeError, ValueError):
        return None
    event = {
        "provider": payload["provider"].strip(),
        "model": payload.get("model") if isinstance(payload.get("model"), str) else None,
        "agentState": payload.get("agentState", payload.get("state", "IDLE")),
        "mtime": observed_at,
        "observedAt": observed_at,
        "telemetryState": "live",
        "source": payload.get("source", "local plugin"),
        "sourceLabel": payload.get("sourceLabel", "Local plugin"),
        "sessionPct": payload.get("sessionPct"),
        "weeklyPct": payload.get("weeklyPct"),
        "sessionReset": payload.get("sessionReset"),
        "weeklyReset": payload.get("weeklyReset"),
        "sessionTokens": payload.get("sessionTokens"),
        "sessionLimit": payload.get("sessionLimit"),
        "weeklyTokens": payload.get("weeklyTokens"),
        "weeklyLimit": payload.get("weeklyLimit"),
        "sessionLabel": payload.get("sessionLabel", "RATE LIMIT"),
        "weeklyLabel": payload.get("weeklyLabel", "RATE LIMIT"),
        "sessionText": payload.get("sessionText", "Unavailable"),
        "weeklyText": payload.get("weeklyText", "Unavailable"),
        "sessionWindowMinutes": payload.get("sessionWindowMinutes"),
        "weeklyWindowMinutes": payload.get("weeklyWindowMinutes"),
    }
    for key in ("sessionPct", "weeklyPct"):
        if event[key] is not None:
            try:
                event[key] = max(0, min(100, int(event[key])))
            except (TypeError, ValueError):
                event[key] = None
    return event

def record_plugin_event(payload, bridge_token=""):
    event = normalize_plugin_event(payload, bridge_token)
    if event is None:
        return False
    with _PLUGIN_EVENTS_LOCK:
        _PLUGIN_EVENTS[event["provider"].lower()] = event
    return True

def get_plugin_telemetry():
    with _PLUGIN_EVENTS_LOCK:
        return list(_PLUGIN_EVENTS.values())

class _BridgeHandler(BaseHTTPRequestHandler):
    bridge_token = ""
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-SmallTV-Bridge-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()
    def do_GET(self):
        if self.path != "/provider-event":
            self.send_error(404)
            return
        with _PLUGIN_EVENTS_LOCK:
            providers = [{"provider": item.get("provider"), "model": item.get("model"), "observedAt": item.get("observedAt"), "source": item.get("source")} for item in _PLUGIN_EVENTS.values()]
        body = json.dumps({"bridge": "ready", "endpoint": "POST /provider-event", "providers": providers}).encode()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)
    def do_POST(self):
        if self.path != "/provider-event":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError):
            self.send_error(400, "Invalid JSON")
            return
        header_token = self.headers.get("X-SmallTV-Bridge-Token")
        # Accept the secret in a header so plugins do not place it in telemetry JSON/logs.
        if self.bridge_token and payload.get("token", header_token) != self.bridge_token:
            self.send_error(401, "Invalid bridge token")
            return
        if header_token and "token" not in payload:
            payload["token"] = header_token
        if not record_plugin_event(payload, self.bridge_token):
            self.send_error(422, "provider and observedAt are required")
            return
        self.send_response(202)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"accepted":true}')
    def log_message(self, *_args):
        return

def start_bridge(port, bridge_token="", host="127.0.0.1"):
    _BridgeHandler.bridge_token = bridge_token
    server = ThreadingHTTPServer((host, port), _BridgeHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server

def load_config():
    cfg = DEFAULT_CONFIG.copy()
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg.update(json.load(f))
        except Exception as e:
            print(f"[Warning] Error reading config.json: {e}", flush=True)
    env_values = {
        "smalltv_ip": os.getenv("SMALLTV_IP"),
        "provider_mode": os.getenv("SMALLTV_PROVIDER_MODE"),
        "push_interval_sec": os.getenv("SMALLTV_PUSH_INTERVAL_SEC"),
        "freshness_timeout_sec": os.getenv("SMALLTV_FRESHNESS_TIMEOUT_SEC"),
        "bridge_host": os.getenv("SMALLTV_BRIDGE_HOST"),
        "bridge_port": os.getenv("SMALLTV_BRIDGE_PORT"),
        "bridge_token": os.getenv("SMALLTV_BRIDGE_TOKEN"),
        "gemini_brain_dir": os.getenv("SMALLTV_GEMINI_BRAIN_DIR"),
        "codex_home_dir": os.getenv("SMALLTV_CODEX_HOME_DIR"),
        "claude_home_dir": os.getenv("SMALLTV_CLAUDE_HOME_DIR"),
    }
    for key, value in env_values.items():
        if value in (None, ""):
            continue
        if key in {"push_interval_sec", "freshness_timeout_sec", "bridge_port"}:
            try:
                value = int(value)
            except ValueError:
                print(f"[Warning] Ignoring invalid integer environment value for {key}", flush=True)
                continue
        cfg[key] = value
    return cfg

def format_countdown(epoch_sec):
    if not epoch_sec:
        return "24h"
    diff = int(epoch_sec - time.time())
    if diff <= 0:
        return "Reset now"
    days = diff // 86400
    hours = (diff % 86400) // 3600
    mins = (diff % 3600) // 60
    if days > 0:
        return f"{days}d {hours}h"
    if hours > 0:
        return f"{hours}h {mins}m"
    return f"{mins}m"

def daily_utc_countdown():
    now = time.time()
    diff = 86400 - int(now % 86400)
    h = diff // 3600
    m = (diff % 3600) // 60
    return f"{h}h {m:02d}m"

def window_label(window_minutes, fallback="RATE LIMIT"):
    if not window_minutes:
        return fallback
    if window_minutes == 10080 or window_minutes % 10080 == 0:
        return "WEEKLY LIMIT" if window_minutes == 10080 else f"{window_minutes // 1440}-DAY LIMIT"
    if window_minutes % 1440 == 0:
        return f"{window_minutes // 1440}-DAY LIMIT"
    if window_minutes % 60 == 0:
        hours = window_minutes // 60
        return f"{hours}-HOUR LIMIT"
    return f"{window_minutes}-MIN LIMIT"

def get_gemini_telemetry(cfg):
    """Extract real-time live token telemetry from Antigravity/Gemini session logs."""
    brain_dir = cfg.get("gemini_brain_dir")
    if not brain_dir or not os.path.exists(brain_dir):
        return None
    try:
        pattern = os.path.join(brain_dir, "*", ".system_generated", "logs", "transcript.jsonl")
        files = glob.glob(pattern)
        if not files:
            return None
        files.sort(key=os.path.getmtime, reverse=True)
        transcript_path = files[0]
        conv_dir = os.path.dirname(os.path.dirname(os.path.dirname(transcript_path)))

        mtime = os.path.getmtime(transcript_path)
        is_working = (time.time() - mtime) < 90

        with open(transcript_path, encoding="utf-8", errors="ignore") as stream:
            lines = stream.readlines()
        if not lines:
            return None

        turn_tokens = 0
        total_session_tokens = 0

        for l in lines:
            try:
                rec = json.loads(l)
                if rec.get("source") == "MODEL":
                    inp = rec.get("input_tokens", 0)
                    cache = rec.get("cache_read_tokens", 0)
                    out = rec.get("output_tokens", 0)
                    turn_tokens = inp + cache + out
                    total_session_tokens += out
            except Exception:
                pass

        model_name = cfg.get("gemini_model") or "Gemini"

        # Format compact human-readable token text
        def format_compact(val):
            c = float(val or 0)
            if c >= 1000000:
                return f"{c / 1000000.0:.1f}M"
            if c >= 1000:
                return f"{c / 1000.0:.1f}k"
            return f"{int(c)}"

        session_text = f"{format_compact(turn_tokens)} used" if turn_tokens > 0 else "0 tok"
        weekly_text = f"{format_compact(total_session_tokens)} total" if total_session_tokens > 0 else "0 tok"

        return {
            "provider": "Gemini",
            "model": model_name,
            "mtime": mtime,
            "agentState": "WORKING" if is_working else "IDLE",
            "sessionLabel": "TOKENS USED",
            "sessionPct": None,
            "sessionText": session_text,
            "sessionReset": "--",
            "weeklyLabel": "SESSION TOTAL",
            "weeklyPct": None,
            "weeklyText": weekly_text,
            "weeklyReset": "--",
            "sessionTokens": turn_tokens,
            "sessionLimit": None,
            "weeklyTokens": total_session_tokens,
            "weeklyLimit": None,
            "source": f"Antigravity transcript ({os.path.basename(conv_dir)[:8]}...)",
            "sourceLabel": "Antigravity live transcript",
            "sessionWindowMinutes": None,
            "weeklyWindowMinutes": None,
            "isLaptopOnline": True,
            "telemetryState": "live",
        }
    except Exception as e:
        return None

def get_codex_telemetry(cfg):
    """Extract live token telemetry from OpenAI Codex rollout session files."""
    codex_dir = cfg.get("codex_home_dir")
    if not codex_dir or not os.path.exists(codex_dir):
        return None
    try:
        session_pattern = os.path.join(codex_dir, "sessions", "**", "*.jsonl")
        files = glob.glob(session_pattern, recursive=True)
        if not files:
            return None
        files.sort(key=os.path.getmtime, reverse=True)
        newest_file = files[0]
        mtime = os.path.getmtime(newest_file)
        is_working = (time.time() - mtime) < 90

        with open(newest_file, encoding="utf-8", errors="ignore") as stream:
            lines = stream.readlines()
        if not lines:
            return None

        model_name = "CODEX"
        context_window = 258400
        last_turn_tokens = 0
        total_tokens = 0
        used_session_pct = None
        used_weekly_pct = None
        session_reset = None
        weekly_reset = None
        found_model = False
        found_usage = False

        for l in reversed(lines):
            try:
                rec = json.loads(l)
                if not found_model and rec.get("type") == "turn_context" and "model" in rec.get("payload", {}):
                    raw_model = rec["payload"]["model"]
                    model_name = raw_model.strip()
                    found_model = True

                if not found_usage and rec.get("type") == "event_msg" and rec.get("payload", {}).get("type") == "token_count":
                    payload = rec["payload"]
                    info = payload.get("info", {})
                    limits = payload.get("rate_limits", {})

                    context_window = info.get("model_context_window") or context_window
                    last_turn_tokens = info.get("last_token_usage", {}).get("total_tokens", 0)
                    total_tokens = info.get("total_token_usage", {}).get("total_tokens", 0)

                    primary = limits.get("primary", {})
                    secondary = limits.get("secondary", {})

                    if primary.get("used_percent") is not None:
                        used_session_pct = int(primary["used_percent"])
                    if secondary.get("used_percent") is not None:
                        used_weekly_pct = int(secondary["used_percent"])

                    if primary.get("resets_at"):
                        session_reset = format_countdown(primary["resets_at"])
                    if secondary.get("resets_at"):
                        weekly_reset = format_countdown(secondary["resets_at"])
                    found_usage = True

                if found_model and found_usage:
                    break
            except Exception:
                pass

        codex_5h_pct = max(0, 100 - used_session_pct) if used_session_pct is not None else None
        codex_7d_pct = max(0, 100 - used_weekly_pct) if used_weekly_pct is not None else None
        codex_5h_reset = session_reset
        codex_7d_reset = weekly_reset
        session_minutes = 300 if used_session_pct is not None else None
        weekly_minutes = 10080 if used_weekly_pct is not None else None
        codex_5h_text = f"{codex_5h_pct}% Left" if used_session_pct is not None else "Unavailable"
        codex_7d_text = f"{codex_7d_pct}% Left" if used_weekly_pct is not None else "Unavailable"

        return {
            "provider": "Codex",
            "model": model_name,
            "mtime": mtime,
            "agentState": "WORKING" if is_working else "IDLE",
            "sessionLabel": window_label(session_minutes),
            "sessionPct": codex_5h_pct,
            "sessionText": codex_5h_text,
            "sessionReset": codex_5h_reset,
            "weeklyLabel": window_label(weekly_minutes),
            "weeklyPct": codex_7d_pct,
            "weeklyText": codex_7d_text,
            "weeklyReset": codex_7d_reset,
            "sessionTokens": last_turn_tokens,
            "sessionLimit": context_window,
            "weeklyTokens": total_tokens,
            "weeklyLimit": None,
            "source": f"Codex rollout ({os.path.basename(newest_file)[:22]}...)",
            "sourceLabel": "Codex rollout",
            "sessionWindowMinutes": session_minutes,
            "weeklyWindowMinutes": weekly_minutes,
        }
    except Exception as e:
        return None

def get_opencode_telemetry(cfg):
    """OpenCode has no verified local usage source on this machine."""
    return None

_ROTATION_INDEX = 0

def detect_live_telemetry(cfg):
    """Select the active provider, or smoothly rotate among active session providers in auto mode."""
    global _ROTATION_INDEX
    mode = cfg.get("provider_mode", "auto").lower()

    gemini_data = get_gemini_telemetry(cfg)
    codex_data = get_codex_telemetry(cfg)
    opencode_data = get_opencode_telemetry(cfg)
    plugin_data = get_plugin_telemetry()

    if mode == "gemini":
        selected = gemini_data
    elif mode == "codex":
        selected = codex_data
    elif mode == "opencode":
        selected = opencode_data
    elif mode == "plugin":
        selected = max(plugin_data, key=lambda item: item.get("mtime", 0), default=None)
    else:
        selected = None

    freshness = max(1, int(cfg.get("freshness_timeout_sec", 90)))
    session_retention_sec = max(freshness, int(cfg.get("session_retention_sec", 43200)))

    if selected is not None:
        age = time.time() - selected.get("mtime", 0)
        if age <= session_retention_sec:
            selected["telemetryState"] = "live" if age <= freshness else "stale"
            selected["observedAt"] = selected.get("mtime")
            return selected
        if mode != "auto":
            return {"provider": None, "model": None, "agentState": "UNAVAILABLE", "telemetryState": "unavailable", "mtime": None, "sessionPct": None, "weeklyPct": None, "sessionReset": None, "weeklyReset": None, "sourceLabel": f"No fresh {mode} source"}
        selected = None

    # In auto mode, collect all providers with active session activity
    all_sources = [item for item in (gemini_data, codex_data, opencode_data, *plugin_data) if item]
    active_candidates = [item for item in all_sources if (time.time() - item.get("mtime", 0)) <= session_retention_sec]

    if not active_candidates:
        return {"provider": None, "model": None, "agentState": "UNAVAILABLE", "telemetryState": "unavailable", "mtime": None, "sessionPct": None, "weeklyPct": None, "sessionReset": None, "weeklyReset": None, "sourceLabel": "No verified provider source"}

    # Rotate across active session providers so multi-agent workflows display each agent
    if len(active_candidates) > 1:
        selected = active_candidates[_ROTATION_INDEX % len(active_candidates)]
        _ROTATION_INDEX += 1
    else:
        selected = active_candidates[0]

    age = time.time() - selected.get("mtime", 0)
    selected["telemetryState"] = "live" if age <= freshness else "stale"
    selected["observedAt"] = selected.get("mtime")
    return selected

def push_telemetry(ip, payload):
    url = f"http://{ip}/api/tokens"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "SmallTV-Companion/2.0"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False

def main():
    parser = argparse.ArgumentParser(description="SmallTV-Ultra Dynamic AI Telemetry Companion")
    parser.add_argument("--ip", help="SmallTV device IP address (e.g. 192.168.0.198)")
    parser.add_argument("--mode", choices=["auto", "gemini", "codex", "claude", "opencode", "plugin"],
                        help="Provider mode (default: auto)")
    parser.add_argument("--interval", type=int, help="Push interval in seconds (default: 10)")
    parser.add_argument("--bridge-port", type=int, help="Local plugin event port (default: 4310)")
    parser.add_argument("--no-bridge", action="store_true", help="Disable the local plugin event endpoint")
    parser.add_argument("--test", "--dry-run", action="store_true",
                        help="Perform a single live telemetry scan and print output without looping")
    args = parser.parse_args()

    cfg = load_config()
    if args.ip:
        cfg["smalltv_ip"] = args.ip
    if args.mode:
        cfg["provider_mode"] = args.mode
    if args.interval:
        cfg["push_interval_sec"] = max(3, args.interval)
    if args.bridge_port:
        cfg["bridge_port"] = max(1024, args.bridge_port)

    ip = cfg["smalltv_ip"]
    interval = cfg["push_interval_sec"]
    mode = cfg["provider_mode"]

    if args.test:
        print("[Live Scan] Reading dynamic agent telemetry...", flush=True)
        live = detect_live_telemetry(cfg)
        print(json.dumps(live, indent=2, default=str), flush=True)
        return

    bridge = None
    if not args.no_bridge:
        try:
            bridge_host = cfg.get("bridge_host", "127.0.0.1")
            bridge = start_bridge(int(cfg.get("bridge_port", 4310)), cfg.get("bridge_token", ""), bridge_host)
            display_host = "127.0.0.1" if bridge_host in ("0.0.0.0", "::") else bridge_host
            print(f"Plugin bridge      : http://{display_host}:{cfg.get('bridge_port', 4310)}/provider-event", flush=True)
        except OSError as exc:
            print(f"[Warning] Plugin bridge unavailable: {exc}", flush=True)

    print("=" * 70, flush=True)
    print("  GeekMagic SmallTV-Ultra - Dynamic Real-Time AI Telemetry Companion", flush=True)
    print("=" * 70, flush=True)
    print(f"Target SmallTV IP : {ip}", flush=True)
    print(f"Detection Mode    : {mode.upper()} (Auto-detects active agent dynamically)", flush=True)
    print(f"Sync Interval     : Every {interval}s", flush=True)
    print("=" * 70, flush=True)
    print("Streaming live agent telemetry... Press Ctrl+C to stop.\n", flush=True)

    while True:
        try:
            live = detect_live_telemetry(cfg)
            provider = live.get("provider")
            model = live.get("model")
            session_tok = live.get("sessionTokens")
            session_lim = live.get("sessionLimit")
            session_pct = live.get("sessionPct")
            weekly_tok = live.get("weeklyTokens")
            weekly_lim = live.get("weeklyLimit")
            weekly_pct = live.get("weeklyPct")
            agent_state = live.get("agentState", "UNAVAILABLE")

            payload = {
                "provider": provider,
                "model": model,
                "sessionLabel": live.get("sessionLabel", "5-HOUR LIMIT"),
                "sessionTokens": session_tok,
                "sessionLimit": session_lim,
                "sessionPct": session_pct,
                "sessionText": live.get("sessionText", "Unavailable"),
                "sessionReset": live.get("sessionReset"),
                "weeklyLabel": live.get("weeklyLabel", "WEEKLY LIMIT"),
                "weeklyTokens": weekly_tok,
                "weeklyLimit": weekly_lim,
                "weeklyPct": weekly_pct,
                "weeklyText": live.get("weeklyText", "Unavailable"),
                "weeklyReset": live.get("weeklyReset"),
                "agentState": agent_state,
                "isLaptopOnline": bool(provider),
                "telemetryState": live.get("telemetryState", "unavailable"),
                "sourceLabel": live.get("sourceLabel", live.get("source")),
                "observedAt": live.get("observedAt"),
                "sessionWindowMinutes": live.get("sessionWindowMinutes"),
                "weeklyWindowMinutes": live.get("weeklyWindowMinutes"),
            }

            ok = push_telemetry(ip, payload)
            t_str = time.strftime("%H:%M:%S")
            state_tag = f"[{agent_state}]"
            prov_model = f"{provider or 'No provider'} ({model or 'model unavailable'})"

            if ok:
                print(f"[{t_str}] -> SmallTV ({ip}) | {prov_model:28s} {state_tag:9s} | Turn: {session_tok or 0:8,} / {session_lim or 0:8,} tok | left: {session_pct if session_pct is not None else '--'}% | Session total: {weekly_tok or 0:10,} tok | Source: {live.get('source')}", flush=True)
            else:
                print(f"[{t_str}] [!] SmallTV at {ip} offline | Active: {prov_model} {state_tag} ({session_tok or 0:,} / {session_lim or 0:,} tok, {session_pct if session_pct is not None else '--'}%)", flush=True)

            time.sleep(interval)
        except KeyboardInterrupt:
            print("\nCompanion stopped.", flush=True)
            if bridge:
                bridge.shutdown()
            break
        except Exception as e:
            print(f"[Error] {e}", flush=True)
            time.sleep(interval)

if __name__ == "__main__":
    main()
