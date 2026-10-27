"""Yerel sunucu: python serve.py [port]  (varsayılan 4321)

python -m http.server önbellek başlığı göndermediği için tarayıcı güncellenmiş JS/CSS yerine
eski kopyayı kullanabiliyor. Bu sunucu her dosyayı "no-cache" ile verir: tarayıcı her açılışta
dosyanın değişip değişmediğini sorar (değişmediyse 304 döner, yine hızlıdır).
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
    # Yalnızca bu bilgisayardan erişilir; veriler zaten tarayıcıda tutuluyor
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler)
    print(f"Bisolera portal: http://localhost:{port}", flush=True)   # ASCII: Windows konsolu Türkçe karakterde hata verebiliyor
    server.serve_forever()
