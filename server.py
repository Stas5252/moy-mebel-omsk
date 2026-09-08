import http.server
import socketserver
import os
import json
import datetime

PORT = 8080

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class LocalLeadHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path.endswith('send.php') or self.path == '/send.php':
            content_length = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_length)
            
            os.makedirs('leads', exist_ok=True)
            timestamp = datetime.datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
            lead_filename = os.path.join('leads', f'{timestamp}_lead.txt')
            
            with open(lead_filename, 'wb') as f:
                f.write(b'=== LOCAL DEV LEAD ===\n')
                f.write(f'Time: {timestamp}\n'.encode('utf-8'))
                f.write(post_body)
            
            print(f'📬 [LOCAL SERVER] Новая заявка сохранена в: {lead_filename}')
            
            response = json.dumps({'ok': True, 'msg': 'Заявка успешно принята'}).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)
        else:
            super().do_POST()

if __name__ == '__main__':
    server = ThreadedHTTPServer(('', PORT), LocalLeadHandler)
    print(f'Serving threaded HTTP at http://localhost:{PORT}')
    server.serve_forever()
