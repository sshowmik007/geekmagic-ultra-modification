import time
import json
import os
import tempfile
import unittest
from unittest import mock

import companion


class CodexTelemetryTests(unittest.TestCase):
    def test_gemini_aggregates_all_observed_tokens_without_fake_limit(self):
        with tempfile.TemporaryDirectory() as root:
            log_dir = os.path.join(root, "session", ".system_generated", "logs")
            os.makedirs(log_dir)
            path = os.path.join(log_dir, "transcript.jsonl")
            records = [
                {"source": "USER_EXPLICIT", "content": "Model Selection: Gemini 3.8 Flash"},
                {"source": "MODEL", "input_tokens": 10, "cache_read_tokens": 20, "output_tokens": 30},
                {"source": "MODEL", "input_tokens": 40, "cache_read_tokens": 50, "output_tokens": 60},
            ]
            with open(path, "w", encoding="utf-8") as stream:
                for record in records:
                    stream.write(json.dumps(record) + "\n")

            result = companion.get_gemini_telemetry({"gemini_brain_dir": root})

            self.assertEqual(result["model"], "Gemini 3.8 Flash")
            self.assertEqual(result["sessionTokens"], 150)
            self.assertEqual(result["weeklyTokens"], 210)
            self.assertIsNone(result["sessionLimit"])
            self.assertIsNone(result["sessionPct"])

    def test_uses_latest_model_and_real_zero_percent_limit(self):
        with tempfile.TemporaryDirectory() as root:
            session_dir = os.path.join(root, "sessions", "2026", "10", "25")
            os.makedirs(session_dir)
            path = os.path.join(session_dir, "rollout.jsonl")
            records = [
                {"type": "turn_context", "payload": {"model": "gpt-6.1-sol"}},
                {
                    "type": "event_msg",
                    "payload": {
                        "type": "token_count",
                        "info": {
                            "model_context_window": 300000,
                            "last_token_usage": {"total_tokens": 1200},
                            "total_token_usage": {"total_tokens": 3400},
                        },
                        "rate_limits": {
                            "primary": {"used_percent": 0},
                            "secondary": {"used_percent": 25},
                        },
                    },
                },
            ]
            with open(path, "w", encoding="utf-8") as stream:
                for record in records:
                    stream.write(json.dumps(record) + "\n")

            result = companion.get_codex_telemetry({"codex_home_dir": root})

            self.assertEqual(result["model"], "GPT-6.1-SOL")
            self.assertEqual(result["sessionPct"], 100)
            self.assertEqual(result["weeklyPct"], 75)
            self.assertEqual(result["sessionTokens"], 1200)

    def test_plugin_event_is_normalized_and_selected_when_fresh(self):
        companion._PLUGIN_EVENTS.clear()
        now = __import__("time").time()
        self.assertTrue(companion.record_plugin_event({
            "provider": "Claude",
            "model": "Claude Code",
            "state": "WORKING",
            "sessionPct": 72,
            "observedAt": now,
            "source": "claude-hook",
        }))
        result = companion.detect_live_telemetry({
            "provider_mode": "auto",
            "freshness_timeout_sec": 90,
            "gemini_brain_dir": "",
            "codex_home_dir": "",
            "opencode_home_dir": "",
        })
        self.assertEqual(result["provider"], "Claude")
        self.assertEqual(result["model"], "Claude Code")
        self.assertEqual(result["sessionPct"], 72)
        companion._PLUGIN_EVENTS.clear()

    def test_plugin_event_rejects_missing_provider(self):
        self.assertFalse(companion.record_plugin_event({"model": "unknown"}))

    def test_header_bridge_token_is_accepted(self):
        self.assertTrue(companion.record_plugin_event({
            "provider": "Codex",
            "observedAt": __import__("time").time(),
            "token": "secret",
        }, "secret"))

    def test_codex_skips_internal_auto_review_files(self):
        with tempfile.TemporaryDirectory() as root:
            sessions_dir = os.path.join(root, "sessions", "2026", "10", "26")
            os.makedirs(sessions_dir)

            # Earlier file: interactive user session with gpt-5.6-luna
            interactive_file = os.path.join(sessions_dir, "rollout-interactive.jsonl")
            with open(interactive_file, "w", encoding="utf-8") as s:
                s.write(json.dumps({"type": "turn_context", "payload": {"model": "gpt-5.6-luna"}}) + "\n")
                s.write(json.dumps({"type": "event_msg", "payload": {"type": "token_count", "info": {"last_token_usage": {"total_tokens": 500}, "total_token_usage": {"total_tokens": 1200}}, "rate_limits": {"primary": {"used_percent": 5, "resets_at": 1793030000}, "secondary": {"used_percent": 2, "resets_at": 1793600000}}}}) + "\n")

            # Slightly newer file: internal auto-review background task
            time.sleep(0.01)
            review_file = os.path.join(sessions_dir, "rollout-review.jsonl")
            with open(review_file, "w", encoding="utf-8") as s:
                s.write(json.dumps({"type": "turn_context", "payload": {"model": "codex-auto-review"}}) + "\n")
                s.write(json.dumps({"type": "event_msg", "payload": {"type": "token_count", "info": {"last_token_usage": {"total_tokens": 100}, "total_token_usage": {"total_tokens": 100}}, "rate_limits": {}}}) + "\n")

            result = companion.get_codex_telemetry({"codex_home_dir": root})
            self.assertIsNotNone(result)
            self.assertEqual(result["provider"], "Codex")
            self.assertEqual(result["model"], "GPT-5.6-LUNA")
            self.assertEqual(result["sessionPct"], 95)

    def test_opencode_telemetry_from_sqlite(self):
        import sqlite3
        with tempfile.TemporaryDirectory() as root:
            db_path = os.path.join(root, "opencode.db")
            con = sqlite3.connect(db_path)
            con.execute("""
                CREATE TABLE session_v2 (
                    id TEXT PRIMARY KEY,
                    slug TEXT,
                    directory TEXT,
                    model TEXT,
                    tokens_input INTEGER,
                    tokens_output INTEGER,
                    tokens_reasoning INTEGER,
                    tokens_cache_read INTEGER,
                    tokens_cache_write INTEGER,
                    time_updated INTEGER,
                    time_idle INTEGER,
                    idle_outcome TEXT
                )
            """)
            con.execute("""
                INSERT INTO session_v2 (
                    id, slug, directory, model, tokens_input, tokens_output,
                    tokens_reasoning, tokens_cache_read, tokens_cache_write,
                    time_updated, time_idle, idle_outcome
                ) VALUES (
                    'ses_123456789', 'test-slug', '/workspace',
                    '{"id":"deepseek-v4.1-flash-free"}',
                    1000, 200, 50, 500, 0, 1793020000000, 1793020000000, 'succeeded'
                )
            """)
            con.commit()
            con.close()

            result = companion.get_opencode_telemetry({"opencode_home_dir": root})
            self.assertIsNotNone(result)
            self.assertEqual(result["provider"], "OpenCode")
            self.assertEqual(result["model"], "DeepSeek-V4.1")
            self.assertEqual(result["sessionTokens"], 1250)
            self.assertEqual(result["weeklyTokens"], 1750)
            self.assertEqual(result["sessionLimit"], 1000000)
            self.assertEqual(result["sessionPct"], 100)

    def test_gemini_quota_telemetry_overlays_live_limits(self):
        with tempfile.TemporaryDirectory() as root:
            conv = os.path.join(root, "convo-1", ".system_generated", "logs")
            os.makedirs(conv)
            transcript = os.path.join(conv, "transcript.jsonl")
            with open(transcript, "w", encoding="utf-8") as stream:
                stream.write(json.dumps({"source": "USER_EXPLICIT", "content": "Model Selection: Gemini 3.8 Flash"}) + "\n")
                stream.write(json.dumps({"source": "MODEL", "input_tokens": 100, "output_tokens": 50}) + "\n")

            mock_response_body = json.dumps({
                "response": {
                    "groups": [
                        {
                            "displayName": "Gemini Models",
                            "buckets": [
                                {
                                    "bucketId": "gemini-weekly",
                                    "window": "weekly",
                                    "remainingFraction": 0.49,
                                    "resetTime": "2026-10-29T05:56:26Z"
                                },
                                {
                                    "bucketId": "gemini-5h",
                                    "window": "5h",
                                    "remainingFraction": 0.87,
                                    "resetTime": "2026-10-26T16:46:45Z"
                                }
                            ]
                        }
                    ]
                }
            }).encode("utf-8")

            mock_resp = mock.MagicMock()
            mock_resp.status = 200
            mock_resp.read.return_value = mock_response_body
            mock_resp.__enter__.return_value = mock_resp

            with mock.patch("urllib.request.urlopen", return_value=mock_resp):
                cfg = {
                    "gemini_brain_dir": root,
                    "antigravity_hub_port": 62109,
                    "antigravity_csrf_token": "test-token"
                }
                result = companion.get_gemini_telemetry(cfg)
                self.assertIsNotNone(result)
                self.assertEqual(result["provider"], "Gemini")
                self.assertEqual(result["model"], "Gemini 3.8 Flash")
                self.assertEqual(result["sessionLabel"], "5-HOUR LIMIT")
                self.assertEqual(result["sessionPct"], 87)
                self.assertEqual(result["sessionText"], "87% Left")
                self.assertEqual(result["weeklyLabel"], "WEEKLY LIMIT")
                self.assertEqual(result["weeklyPct"], 49)
                self.assertEqual(result["weeklyText"], "49% Left")
                self.assertEqual(result["sourceLabel"], "Antigravity quota API")

    def test_environment_overrides_are_available_for_container_runtime(self):
        with mock.patch.dict(os.environ, {
            "SMALLTV_IP": "192.168.1.50",
            "SMALLTV_BRIDGE_HOST": "0.0.0.0",
            "SMALLTV_BRIDGE_PORT": "4431",
            "SMALLTV_CODEX_HOME_DIR": "/data/codex",
        }, clear=False):
            cfg = companion.load_config()
        self.assertEqual(cfg["smalltv_ip"], "192.168.1.50")
        self.assertEqual(cfg["bridge_host"], "0.0.0.0")
        self.assertEqual(cfg["bridge_port"], 4431)
        self.assertEqual(cfg["codex_home_dir"], "/data/codex")


if __name__ == "__main__":
    unittest.main()
