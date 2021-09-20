#!/usr/bin/env python3.9

import http.server
import os, sys
import socket

client_specifiable_mime_types = {
    'application/wasm',
    'application/octet-stream',
    'application/json',
}

class CORPIsolatedHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Add Cross-Origin-Resource-Policy isolation headers to all requests."""

    def end_headers(self):
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()

    def guess_type(self, path):
        acceptable = self.headers.get('Accept', "*/*")
        if acceptable in client_specifiable_mime_types:
            return acceptable
        return super().guess_type(path)

def get_best_family(*address):
    infos = socket.getaddrinfo(*address, type=socket.SOCK_STREAM, flags=socket.AI_PASSIVE)
    family, type, proto, canonname, sockaddr = next(iter(infos))
    return family, sockaddr

# We mimic http.server, including copying DualStackServer.
if __name__ == "__main__":
    import argparse
    import contextlib

    parser = argparse.ArgumentParser()
    parser.add_argument('--bind', '-b', metavar='ADDRESS',
            help='Specify alternate bind address [default: localhost] (all means all interfaces)',
            default='localhost')
    parser.add_argument('--directory', '-d', default=os.getcwd(),
            help='Specify alternate directory [default: current directory]')
    parser.add_argument('port', action='store', default=8000, type=int, nargs='?',
            help='Specify alternate port [default 8000]')
    args = parser.parse_args()

    class DualStackServer(http.server.ThreadingHTTPServer):
        def server_bind(self):
            # suppress exception when protocol is IPv4
            with contextlib.suppress(Exception):
                self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            return super().server_bind()

    bind = None if args.bind == 'all' else args.bind
    port = args.port
    DualStackServer.address_family, addr = get_best_family(bind, port)
    CORPIsolatedHTTPRequestHandler.protocol_version = "HTTP/1.0"
    with DualStackServer(addr, CORPIsolatedHTTPRequestHandler) as httpd:
        host, port = httpd.socket.getsockname()[:2]
        url_host = f'[{host}]' if ':' in host else host
        print(f"Serving HTTP on {host} port {port} (http://{url_host}:{port}/) ...")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nKeyboard Interrupt received, exiting.")
            sys.exit(0)
