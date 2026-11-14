# MyWorkGuru

App para organizar o local de trabalho: mapa dos tanques, limpezas semanais, tratamentos (com temporizador de água), transferências de peixe e stock de rações.

- **Site:** https://projectsdiogo-rgb.github.io/myworkguru/
- **Login e dados:** Firebase (Authentication + Cloud Firestore), projeto `myworkguru-4f422`.
- **Acesso:** cada pessoa cria conta e fica "a aguardar"; o administrador aprova como *Editor* ou *Só leitura*.

## Ficheiros

| Ficheiro | O que é |
|---|---|
| `index.html` | Página e estilos |
| `app.js` | A app |
| `firebase.js` | Ligação ao Firebase (configuração pública) |
| `ficha.html` | Ficha pública de um tanque (`ficha.html?t=R5`) — é o que abre o QR code |
| `qrs.html` | Folha A4 com os QR codes dos tanques R1–R12, pronta a imprimir |
| `qr.js` | Gerador de QR codes |
| `firestore.rules` | Regras de segurança — copiar para Firebase → Firestore → Regras |
| `manifest.webmanifest`, `icon-*` | Para instalar no ecrã do telemóvel |

As alterações enviadas para o ramo `main` ficam online no GitHub Pages em 1–2 minutos.
