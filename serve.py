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
from urllib.parse import unquote
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
    # b193: Chromium-based browsers (Chrome, Vivaldi, Edge) hang audio playback
    # when the server doesn't honor HTTP Range requests — `audio.play()` never
    # resolves and currentTime stays at 0 even though metadata loaded. Python's
    # built-in handler returns full 200s for everything, so we add Range support
    # for media-y file types below.
    RANGE_EXTS = (".mp3", ".m4a", ".ogg", ".wav", ".webm", ".mp4")

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

        # If a real file exists on disk, serve it as-is. URL-decode before the
        # file-existence check — most audio filenames contain spaces, which
        # arrive as `%20` in path_only and never match the actual on-disk name.
        decoded = unquote(path_only)
        rel = decoded.lstrip("/")
        # Directory-index fallback (e.g. /scenes/ → scenes/index.html)
        if decoded.endswith("/"):
            candidate = os.path.join(os.getcwd(), rel, "index.html")
        else:
            candidate = os.path.join(os.getcwd(), rel)
        if os.path.isfile(candidate):
            if candidate.lower().endswith(self.RANGE_EXTS):
                return self._serve_with_range(candidate)
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

    def _serve_with_range(self, path):
        """Range-aware static file serving for media files."""
        try:
            file_size = os.path.getsize(path)
        except OSError:
            self.send_error(404, "File not found")
            return

        ctype = self.guess_type(path)
        range_header = self.headers.get("Range")
        start, end = 0, file_size - 1
        status = 200

        if range_header:
            # Format: "bytes=START-END" (END optional)
            m = re.match(r"bytes=(\d+)-(\d*)", range_header)
            if m:
                start = int(m.group(1))
                if m.group(2):
                    end = min(int(m.group(2)), file_size - 1)
                if start > end or start >= file_size:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{file_size}")
                    self.end_headers()
                    return
                status = 206

        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()

        try:
            with open(path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(64 * 1024, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_HEAD(self):
        # Mirror do_GET's special-cases so HEAD works for media files too.
        return self.do_GET()

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
