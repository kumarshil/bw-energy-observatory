from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        response_data = {
            "status": "online",
            "message": "BW Energy Observatory Python backend is active via Vercel serverless."
        }
        self.wfile.write(json.dumps(response_data).encode('utf-8'))
        return
