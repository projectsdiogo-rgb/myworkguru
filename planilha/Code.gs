/**
 * MyWorkGuru → Google Sheets
 * Copia os dados da app (Firebase / Firestore) para esta folha de cálculo e
 * volta a atualizá-la automaticamente a cada 5 minutos.
 *
 * Instalação (uma vez): escolha a função "instalar" no topo e carregue em ▶ Executar.
 * Para atualizar à mão a qualquer momento: menu "MyWorkGuru" → "Atualizar agora".
 *
 * Os dados são lidos com a sua conta Google (dona do projeto Firebase),
 * por isso não há nenhuma chave ou palavra-passe neste código.
 */
const PROJECT_ID = 'myworkguru-4f422';
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/';
const MINUTOS = 5;

const ESTADOS = { ok: 'Operacional', empty: 'Vazio', clean: 'Em limpeza', maint: 'Manutenção', alert: 'Alerta' };
const SAIDAS = { banco: 'Banco alimentar', externo: 'Tanque fora do mapa', pessoa: 'Levado por pessoa', outro: 'Outro destino' };
const ORDEM_TANQUES = (function () {
  const r = []; for (let i = 1; i <= 12; i++) r.push('R' + i);
  for (let i = 1; i <= 11; i++) r.push('Text' + i);
  for (let i = 1; i <= 8; i++) r.push('P' + i);
  [1, 2, 3, 4, 5, 7, 8, 9, 10, 11].forEach(function (n) { r.push('PP' + n); });
  return r;
})();

/* ---------------- Instalação e menu ---------------- */
function instalar() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone('Europe/Lisbon');
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'atualizar') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('atualizar').timeBased().everyMinutes(MINUTOS).create();
  PropertiesService.getScriptProperties().deleteProperty('assinatura');
  atualizar();
  SpreadsheetApp.getActive().toast('Instalado: a folha atualiza-se sozinha a cada ' + MINUTOS + ' minutos.', 'MyWorkGuru', 8);
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('MyWorkGuru')
    .addItem('Atualizar agora', 'atualizarAgora')
    .addItem('Reinstalar atualização automática', 'instalar')
    .addToUi();
}
function atualizarAgora() {
  PropertiesService.getScriptProperties().deleteProperty('assinatura');
  atualizar();
  SpreadsheetApp.getActive().toast('Dados atualizados.', 'MyWorkGuru', 4);
}

/* ---------------- Leitura do Firestore ---------------- */
function lerColecao(nome) {
  const docs = []; let token = '';
  do {
    const url = BASE + nome + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const r = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Goog-User-Project': PROJECT_ID },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) throw new Error('Erro a ler "' + nome + '" (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 400));
    const j = JSON.parse(r.getContentText());
    (j.documents || []).forEach(function (d) { docs.push({ id: d.name.split('/').pop(), data: valor({ mapValue: { fields: d.fields || {} } }) }); });
    token = j.nextPageToken || '';
  } while (token);
  return docs;
}
function valor(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return new Date(v.timestampValue).getTime();
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(valor);
  if ('mapValue' in v) { const o = {}, f = v.mapValue.fields || {}; Object.keys(f).forEach(function (k) { o[k] = valor(f[k]); }); return o; }
  return null;
}

/* ---------------- Ajudas ---------------- */
function data(ms) { return ms ? new Date(ms) : ''; }
function nomeTanque(id) { return /^Text\d+$/.test(id) ? 'Text ' + id.slice(4) : (id || ''); }
function grupo(id) { return /^R\d/.test(id) ? 'Interior · R' : /^Text/.test(id) ? 'Exterior · Text' : /^PP/.test(id) ? 'Exterior · PP' : /^P\d/.test(id) ? 'Exterior · P' : ''; }
function ordemTanque(id) { const i = ORDEM_TANQUES.indexOf(id); return i < 0 ? 999 : i; }
function inicioSemana(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
function ultima(arr) { return arr && arr.length ? arr[arr.length - 1] : 0; }
function idadeMeses(nasc) { return nasc ? Math.max(0, Math.floor((Date.now() - nasc) / 864e5 / 30.44)) : ''; }
function r1(x) { return x === '' || x == null ? '' : Math.round(Number(x) * 10) / 10; }

/* ---------------- Atualização ---------------- */
function atualizar() {
  const col = {};
  ['tanks', 'fichas', 'transfers', 'feeds', 'feedMoves', 'meta'].forEach(function (c) { col[c] = lerColecao(c); });
  const assinatura = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(col) + '|' + inicioSemana(Date.now())));
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('assinatura') === assinatura) { escreverResumo(col, false); return; }

  const tanks = {}; col.tanks.forEach(function (d) { tanks[d.id] = d.data; });
  const fichas = {}; col.fichas.forEach(function (d) { fichas[d.id] = d.data; });
  const ids = Object.keys(tanks).concat(ORDEM_TANQUES).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return ordemTanque(a) - ordemTanque(b); });
  const semana = inicioSemana(Date.now());

  // Tanques
  const linhasTanques = ids.map(function (id) {
    const t = tanks[id] || {}; const vazio = t.status === 'empty'; const lc = ultima(t.cleans);
    const tr = t.treat && !t.treat.endedAt ? t.treat : null;
    return [nomeTanque(id), grupo(id), ESTADOS[t.status || 'ok'] || t.status, t.species || '', t.content || '',
      vazio ? '— (vazio)' : (lc >= semana ? 'Sim' : 'Não'), data(lc),
      tr ? tr.product + (tr.dose ? ' (' + tr.dose + ')' : '') + ' — água desligada até ' + Utilities.formatDate(new Date(tr.waterUntil), 'Europe/Lisbon', 'HH:mm') : '',
      t.notes || '', data(t.updatedAt)];
  });
  escrever('Tanques', ['Tanque', 'Zona', 'Estado', 'Espécie', 'Lote / conteúdo', 'Limpo esta semana', 'Última limpeza', 'Tratamento em curso', 'Notas', 'Atualizado'], linhasTanques, [6, 9]);

  // Limpezas
  const limpezas = [];
  ids.forEach(function (id) { ((tanks[id] || {}).cleans || []).forEach(function (c) { limpezas.push([data(c), nomeTanque(id), c >= semana ? 'Esta semana' : '']); }); });
  limpezas.sort(function (a, b) { return b[0] - a[0]; });
  escrever('Limpezas', ['Data', 'Tanque', 'Semana'], limpezas, [0]);

  // Tratamentos
  const trat = [];
  ids.forEach(function (id) {
    const t = tanks[id] || {};
    (t.treatments || []).concat(t.treat && !t.treat.endedAt ? [t.treat] : []).forEach(function (x) {
      trat.push([data(x.start), nomeTanque(id), x.product || '', x.dose || '', x.waterMin || '', data(x.waterUntil), data(x.waterOnAt),
        x.endedAt ? 'Concluído' : 'Em curso', x.notes || '']);
    });
  });
  trat.sort(function (a, b) { return b[0] - a[0]; });
  escrever('Tratamentos', ['Início', 'Tanque', 'Produto', 'Dose', 'Água parada (min)', 'Ligar água às', 'Água ligada às', 'Estado', 'Notas'], trat, [0, 5, 6]);

  // Transferências
  const transf = col.transfers.map(function (d) {
    const x = d.data; const para = x.to ? nomeTanque(x.to) : (SAIDAS[x.out] || 'Saída') + (x.outDetail ? ' (' + x.outDetail + ')' : '');
    const tipo = x.to ? 'Entre tanques' : (x.from === 'fora' ? 'Entrada' : 'Saída');
    return [data(x.t), tipo, x.from === 'fora' ? 'Fora do mapa' : nomeTanque(x.from), para, x.species || '', x.qty || '', r1(x.kg || ''), x.notes || '', x.by || ''];
  }).sort(function (a, b) { return b[0] - a[0]; });
  escrever('Transferências', ['Data', 'Tipo', 'De', 'Para', 'Espécie', 'Nº peixes', 'Peso (kg)', 'Notas', 'Registado por'], transf, [0]);

  // Rações
  const racoes = col.feeds.map(function (d) {
    const f = d.data; const low = f.minKg > 0 && f.stockKg <= f.minKg;
    return [f.name || '', r1(f.stockKg), r1(f.bagKg), f.bagKg > 0 ? r1(f.stockKg / f.bagKg) : '', r1(f.minKg || ''), low ? 'STOCK BAIXO' : ''];
  }).sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'pt'); });
  escrever('Rações', ['Ração', 'Stock (kg)', 'Saco (kg)', 'Nº sacos', 'Aviso abaixo de (kg)', 'Alerta'], racoes, []);

  const nomesRacao = {}; col.feeds.forEach(function (d) { nomesRacao[d.id] = d.data.name; });
  const movs = col.feedMoves.map(function (d) {
    const m = d.data;
    return [data(m.t), nomesRacao[m.feedId] || m.name || '', m.kg < 0 ? 'Saída' : 'Entrada', r1(m.kg), m.bags || '', r1(m.after), m.dest || '', m.note || '', m.by || ''];
  }).sort(function (a, b) { return b[0] - a[0]; });
  escrever('Movimentos rações', ['Data', 'Ração', 'Tipo', 'kg', 'Sacos', 'Stock depois (kg)', 'Destino', 'Nota', 'Por'], movs, [0]);

  // Fichas e pesagens
  const fichasL = [], pesagens = [];
  ORDEM_TANQUES.filter(function (id) { return /^R\d/.test(id); }).forEach(function (id) {
    const f = fichas[id] || {}; const P = (f.pesagens || []).slice().sort(function (a, b) { return b.t - a.t; }); const w = P[0] || {};
    fichasL.push([id, f.species || (tanks[id] || {}).species || '', data(f.birth), idadeMeses(f.birth), data(f.entry), f.count || '', f.lote || '', f.origin || '',
      data(w.t), r1(w.weight || ''), r1(w.length || ''), f.count && w.weight ? r1(f.count * w.weight / 1000) : '', f.notes || '', data(f.updatedAt), f.by || '']);
    P.forEach(function (x) { pesagens.push([data(x.t), id, f.species || '', r1(x.weight || ''), r1(x.length || ''), x.n || '', x.by || '']); });
  });
  pesagens.sort(function (a, b) { return b[0] - a[0]; });
  escrever('Fichas', ['Tanque', 'Espécie', 'Nascimento', 'Idade (meses)', 'Entrada no tanque', 'Nº peixes', 'Lote', 'Origem', 'Última pesagem', 'Peso médio (g)', 'Tamanho médio (cm)', 'Biomassa (kg)', 'Notas', 'Atualizada', 'Por'], fichasL, [2, 4, 8, 13]);
  escrever('Pesagens', ['Data', 'Tanque', 'Espécie', 'Peso médio (g)', 'Tamanho médio (cm)', 'Amostra', 'Por'], pesagens, [0]);

  // Histórico (registos de todos os tanques)
  const hist = [];
  ids.forEach(function (id) { ((tanks[id] || {}).log || []).forEach(function (l) { hist.push([data(l.t), nomeTanque(id), l.text || '', l.by || '']); }); });
  hist.sort(function (a, b) { return b[0] - a[0]; });
  escrever('Histórico', ['Data', 'Tanque', 'Registo', 'Por'], hist.slice(0, 5000), [0]);

  escreverResumo(col, true, { limpos: linhasTanques.filter(function (r) { return r[5] === 'Sim'; }).length, aLimpar: linhasTanques.filter(function (r) { return r[5] !== '— (vazio)'; }).length,
    emTrat: linhasTanques.filter(function (r) { return r[7]; }).length, baixo: racoes.filter(function (r) { return r[5]; }).length });
  props.setProperty('assinatura', assinatura);
}

function escreverResumo(col, mudou, n) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Resumo');
  if (!sh) { sh = ss.insertSheet('Resumo', 0); }
  const agora = new Date();
  if (!mudou) { sh.getRange('B3').setValue(agora).setNumberFormat('dd/mm/yyyy hh:mm'); return; }
  sh.clear();
  const linhas = [
    ['MyWorkGuru — dados da app', ''],
    ['Atualiza-se sozinha a cada ' + MINUTOS + ' min. Não edite aqui: as alterações fazem-se na app.', ''],
    ['Última verificação', agora],
    ['Última alteração de dados', agora],
    ['', ''],
    ['Tanques limpos esta semana', n.limpos + ' / ' + n.aLimpar],
    ['Tanques com tratamento em curso', n.emTrat],
    ['Rações com stock baixo', n.baixo],
    ['Transferências registadas', col.transfers.length],
    ['Fichas preenchidas', col.fichas.length]
  ];
  sh.getRange(1, 1, linhas.length, 2).setValues(linhas);
  sh.getRange('A1').setFontSize(16).setFontWeight('bold').setFontColor('#0e7c86');
  sh.getRange('A2').setFontColor('#5d6b78').setFontStyle('italic');
  sh.getRange('B3:B4').setNumberFormat('dd/mm/yyyy hh:mm');
  sh.getRange('A6:A10').setFontWeight('bold');
  sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 180);
}

function escrever(nome, cab, linhas, colunasData) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nome);
  const nova = !sh;
  if (!sh) sh = ss.insertSheet(nome);
  sh.clearContents();
  const dados = [cab].concat(linhas.length ? linhas : [cab.map(function (_, i) { return i === 0 ? '(sem registos)' : ''; })]);
  sh.getRange(1, 1, dados.length, cab.length).setValues(dados);
  const h = sh.getRange(1, 1, 1, cab.length);
  h.setFontWeight('bold').setBackground('#0e7c86').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  if (dados.length > 1) colunasData.forEach(function (c) { sh.getRange(2, c + 1, dados.length - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm'); });
  if (nova) { try { sh.autoResizeColumns(1, cab.length); } catch (e) {} }
  if (sh.getFilter() == null && dados.length > 1) { try { sh.getRange(1, 1, dados.length, cab.length).createFilter(); } catch (e) {} }
  else if (sh.getFilter()) { try { sh.getFilter().remove(); sh.getRange(1, 1, dados.length, cab.length).createFilter(); } catch (e) {} }
}
