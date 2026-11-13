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
| `firestore.rules` | Regras de segurança — copiar para Firebase → Firestore → Regras |
| `manifest.webmanifest`, `icon-*` | Para instalar no ecrã do telemóvel |

As alterações enviadas para o ramo `main` ficam online no GitHub Pages em 1–2 minutos.
