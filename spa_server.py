#!/usr/bin/env python3
"""
Static file server with SPA fallback for deep links.

If a request path does not map to a real file and looks like an app route
(no file extension in the last segment), the server returns index.html.
"""

from __future__ import annotations

import argparse
import http.server
import os
import socketserver
from urllib.parse import urlsplit


class SPARequestHandler(http.server.SimpleHTTPRequestHandler):
    def _apply_spa_fallback_if_needed(self) -> None:
        parsed = urlsplit(self.path)
        request_path = parsed.path or "/"
        fs_path = self.translate_path(request_path)

        if os.path.exists(fs_path):
            return

        last_segment = request_path.rstrip("/").rsplit("/", 1)[-1]
        if "." in last_segment:
            return

        query_suffix = f"?{parsed.query}" if parsed.query else ""
        self.path = f"/index.html{query_suffix}"

    def do_GET(self) -> None:
        self._apply_spa_fallback_if_needed()
        super().do_GET()

    def do_HEAD(self) -> None:
        self._apply_spa_fallback_if_needed()
        super().do_HEAD()


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the app with SPA fallback routing.")
    parser.add_argument("port", nargs="?", default=3000, type=int, help="Port to listen on (default: 3000)")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    args = parser.parse_args()

    with socketserver.TCPServer((args.host, args.port), SPARequestHandler) as httpd:
        print(f"Serving with SPA fallback at http://{args.host}:{args.port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
