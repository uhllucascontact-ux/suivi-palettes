"""Petit serveur local pour tester l'application mobile sur le téléphone.

Lancement :  python serveur.py [port]
"""

import http.server
import os
import socketserver
import sys

DOSSIER = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".png": "image/png",
        ".html": "text/html; charset=utf-8",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DOSSIER, **kwargs)

    def end_headers(self):
        if self.path in ("/", "/index.html", "/sw.js"):
            self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, *args):
        pass


class Serveur(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Serveur(("0.0.0.0", PORT), Gestionnaire) as httpd:
        print(f"Serveur prêt sur http://localhost:{PORT} (dossier : {DOSSIER})", flush=True)
        httpd.serve_forever()
