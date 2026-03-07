import os
import json
import logging
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from socketserver import ThreadingMixIn

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants
DB_DIR = os.path.expanduser("~/.timevault")
DB_FILE = os.path.join(DB_DIR, "timevault-db.json")

# Ensure DB Directory exists
os.makedirs(DB_DIR, exist_ok=True)

class ThreadingSimpleServer(ThreadingMixIn, HTTPServer):
    pass

class TimeVaultHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local testing if needed
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        # API Route: Get remote DB state
        if parsed_path.path == '/api/sync':
            self.handle_sync_get()
            return
            
        # Default behavior: Serve static files
        return super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        # API Route: Save state from client
        if parsed_path.path == '/api/sync':
            self.handle_sync_post()
            return
            
        self.send_error(404, "File not found")

    def handle_sync_get(self):
        """Read timevault-db.json and return it"""
        try:
            if os.path.exists(DB_FILE):
                with open(DB_FILE, 'r') as f:
                    data = f.read()
            else:
                data = "{}" # Empty JSON object by default
                
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(data.encode('utf-8'))
        except Exception as e:
            logging.error(f"Error reading DB: {e}")
            self.send_error(500, "Internal Server Error")

    def handle_sync_post(self):
        """Accept JSON payload and securely write to timevault-db.json"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "Bad Request: No data provided")
                return
                
            post_data = self.rfile.read(content_length)
            json_data = json.loads(post_data.decode('utf-8'))
            
            # Atomic write pattern to prevent corruption
            temp_file = DB_FILE + ".tmp"
            with open(temp_file, 'w') as f:
                json.dump(json_data, f, indent=2)
            os.replace(temp_file, DB_FILE)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"success"}')
            logging.info("Database synced successfully")
            
        except json.JSONDecodeError:
            self.send_error(400, "Bad Request: Invalid JSON Payload")
        except Exception as e:
            logging.error(f"Error saving DB: {e}")
            self.send_error(500, "Internal Server Error")

def run(server_class=ThreadingSimpleServer, handler_class=TimeVaultHandler, port=51888):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    logging.info(f"Starting TimeVault API & Static Server on port {port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    logging.info("Server stopped.")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=51888, help='Port to run the server on')
    args = parser.parse_args()
    
    run(port=args.port)
