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

## Folha Google (dados sempre atualizados)

A pasta `planilha/` tem o script que copia os dados da app para uma Google Sheets a cada 5 minutos.

- **Estado atual** (reescrito): Resumo, Tanques, Rações, Fichas.
- **Arquivo permanente** (acumula desde o primeiro dia, nunca apaga): Limpezas, Tratamentos, Transferências, Movimentos rações, Pesagens, Histórico.

A app guarda só os registos recentes para se manter leve; o histórico completo fica na folha.
A folha só lê o Firebase quando a app gravou algo novo (documento `meta/sync`), para poupar a quota gratuita.

1. Criar uma folha no Google Drive (mesma conta Google do Firebase) → Extensões → Apps Script.
2. Definições do projeto → ativar "Mostrar o ficheiro de manifesto appsscript.json".
3. Colar `planilha/appsscript.json` e `planilha/Code.gs`, guardar.
4. Escolher a função `instalar` → Executar → autorizar.

## Publicar uma versão nova

Antes de cada `git push`, correr `python3 tools/bump.py`: atualiza `version.json`, `APP_VERSION` em `app.js` e o `?v=` em `index.html`.
Os telemóveis com a app aberta mostram então o aviso **"Nova versão disponível — tocar para atualizar"** (verificação ao GitHub, sem gastar leituras do Firebase).
