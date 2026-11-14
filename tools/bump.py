#!/usr/bin/env python3
"""Marca uma versão nova da app (correr antes de cada publicação).
Atualiza version.json, a constante APP_VERSION em app.js e o ?v= em index.html,
para que os telemóveis mostrem o aviso "Nova versão disponível" e carreguem o código novo."""
import json, re, time, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
v = time.strftime("%Y%m%d%H%M%S")
(root / "version.json").write_text(json.dumps({"version": v}) + "\n")
app = (root / "app.js").read_text()
app = re.sub(r'var APP_VERSION="[^"]*";', f'var APP_VERSION="{v}";', app, count=1)
(root / "app.js").write_text(app)
html = (root / "index.html").read_text()
html = re.sub(r'(href|src)="app\.js(\?v=[^"]*)?"', lambda m: f'{m.group(1)}="app.js?v={v}"', html)
(root / "index.html").write_text(html)
print("versão", v)
