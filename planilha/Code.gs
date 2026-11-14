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
  executar(true);
  SpreadsheetApp.getActive().toast('Instalado: a folha atualiza-se sozinha a cada ' + MINUTOS + ' minutos.', 'MyWorkGuru', 8);
}
function onOpen() {
  SpreadsheetApp.getUi().createMenu('MyWorkGuru')
    .addItem('Atualizar agora', 'atualizarAgora')
    .addItem('Reinstalar atualização automática', 'instalar')
    .addToUi();
}
function atualizarAgora() { executar(true); SpreadsheetApp.getActive().toast('Dados atualizados.', 'MyWorkGuru', 4); }
/** Chamada pelo acionador automático a cada 5 minutos. */
function atualizar() { executar(false); }

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
function pedido(url, corpo) {
  const op = { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Goog-User-Project': PROJECT_ID }, muteHttpExceptions: true };
  if (corpo) { op.method = 'post'; op.contentType = 'application/json'; op.payload = JSON.stringify(corpo); }
  return UrlFetchApp.fetch(url, op);
}
/** Lê um documento (ou null se não existir). */
function lerDoc(caminho) {
  const r = pedido(BASE + caminho);
  if (r.getResponseCode() === 404) return null;
  if (r.getResponseCode() !== 200) throw new Error('Erro a ler "' + caminho + '" (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 400));
  const d = JSON.parse(r.getContentText());
  return valor({ mapValue: { fields: d.fields || {} } });
}
/** Lê só os documentos alterados depois de "desde" (campo _mod gravado pela app). */
function lerAlterados(nome, desde) {
  const r = pedido(BASE.replace(/\/$/, '') + ':runQuery', { structuredQuery: { from: [{ collectionId: nome }], where: { fieldFilter: { field: { fieldPath: '_mod' }, op: 'GREATER_THAN', value: { integerValue: String(Math.floor(desde)) } } } } });
  if (r.getResponseCode() !== 200) throw new Error('Erro a consultar "' + nome + '" (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 400));
  const out = [];
  JSON.parse(r.getContentText()).forEach(function (x) { if (x.document) out.push({ id: x.document.name.split('/').pop(), data: valor({ mapValue: { fields: x.document.fields || {} } }) }); });
  return out;
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

/* ---------------- Atualização ----------------
 * Separadores de ESTADO ATUAL (reescritos): Resumo, Tanques, Rações, Fichas.
 * Separadores de ARQUIVO (acumulam desde o primeiro dia, nunca apagam):
 *   Limpezas, Tratamentos, Transferências, Movimentos rações, Pesagens, Histórico.
 * Para poupar leituras ao Firebase, só lê dados quando a app gravou algo novo (meta/sync).
 */
const MARGEM = 24 * 3600 * 1000; // relê alterações das últimas 24 h (relógios dos telemóveis podem diferir)
function executar(forcar) {
  const props = PropertiesService.getScriptProperties();
  const marca = lerDoc('meta/sync');
  const t = marca && marca.t ? marca.t : 0;
  const semana = inicioSemana(Date.now());
  if (!forcar && String(t) === props.getProperty('marca') && String(semana) === props.getProperty('semana')) { marcarHora(); return; }

  const tanksD = lerColecao('tanks'), fichasD = lerColecao('fichas'), feedsD = lerColecao('feeds');
  const ultimoMod = Number(props.getProperty('ultimoMod') || 0);
  const transfD = ultimoMod ? lerAlterados('transfers', ultimoMod - MARGEM) : lerColecao('transfers');
  const movsD = ultimoMod ? lerAlterados('feedMoves', ultimoMod - MARGEM) : lerColecao('feedMoves');

  const tanks = {}; tanksD.forEach(function (d) { tanks[d.id] = d.data; });
  const fichas = {}; fichasD.forEach(function (d) { fichas[d.id] = d.data; });
  const ids = Object.keys(tanks).concat(ORDEM_TANQUES).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return ordemTanque(a) - ordemTanque(b); });

  // ---- Estado atual ----
  const linhasTanques = ids.map(function (id) {
    const tk = tanks[id] || {}; const vazio = tk.status === 'empty'; const lc = ultima(tk.cleans);
    const tr = tk.treat && !tk.treat.endedAt ? tk.treat : null;
    return [nomeTanque(id), grupo(id), ESTADOS[tk.status || 'ok'] || tk.status, tk.species || '', tk.content || '',
      vazio ? '— (vazio)' : (lc >= semana ? 'Sim' : 'Não'), data(lc),
      tr ? tr.product + (tr.dose ? ' (' + tr.dose + ')' : '') + ' — água desligada até ' + Utilities.formatDate(new Date(tr.waterUntil), 'Europe/Lisbon', 'HH:mm') : '',
      tk.notes || '', data(tk.updatedAt)];
  });
  escrever('Tanques', ['Tanque', 'Zona', 'Estado', 'Espécie', 'Lote / conteúdo', 'Limpo esta semana', 'Última limpeza', 'Tratamento em curso', 'Notas', 'Atualizado'], linhasTanques, [6, 9]);

  const racoes = feedsD.map(function (d) {
    const f = d.data; const low = f.minKg > 0 && f.stockKg <= f.minKg;
    return [f.name || '', r1(f.stockKg), r1(f.bagKg), f.bagKg > 0 ? r1(f.stockKg / f.bagKg) : '', r1(f.minKg || ''), low ? 'STOCK BAIXO' : ''];
  }).sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'pt'); });
  escrever('Rações', ['Ração', 'Stock (kg)', 'Saco (kg)', 'Nº sacos', 'Aviso abaixo de (kg)', 'Alerta'], racoes, []);

  const fichasL = [], pesagens = [];
  ORDEM_TANQUES.filter(function (id) { return /^R\d/.test(id); }).forEach(function (id) {
    const f = fichas[id] || {}; const P = (f.pesagens || []).slice().sort(function (a, b) { return b.t - a.t; }); const w = P[0] || {};
    fichasL.push([id, f.species || (tanks[id] || {}).species || '', data(f.birth), idadeMeses(f.birth), data(f.entry), f.count || '', f.lote || '', f.origin || '',
      data(w.t), r1(w.weight || ''), r1(w.length || ''), f.count && w.weight ? r1(f.count * w.weight / 1000) : '', f.notes || '', data(f.updatedAt), f.by || '']);
    P.forEach(function (x) { pesagens.push({ k: id + '|' + (x.id || x.t), r: [data(x.t), id, f.species || '', r1(x.weight || ''), r1(x.length || ''), x.n || '', x.by || ''] }); });
  });
  escrever('Fichas', ['Tanque', 'Espécie', 'Nascimento', 'Idade (meses)', 'Entrada no tanque', 'Nº peixes', 'Lote', 'Origem', 'Última pesagem', 'Peso médio (g)', 'Tamanho médio (cm)', 'Biomassa (kg)', 'Notas', 'Atualizada', 'Por'], fichasL, [2, 4, 8, 13]);

  // ---- Arquivo (acumula) ----
  const limpezas = [], trat = [], hist = [];
  ids.forEach(function (id) {
    const tk = tanks[id] || {};
    (tk.cleans || []).forEach(function (c) { limpezas.push({ k: id + '|' + c, r: [data(c), nomeTanque(id)] }); });
    (tk.treatments || []).concat(tk.treat && !tk.treat.endedAt ? [tk.treat] : []).forEach(function (x) {
      trat.push({ k: id + '|' + x.start, r: [data(x.start), nomeTanque(id), x.product || '', x.dose || '', x.waterMin || '', data(x.waterUntil), data(x.waterOnAt), x.endedAt ? 'Concluído' : 'Em curso', x.notes || ''] });
    });
    (tk.log || []).forEach(function (l) { hist.push({ k: id + '|' + l.t + '|' + l.text, r: [data(l.t), nomeTanque(id), l.text || '', l.by || ''] }); });
  });
  const transf = transfD.map(function (d) {
    const x = d.data; const para = x.to ? nomeTanque(x.to) : (SAIDAS[x.out] || 'Saída') + (x.outDetail ? ' (' + x.outDetail + ')' : '');
    const tipo = x.to ? 'Entre tanques' : (x.from === 'fora' ? 'Entrada' : 'Saída');
    return { k: d.id, r: [data(x.t), tipo, x.from === 'fora' ? 'Fora do mapa' : nomeTanque(x.from), para, x.species || '', x.qty || '', r1(x.kg || ''), x.notes || '', x.by || ''] };
  });
  const nomesRacao = {}; feedsD.forEach(function (d) { nomesRacao[d.id] = d.data.name; });
  const movs = movsD.map(function (d) {
    const m = d.data;
    return { k: d.id, r: [data(m.t), nomesRacao[m.feedId] || m.name || '', m.kg < 0 ? 'Saída' : 'Entrada', r1(m.kg), m.bags || '', r1(m.after), m.dest || '', m.note || '', m.by || ''] };
  });
  const n = {};
  n.limpezas = arquivar('Limpezas', ['Data', 'Tanque'], limpezas, [0]);
  n.trat = arquivar('Tratamentos', ['Início', 'Tanque', 'Produto', 'Dose', 'Água parada (min)', 'Ligar água às', 'Água ligada às', 'Estado', 'Notas'], trat, [0, 5, 6]);
  n.transf = arquivar('Transferências', ['Data', 'Tipo', 'De', 'Para', 'Espécie', 'Nº peixes', 'Peso (kg)', 'Notas', 'Registado por'], transf, [0]);
  n.movs = arquivar('Movimentos rações', ['Data', 'Ração', 'Tipo', 'kg', 'Sacos', 'Stock depois (kg)', 'Destino', 'Nota', 'Por'], movs, [0]);
  n.pes = arquivar('Pesagens', ['Data', 'Tanque', 'Espécie', 'Peso médio (g)', 'Tamanho médio (cm)', 'Amostra', 'Por'], pesagens, [0]);
  n.hist = arquivar('Histórico', ['Data', 'Tanque', 'Registo', 'Por'], hist, [0]);

  escreverResumo({
    limpos: linhasTanques.filter(function (r) { return r[5] === 'Sim'; }).length, aLimpar: linhasTanques.filter(function (r) { return r[5] !== '— (vazio)'; }).length,
    emTrat: linhasTanques.filter(function (r) { return r[7]; }).length, baixo: racoes.filter(function (r) { return r[5]; }).length,
    fichas: fichasD.length, arquivo: n
  });
  let maxMod = ultimoMod;
  transfD.concat(movsD).forEach(function (d) { if (d.data._mod > maxMod) maxMod = d.data._mod; });
  if (t > maxMod) maxMod = t;
  props.setProperties({ marca: String(t), semana: String(semana), ultimoMod: String(maxMod || Date.now()) });
}

function marcarHora() {
  const sh = SpreadsheetApp.getActive().getSheetByName('Resumo');
  if (sh) sh.getRange('B3').setValue(new Date()).setNumberFormat('dd/mm/yyyy hh:mm');
}

function escreverResumo(n) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Resumo');
  if (!sh) { sh = ss.insertSheet('Resumo', 0); }
  sh.clear();
  const agora = new Date(), a = n.arquivo;
  const linhas = [
    ['MyWorkGuru — dados da app', ''],
    ['Atualiza-se sozinha a cada ' + MINUTOS + ' min. Não edite aqui: as alterações fazem-se na app.', ''],
    ['Última verificação', agora],
    ['Última alteração de dados', agora],
    ['', ''],
    ['ESTADO ATUAL', ''],
    ['Tanques limpos esta semana', n.limpos + ' / ' + n.aLimpar],
    ['Tanques com tratamento em curso', n.emTrat],
    ['Rações com stock baixo', n.baixo],
    ['Fichas preenchidas', n.fichas],
    ['', ''],
    ['ARQUIVO (desde o primeiro dia)', ''],
    ['Limpezas', a.limpezas], ['Tratamentos', a.trat], ['Transferências', a.transf],
    ['Movimentos de rações', a.movs], ['Pesagens', a.pes], ['Registos no histórico', a.hist]
  ];
  sh.getRange(1, 1, linhas.length, 2).setValues(linhas);
  sh.getRange('A1').setFontSize(16).setFontWeight('bold').setFontColor('#0e7c86');
  sh.getRange('A2').setFontColor('#5d6b78').setFontStyle('italic');
  sh.getRange('B3:B4').setNumberFormat('dd/mm/yyyy hh:mm');
  sh.getRange('A6').setFontWeight('bold').setFontColor('#0e7c86');
  sh.getRange('A12').setFontWeight('bold').setFontColor('#0e7c86');
  sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 180);
}

/** Separador de estado atual: reescrito por completo. */
function escrever(nome, cab, linhas, colunasData) {
  const sh = folha(nome);
  sh.clearContents();
  const dados = [cab].concat(linhas.length ? linhas : [cab.map(function (_, i) { return i === 0 ? '(sem registos)' : ''; })]);
  sh.getRange(1, 1, dados.length, cab.length).setValues(dados);
  formatar(sh, cab.length, dados.length, colunasData);
}

/**
 * Separador de arquivo: junta os registos novos aos que já lá estavam (pela chave escondida na última coluna).
 * Nada é apagado, mesmo que já não exista na app. Devolve o nº total de registos.
 */
function arquivar(nome, cab, itens, colunasData) {
  const sh = folha(nome);
  const cabK = cab.concat(['ID']);
  const mapa = {}, ordem = [];
  const nl = sh.getLastRow(), nc = sh.getLastColumn();
  if (nl > 1 && nc === cabK.length) {
    const atual = sh.getRange(1, 1, nl, nc).getValues();
    if (atual[0].join('|') === cabK.join('|')) {
      for (let i = 1; i < atual.length; i++) { const k = String(atual[i][nc - 1]); if (!k) continue; if (!(k in mapa)) ordem.push(k); mapa[k] = atual[i].slice(0, nc - 1); }
    }
  }
  itens.forEach(function (it) { const k = String(it.k); if (!(k in mapa)) ordem.push(k); mapa[k] = it.r; });
  const linhas = ordem.map(function (k) { return mapa[k].concat([k]); });
  linhas.sort(function (a, b) { return (b[0] instanceof Date ? b[0].getTime() : 0) - (a[0] instanceof Date ? a[0].getTime() : 0); });
  sh.clearContents();
  const dados = [cabK].concat(linhas.length ? linhas : [cabK.map(function (_, i) { return i === 0 ? '(sem registos)' : ''; })]);
  sh.getRange(1, 1, dados.length, cabK.length).setValues(dados);
  formatar(sh, cabK.length, dados.length, colunasData);
  try { sh.hideColumns(cabK.length); } catch (e) {}
  return linhas.length;
}

function folha(nome) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(nome);
  if (!sh) { sh = ss.insertSheet(nome); sh.__nova = true; }
  return sh;
}
function formatar(sh, ncol, nlin, colunasData) {
  sh.getRange(1, 1, 1, ncol).setFontWeight('bold').setBackground('#0e7c86').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  if (nlin > 1) colunasData.forEach(function (c) { sh.getRange(2, c + 1, nlin - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm'); });
  if (sh.__nova) { try { sh.autoResizeColumns(1, ncol); } catch (e) {} }
  try { if (sh.getFilter()) sh.getFilter().remove(); if (nlin > 1) sh.getRange(1, 1, nlin, ncol).createFilter(); } catch (e) {}
}
