import http.server
import json
import os
import sys

PORT = 8085
DIRECTORIO = os.path.dirname(os.path.abspath(__file__))

class ManejadorServidor(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORIO, **kwargs)

    def do_POST(self):
        # Endpoint para guardar los cambios de la web directamente en data.json en el disco
        if self.path in ('/api/guardar', '/data.json'):
            longitud = int(self.headers.get('Content-Length', 0))
            cuerpo = self.rfile.read(longitud)
            try:
                datos = json.loads(cuerpo.decode('utf-8'))
                ruta_json = os.path.join(DIRECTORIO, 'data.json')
                with open(ruta_json, 'w', encoding='utf-8') as archivo:
                    json.dump(datos, archivo, ensure_ascii=False, indent=2)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'{"ok": true, "mensaje": "data.json guardado en disco exitosamente"}')
                print("[SERVIDOR] data.json actualizado en el disco duro correctamente.")
                return
            except Exception as error:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(error)}).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, formato, *argumentos):
        # Registro limpio en consola
        sys.stderr.write(f"[HTTP] {self.address_string()} - {formato % argumentos}\n")

if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('', PORT), ManejadorServidor) as servidor:
        print(f"Servidor DAFP activo en http://localhost:{PORT}")
        print("Cualquier cambio en la página web se guardará automáticamente en data.json.")
        servidor.serve_forever()
