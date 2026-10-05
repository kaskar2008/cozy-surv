#!/usr/bin/env python3
"""Мини-сервер для разработки: без кэша, чтобы правки модулей применялись сразу."""
import http.server, socketserver, sys
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), H) as s:
    print(f'Уютный остров: http://localhost:{PORT}')
    s.serve_forever()
