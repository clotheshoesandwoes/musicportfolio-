"""
serve.py — Local dev server with Cloudflare-style rewrites.

Python's built-in `http.server` 404s on `/tracks`, `/t/<slug>`, etc. because
there are no actual files at those paths — in production Cloudflare reads
`_redirects` and rewrites those routes to `/index.html` so the SPA router
can handle them. This script reproduces those rewrites locally.

Usage:
    python serve.py            # serves on localhost:8000
    python serve.py 8001       # custom port
"""

import sys
import os
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


# Mirror of _redirects (rule_pattern → target). Order matters.
# All rules have status 200 (rewrite, not redirect), so the URL bar stays
# put and the client-side router reads location.pathname.
REWRITES = [
    (re.compile(r"^/tracks/?$"),               "/index.html"),
    (re.compile(r"^/tracks/.+$"),              "/index.html"),
    (re.compile(r"^/t/.+$"),                   "/index.html"),
    (re.compile(r"^/p/.+$"),                   "/index.html"),
    (re.compile(r"^/a/.+$"),                   "/index.html"),
    (re.compile(r"^/ep/.+$"),                  "/index.html"),
    (re.compile(r"^/world/?$"),                "/index.html"),
]


class RewriteHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # Strip query string for matching, keep it for the response so client
        # side can still read URLSearchParams.
        path_only = self.path.split("?", 1)[0]

        # Convenience: /scenes (no trailing slash) → /scenes/
        if path_only == "/scenes":
            self.send_response(302)
            self.send_header("Location", "/scenes/")
            self.end_headers()
            return

        # If a real file exists on disk, serve it as-is.
        rel = path_only.lstrip("/")
        # Directory-index fallback (e.g. /scenes/ → scenes/index.html)
        if path_only.endswith("/"):
            candidate = os.path.join(os.getcwd(), rel, "index.html")
        else:
            candidate = os.path.join(os.getcwd(), rel)
        if os.path.isfile(candidate):
            return super().do_GET()

        # Apply rewrites
        for pattern, target in REWRITES:
            if pattern.match(path_only):
                # Rewrite the request path so SimpleHTTPRequestHandler reads
                # /index.html. Keep the original path visible in the URL bar
                # because that's what location.pathname uses for routing.
                self.path = target
                return super().do_GET()

        # No rewrite matched → fall through (will 404 normally)
        return super().do_GET()

    def log_message(self, fmt, *args):
        # Color the 200/30x in a single line, quieter than the default
        sys.stderr.write(f"[{self.log_date_time_string()}] {self.address_string()}  {fmt % args}\n")


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    httpd = ThreadingHTTPServer(("", port), RewriteHandler)
    print(f"serving cantmute.me on http://localhost:{port}/  (Ctrl-C to stop)")
    print(f"  rewrites: {[p.pattern for p, _ in REWRITES]}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
        httpd.server_close()


if __name__ == "__main__":
    main()
