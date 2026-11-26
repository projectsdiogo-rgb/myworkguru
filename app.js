
import {FB} from "./firebase.js";
import {qrSvg} from "./qr.js";
import {makeXlsx} from "./xlsx.js";
var APP_VERSION="20261126075134";
"use strict";
/* ================= Dados base ================= */
var STATUSES=[
  {k:"ok",label:"Operacional"},
  {k:"empty",label:"Vazio"},
  {k:"clean",label:"Em limpeza"},
  {k:"maint",label:"Manutenção"},
  {k:"alert",label:"Alerta"}
];
var STL={};STATUSES.forEach(function(s){STL[s.k]=s.label});
var TABS=[
  {k:"mapa",label:"Mapa",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'},
  {k:"lt",label:"Limpezas e Tratamentos",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>'},
  ,{k:"transf",label:"Transferências",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>'}
  ,{k:"posturas",label:"Posturas",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><ellipse cx="8.5" cy="14" rx="4.5" ry="5.5"/><ellipse cx="16.5" cy="8.5" rx="3.5" ry="4.5"/><ellipse cx="17" cy="18.5" rx="2.5" ry="3"/></svg>'}
  ,{k:"racoes",label:"Rações",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1.2 12.2A2 2 0 0 1 14.8 21H9.2a2 2 0 0 1-2-1.8L6 7z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M9.5 12h5"/></svg>'}
  ,{k:"fichas",label:"Fichas",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>'}
];
var LT_HASH="limpezas-tratamentos";
var histOpenFor=null,treatHistOpen=false; /* histórico do tanque fechado por defeito; fica aberto só enquanto se mexe nesse tanque */
/* O Mapa é o separador principal: no telemóvel fica ao centro da barra; no PC em primeiro e em destaque. */
/* Telemóvel: 4 atalhos + Mapa ao centro; os separadores menos usados ficam em "Mais" */
var TABBAR_ORDER=["lt","posturas","mapa","racoes","more"],MORE_TABS=["transf","fichas"];
var MORE_DESC={transf:"Mover peixe entre tanques e saídas",fichas:"Fichas públicas dos tanques e QR codes"};
var MORE_ICON='<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
var MAP_ICON='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/></svg>';
var TAB_SHORT={posturas:"Posturas",lt:"Limpezas",transf:"Transfer.",fichas:"Fichas",racoes:"Rações",mapa:"Mapa"};
function tabFromHash(h){return h==="limpezas"||h==="tratamentos"||h===LT_HASH||h==="lt"?"lt":(h==="racoes"?"racoes":h==="fichas"?"fichas":h==="posturas"?"posturas":(h==="transferencias"||h==="transf"?"transf":(h==="mapa"?"mapa":null)))}
function tabHash(k){return k==="lt"?LT_HASH:(k==="transf"?"transferencias":k)}

/* Layout (quadro 1000x750, segundo o esboço) */
var TANKS=[];
function add(id,label,zone,group,x,y,w,h){TANKS.push({id:id,label:label,zone:zone,group:group,x:x,y:y,w:w,h:h})}
for(var i=0;i<6;i++){
  add("R"+(2*i+2),"R"+(2*i+2),"interior","R",620,70+i*60,150,48);
  add("R"+(2*i+1),"R"+(2*i+1),"interior","R",805,70+i*60,150,48);
}
add("Text1","Text 1","exterior","Text",420,66,140,56);
add("Text2","Text 2","exterior","Text",420,186,140,56);
add("Text3","Text 3","exterior","Text",420,306,140,56);
["PP5","PP4","PP3","PP2","PP1"].forEach(function(id,j){add(id,id,"exterior","PP",20+j*84,478,74,58)});
["PP11","PP10","PP9","PP8","PP7"].forEach(function(id,j){add(id,id,"exterior","PP",20+j*84,552,74,58)});
["P4","P3","P2","P1"].forEach(function(id,j){add(id,id,"exterior","P",478+j*100,478,88,58)});
["P8","P7","P6","P5"].forEach(function(id,j){add(id,id,"exterior","P",478+j*100,552,88,58)});
[11,10,9,8].forEach(function(n,j){add("Text"+n,"Text "+n,"exterior","Text",20+j*104,660,94,62)});
[7,6,5,4].forEach(function(n,j){add("Text"+n,"Text "+n,"exterior","Text",478+j*124,660,112,62)});
var BYID={};TANKS.forEach(function(t){BYID[t.id]=t});
var GROUPS=[{k:"R",t:"Interior · R"},{k:"Text",t:"Exterior · Text"},{k:"P",t:"Exterior · P"},{k:"PP",t:"Exterior · PP"}];
function natural(a,b){return +a.id.replace(/\D/g,"")-+b.id.replace(/\D/g,"")}

/* ================= Estado e sincronização (Firebase) ================= */
var UI_KEY="mwg_ui_v1";
function lsGet(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
var state={tanks:{},products:null,feeds:[],feedMoves:[],transfers:[],fichas:{}};
var ui=Object.assign({tab:"mapa",view:"map",theme:null,cams:{}},lsGet(UI_KEY)||{});
if(!ui.cams)ui.cams={};
function saveUI(){lsSet(UI_KEY,ui)}
function blank(){return{status:"ok",species:"",content:"",notes:"",updatedAt:0,log:[]}}
function tankData(id){if(!state.tanks[id])state.tanks[id]=blank();return state.tanks[id]}
function peek(id){return state.tanks[id]||blank()}
function logTo(td,text){td.log=td.log||[];var e={t:Date.now(),text:text};if(me&&me.name)e.by=me.name;td.log.push(e);if(td.log.length>LIM.log)td.log=td.log.slice(-LIM.log)}
/* Limites na app (o arquivo completo fica na folha Google). */
var LIM={log:150,cleans:30,treatments:60,transfers:400,moves:400};
function newId(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

var me=null,isAdminUser=false,readOnly=false,saveEl=null,syncTimer=null,synced={},dataReady=false,online=navigator.onLine!==false,pendingWrites=0;
function setSave(cls,txt){saveEl=document.getElementById("save");if(!saveEl)return;saveEl.className="savestate "+cls;saveEl.querySelector("span").textContent=txt}
function idleSave(){if(pendingWrites>0)setSave("saving",online?"A guardar…":"Sem ligação — guarda quando voltar a rede");else setSave(online?"saved":"",online?"Sincronizado":"Sem ligação")}
window.addEventListener("online",function(){online=true;idleSave()});window.addEventListener("offline",function(){online=false;idleSave()});
function stable(v){
  if(Array.isArray(v))return"["+v.map(stable).join(",")+"]";
  if(v&&typeof v==="object")return"{"+Object.keys(v).sort().filter(function(k){return v[k]!==undefined}).map(function(k){return JSON.stringify(k)+":"+stable(v[k])}).join(",")+"}";
  return JSON.stringify(v===undefined?null:v);
}
function clean(o){return JSON.parse(JSON.stringify(o))}
function entities(){
  var E={};
  Object.keys(state.tanks).forEach(function(id){E["tanks/"+id]=state.tanks[id]});
  Object.keys(state.fichas||{}).forEach(function(id){E["fichas/"+id]=state.fichas[id]});
  if(state.products)E["meta/products"]={list:state.products};
  (state.feeds||[]).forEach(function(f){E["feeds/"+f.id]=f});
  (state.feedMoves||[]).forEach(function(m){if(!m.id)m.id=newId("m");E["feedMoves/"+m.id]=m});
  (state.transfers||[]).forEach(function(x){if(!x.id)x.id=newId("x");E["transfers/"+x.id]=x});
  return E;
}
function persist(msg,act){
  if(readOnly){toast("Só leitura — não tem permissão para alterar");revertLocal();return}
  if(msg)toast(msg,act);
  setSave("saving","A guardar…");clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,250);
}
function syncNow(){
  syncTimer=null;if(readOnly||!FB.db)return;
  var E=entities(),ops=[];
  Object.keys(E).forEach(function(k){var s=stable(E[k]);if(synced[k]!==s){synced[k]=s;ops.push([k,clean(E[k])])}});
  Object.keys(synced).forEach(function(k){if(!(k in E)){delete synced[k];ops.push([k,null])}});
  if(!ops.length){idleSave();return}
  for(var i=0;i<ops.length;i+=400){
    var batch=FB.writeBatch(FB.db);
    var now=Date.now();
    ops.slice(i,i+400).forEach(function(o){var r=FB.doc(FB.db,o[0]);if(o[1]){o[1]._mod=now;batch.set(r,o[1])}else batch.delete(r)});
    batch.set(FB.doc(FB.db,"meta/sync"),{t:now,by:me?me.name:""});
    pendingWrites++;idleSave();
    batch.commit().then(function(){pendingWrites--;idleSave()}).catch(function(err){pendingWrites--;setSave("err","Erro ao guardar");toast("Não foi possível guardar ("+(err&&err.code||err)+")");});
  }
}
function revertLocal(){
  var s={tanks:{},products:null,feeds:[],feedMoves:[],transfers:[],fichas:{}};
  Object.keys(synced).forEach(function(k){applyTo(s,k,JSON.parse(synced[k]))});
  state=s;sortArrays();scheduleRender(true);
}
function applyTo(s,k,d){
  var i=k.indexOf("/"),coll=k.slice(0,i),id=k.slice(i+1);
  if(coll==="tanks"){if(d)s.tanks[id]=d;else delete s.tanks[id];return}
  if(coll==="fichas"){if(!s.fichas)s.fichas={};if(d)s.fichas[id]=d;else delete s.fichas[id];return}
  if(coll==="meta"){if(id==="products")s.products=d?d.list:null;return}
  var arr=s[coll];if(!arr)return;
  var j=arr.findIndex(function(x){return x.id===id});
  if(d){d.id=id;if(j>=0)arr[j]=d;else arr.push(d)}else if(j>=0)arr.splice(j,1);
}
function sortArrays(){
  state.feeds.sort(function(a,b){return(a.createdAt||0)-(b.createdAt||0)});
  state.feedMoves.sort(function(a,b){return a.t-b.t});
  state.transfers.sort(function(a,b){return a.t-b.t});
}
var renderPending=false;
function isBusy(){var a=document.activeElement;return !!($("tmodal")||$("fmodal")||dirty||(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&a.closest&&a.closest("#view,.panel")))}
function scheduleRender(force){
  if(!dataReady||!$("view"))return;
  if(!force&&isBusy()){renderPending=true;return}
  renderPending=false;renderView();updateNavBadge();updateFeedBadge();
}
setInterval(function(){if(renderPending)scheduleRender()},1500);
var COLLS=["tanks","meta","feeds","fichas"],unsubs=[];
/* Transferências e movimentos de rações: só são carregados quando se abre o separador,
   e só os últimos JANELA_DIAS dias (o histórico completo fica na folha Google). */
var JANELA_DIAS=60,LAZY={transfers:null,feedMoves:null};
function lazyLoaded(c){return LAZY[c]==="ok"}
function ensureColl(c){
  if(LAZY[c]||!FB.db)return;LAZY[c]="loading";
  var desde=Date.now()-JANELA_DIAS*864e5;
  unsubs.push(FB.onSnapshot(FB.query(FB.collection(FB.db,c),FB.where("t",">=",desde)),function(snap){
    var changed=handleSnap(c,snap),first=LAZY[c]!=="ok";LAZY[c]="ok";
    if(first||changed){if(ui.tab===(c==="transfers"?"transf":"racoes"))scheduleRender(first);}
  },snapErr));
}
function startData(){
  if(unsubs.length)return;
  var loaded={};
  COLLS.forEach(function(c){
    unsubs.push(FB.onSnapshot(FB.collection(FB.db,c),function(snap){
      var changed=handleSnap(c,snap);
      loaded[c]=1;
      if(!dataReady&&COLLS.every(function(x){return loaded[x]})){dataReady=true;render();checkSeed()}
      else if(changed)scheduleRender();
    },snapErr));
  });
}
function handleSnap(c,snap){
  var changed=false;
  snap.docChanges().forEach(function(ch){
    var k=c+"/"+ch.doc.id;
    if(k==="meta/sync")return;
    if(ch.type==="removed"){if(k in synced){delete synced[k];applyTo(state,k,null);changed=true}}
    else{var d=ch.doc.data(),s=stable(d);if(synced[k]!==s){synced[k]=s;applyTo(state,k,JSON.parse(s));changed=true}}
  });
  if(changed)sortArrays();
  return changed;
}
function snapErr(err){
  if(err&&err.code==="permission-denied")showAuthMsg("Sem permissão para ver os dados. Peça ao administrador para aprovar o seu acesso.");
  else toast("Erro de ligação: "+(err&&err.code||err));
}
function stopData(){unsubs.forEach(function(u){try{u()}catch(e){}});unsubs=[];LAZY={transfers:null,feedMoves:null};photos={};photosOn=false;dTodayOn=false;dToday=null;dFoods=null;synced={};dataReady=false;state={tanks:{},products:null,feeds:[],feedMoves:[],transfers:[],fichas:{}}}

/* ================= Utilitários ================= */
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function fmt(t){if(!t)return"—";return new Date(t).toLocaleString("pt-PT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function fmtShort(t){return new Date(t).toLocaleString("pt-PT",{weekday:"short",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}
function hhmm(t){return new Date(t).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"})}
function fmtDur(ms){ms=Math.abs(ms);var sec=Math.floor(ms/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),x=sec%60;function p(n){return(n<10?"0":"")+n}return h?h+":"+p(m)+":"+p(x):p(m)+":"+p(x)}
var toastT;
function toast(m,act){
  var el=document.getElementById("toast");if(!el)return;
  el.innerHTML=esc(m)+(act?'<button class="tact">'+esc(act.label)+'</button>':'');
  el.classList.toggle("has-act",!!act);
  if(act)el.querySelector(".tact").onclick=function(){el.classList.remove("show");act.fn()};
  el.classList.add("show");clearTimeout(toastT);toastT=setTimeout(function(){el.classList.remove("show","has-act")},act?3200:1800);
}
function applyTheme(){var th=ui.theme||((window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light");document.documentElement.setAttribute("data-theme",th)}
function isMobile(){return window.matchMedia&&matchMedia("(max-width:900px)").matches}
function $(id){return document.getElementById(id)}

/* ================= Limpeza semanal ================= */
function weekStart(t){var d=new Date(t);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d.getTime()}
function weekEnd(t){var d=new Date(weekStart(t));d.setDate(d.getDate()+7);return d.getTime()}
var curWeek=weekStart(Date.now());
function lastClean(id){var c=peek(id).cleans||[];return c.length?c[c.length-1]:0}
function cleanedThisWeek(id){return lastClean(id)>=weekStart(Date.now())}
function weekLabel(){var a=new Date(weekStart(Date.now())),b=new Date(weekEnd(Date.now())-1);function f(d){return d.toLocaleDateString("pt-PT",{day:"numeric",month:"short"})}return f(a)+" – "+f(b)}
function timeLeft(){var ms=weekEnd(Date.now())-Date.now(),d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5);return d>0?(d+(d===1?" dia":" dias")+" e "+h+" h"):(h>0?h+" h":Math.max(1,Math.ceil(ms/6e4))+" min")}
function setCleaned(id,on,silent,when){
  var td=tankData(id),now=Date.now(),ws=weekStart(now);td.cleans=td.cleans||[];
  var t=on?Math.min(when||now,now):0,past=on&&now-t>5*60000;
  if(on){td.cleans.push(t);td.cleans.sort(function(a,b){return a-b});logTo(td,"Limpeza registada"+(past?" · feita em "+fmt(t):""))}
  else{td.cleans=td.cleans.filter(function(c){return c<ws});logTo(td,"Limpeza desta semana anulada")}
  if(td.cleans.length>LIM.cleans)td.cleans=td.cleans.slice(-LIM.cleans);
  td.updatedAt=now;
  var after=function(){if(ui.tab==="lt")viewClean();else{refreshTank(id);if(selected===id)renderPanel()}};
  var undo=on?function(){var d=tankData(id),i=(d.cleans||[]).lastIndexOf(t);if(i>=0)d.cleans.splice(i,1);logTo(d,"Limpeza anulada");d.updatedAt=Date.now();persist(null);after()}
             :function(){setCleaned(id,true,true);persist(null);after()};
  if(!silent)persist(BYID[id].label+(on?(past?" — limpeza de "+fmt(t)+" registada"+(t<ws?" (semana anterior)":""):" limpo ✓"):" — limpeza anulada"),{label:"Anular",fn:undo});
}

/* ================= Tratamentos ================= */
var DEFAULT_PRODUCTS=[{name:"Peróxido (H₂O₂)",water:0},{name:"Formol",water:60},{name:"Iodo",water:0},{name:"Praziquantel",water:0},{name:"Cobre",water:0}];
function products(){if(!state.products)state.products=DEFAULT_PRODUCTS.slice();return state.products}
function isDefaultProduct(n){return DEFAULT_PRODUCTS.some(function(p){return p.name===n})}
function activeTreat(id){var t=peek(id).treat;return t&&!t.endedAt?t:null}
function isLate(t){return t&&t.waterUntil&&!t.waterOnAt&&t.waterUntil<=Date.now()}
function activeList(){return TANKS.filter(function(t){return activeTreat(t.id)}).map(function(t){return{id:t.id,t:activeTreat(t.id)}}).sort(function(a,b){return a.t.waterUntil-b.t.waterUntil})}
function gcalLink(ids,t){
  function z(d){return new Date(d).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")}
  var names=ids.map(function(i){return BYID[i].label}).join(", ");
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent("Ligar a água — "+names+" ("+t.product+")")+"&dates="+z(t.waterUntil)+"/"+z(t.waterUntil+5*60000)+"&details="+encodeURIComponent("MyWorkGuru: tratamento com "+t.product+" iniciado às "+hhmm(t.start)+".");
}
function startTreatment(ids,f){
  var now=Date.now(),mins=Math.max(0,Math.min(1440,parseInt(f.water,10)||0));
  var start=f.start&&f.start<now?f.start:now,past=now-start>5*60000,quando=past?" · feito em "+fmt(start):"";
  var done=mins&&start+mins*60000<=now; // tempo de paragem já passou: regista como concluído, sem temporizador
  ids.forEach(function(id){
    var td=tankData(id);td.treatments=td.treatments||[];
    var t={product:f.product,dose:(f.dose||"").trim(),notes:(f.notes||"").trim(),start:start,waterMin:mins,waterUntil:mins?start+mins*60000:0,waterOnAt:0,endedAt:0};
    if(mins&&!done){td.treat=t;logTo(td,"Tratamento iniciado: "+t.product+(t.dose?" ("+t.dose+")":"")+" · água desligada "+mins+" min"+quando)}
    else{if(mins){t.waterOnAt=t.waterUntil;t.endedAt=t.waterUntil}else t.endedAt=start;
      td.treatments.push(t);td.treatments.sort(function(a,b){return a.start-b.start});
      logTo(td,"Tratamento registado: "+t.product+(t.dose?" ("+t.dose+")":"")+(mins?" · água desligada "+mins+" min":"")+quando)}
    if(td.treatments.length>LIM.treatments)td.treatments=td.treatments.slice(-LIM.treatments);
    td.updatedAt=now;
  });
  if(f.other&&f.product&&!products().some(function(p){return p.name.toLowerCase()===f.product.toLowerCase()}))products().push({name:f.product,water:mins});
  var who=ids.length===1?BYID[ids[0]].label:ids.length+" tanques";
  persist(who+": "+f.product+(mins&&!done?" · temporizador "+mins+" min":" registado"+(past?" ("+fmt(start)+")":"")));
  if(mins&&!done)askNotify();
}
function waterOn(id,silent){
  var td=tankData(id),t=td.treat;if(!t)return;var now=Date.now();
  t.waterOnAt=now;t.endedAt=now;td.treatments=td.treatments||[];td.treatments.push(t);td.treat=null;
  var late=now-t.waterUntil;
  logTo(td,"Água ligada · fim do tratamento com "+t.product+(late>60000?" ("+Math.round(late/60000)+" min depois do previsto)":""));
  td.updatedAt=now;delete alerted[id];delete snooze[id];
  if(!silent)persist(BYID[id].label+": água ligada");
}
function cancelTreatment(id){
  var td=tankData(id);if(!td.treat)return;logTo(td,"Tratamento cancelado: "+td.treat.product);td.treat=null;td.updatedAt=Date.now();
  delete alerted[id];persist(BYID[id].label+": tratamento cancelado");
}
/* alertas */
var alerted={},snooze={},audioCtx=null,beepTimer=null;
function unlockAudio(){try{if(!audioCtx){var AC=window.AudioContext||window.webkitAudioContext;if(AC)audioCtx=new AC()}if(audioCtx&&audioCtx.state==="suspended")audioCtx.resume()}catch(e){}}
document.addEventListener("pointerdown",unlockAudio,{passive:true});
function beep(){
  try{unlockAudio();if(audioCtx){var t0=audioCtx.currentTime;[0,.35,.7].forEach(function(o){var g=audioCtx.createGain(),osc=audioCtx.createOscillator();osc.type="square";osc.frequency.value=880;g.gain.setValueAtTime(.0001,t0+o);g.gain.exponentialRampToValueAtTime(.25,t0+o+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+o+.25);osc.connect(g);g.connect(audioCtx.destination);osc.start(t0+o);osc.stop(t0+o+.3)})}}catch(e){}
  try{navigator.vibrate&&navigator.vibrate([300,150,300,150,600])}catch(e){}
}
function askNotify(){try{if(window.Notification&&Notification.permission==="default")Notification.requestPermission().catch(function(){})}catch(e){}}
function sysNotify(ids){try{if(window.Notification&&Notification.permission==="granted")new Notification("Ligar a água",{body:ids.map(function(i){return BYID[i].label}).join(", ")+": acabou o tempo de paragem.",tag:"mwg-water",requireInteraction:true})}catch(e){}}
function lateDue(){var now=Date.now();return activeList().filter(function(x){return isLate(x.t)&&!(snooze[x.id]>now)})}
function showAlert(){
  var L=lateDue();var ov=$("alertov");
  if(!L.length){if(ov){ov.remove();clearInterval(beepTimer)}return}
  var isNew=!ov;
  if(!ov){ov=document.createElement("div");ov.id="alertov";ov.className="alertov";document.body.appendChild(ov)}
  ov.innerHTML='<div class="alertbox" role="alertdialog" aria-live="assertive"><h3>⏰ Ligar a água</h3>'+
    L.map(function(x){return '<p style="margin:0 0 10px"><b>'+esc(BYID[x.id].label)+'</b> — '+esc(x.t.product)+' · desde as '+hhmm(x.t.start)+' ('+x.t.waterMin+' min)</p>'}).join("")+
    '<div class="row" style="margin-top:14px"><button class="btn green" id="al-on" style="flex:1">'+(L.length>1?'Água ligada em todos':'Água ligada')+'</button><button class="btn ghost" id="al-snz">+5 min</button></div></div>';
  $("al-on").onclick=function(){L.forEach(function(x){waterOn(x.id,true)});persist(L.length>1?"Água ligada em "+L.length+" tanques":BYID[L[0].id].label+": água ligada");ov.remove();clearInterval(beepTimer);refreshAll()};
  $("al-snz").onclick=function(){var u=Date.now()+5*60000;L.forEach(function(x){snooze[x.id]=u});ov.remove();clearInterval(beepTimer)};
  if(isNew){beep();sysNotify(L.map(function(x){return x.id}));clearInterval(beepTimer);beepTimer=setInterval(function(){if($("alertov"))beep();else clearInterval(beepTimer)},20000)}
}
function tick(){
  var now=Date.now(),need=false;
  activeList().forEach(function(x){
    var t=x.t,left=t.waterUntil-now,late=left<=0;
    document.querySelectorAll('[data-cd="'+x.id+'"]').forEach(function(el){el.textContent=late?(el.dataset.long?"Atrasado "+fmtDur(left):"Ligar!"):fmtDur(left)});
    document.querySelectorAll('[data-lt="'+x.id+'"]').forEach(function(el){if(el.classList.contains("late")!==late){el.classList.toggle("late",late);if(el.dataset.rr)need=true}});
    if(late&&!alerted[x.id]&&!(snooze[x.id]>now)){alerted[x.id]=1;need=true;setTimeout(showAlert,0)}
    if(late&&snooze[x.id]&&snooze[x.id]<=now){delete snooze[x.id];setTimeout(showAlert,0)}
  });
  updateNavBadge();
  if(need&&ui.tab==="lt")renderActive();
}
function updateNavBadge(){
  var L=activeList(),late=L.some(function(x){return isLate(x.t)});
  document.querySelectorAll(".nbadge[data-nb]").forEach(function(b){b.textContent=L.length;b.style.display=L.length?"":"none";b.classList.toggle("late",late)});
}
/* ---- Desova / posturas: tankData.spawn = {since, note, by} enquanto há ovos; histórico em tankData.spawns ---- */
var EGG_ICON='<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="8" cy="14" rx="5" ry="6"/><ellipse cx="17" cy="9" rx="4" ry="5" opacity=".85"/><ellipse cx="17.5" cy="19" rx="3" ry="3.5" opacity=".7"/></svg>';
function spawnOf(id){var d=peek(id);return d.spawn&&d.spawn.since?d.spawn:null}
function spawnDays(sp){return Math.max(0,Math.floor((Date.now()-sp.since)/864e5))}
function spawnBadge(id){var sp=spawnOf(id);if(!sp)return"";var n=spawnDays(sp);return '<span class="sbadge" title="Desova / posturas desde '+fmt(sp.since)+(sp.note?' — '+esc(sp.note):'')+'">'+EGG_ICON+(n?'<span>'+n+'d</span>':'')+'</span>'}
function spawnCount(){return TANKS.filter(function(t){return spawnOf(t.id)}).length}
function startSpawn(id,when,note){var td=tankData(id);td.spawn={since:when,note:note||"",by:me?me.name:""};td.updatedAt=Date.now();logTo(td,"Desova / posturas assinaladas"+(note?": "+note:"")+(Math.abs(Date.now()-when)>36e5?" (desde "+fmt(when)+")":""));persist(BYID[id].label+": desova assinalada");refreshTank(id);renderPanel();updatePostBadge();if(ui.tab==="posturas")viewPosturas()}
function endSpawn(id){var td=tankData(id),sp=td.spawn;if(!sp)return;td.spawns=(td.spawns||[]).concat([{start:sp.since,end:Date.now(),note:sp.note||""}]).slice(-30);delete td.spawn;td.updatedAt=Date.now();
  logTo(td,"Desova terminada ("+(spawnDays(sp)+1)+(spawnDays(sp)?" dias":" dia")+")");persist(BYID[id].label+": desova terminada",{label:"Anular",fn:function(){var t2=tankData(id);t2.spawn=sp;t2.spawns=(t2.spawns||[]).slice(0,-1);persist(null);refreshTank(id);renderPanel();if(ui.tab==="posturas")viewPosturas()}});refreshTank(id);renderPanel();updatePostBadge();if(ui.tab==="posturas")viewPosturas()}
function badgeHTML(id){var t=activeTreat(id);if(!t)return"";var late=isLate(t);return '<span class="tbadge'+(late?' late':'')+'" data-lt="'+id+'" title="'+esc(t.product)+' — água desligada"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M4 4l16 16"/></svg><span data-cd="'+id+'">'+(late?"Ligar!":fmtDur(t.waterUntil-Date.now()))+'</span></span>'}

/* ================= Shell ================= */
var root=$("root");
function render(){
  root.innerHTML='<div class="app">'+
   '<header class="top"><div class="brand"><img class="logo-mark" src="logo-mark.svg" alt="" width="34" height="34">MyWorkGuru</div>'+
    '<nav class="sections">'+TABS.map(function(t){return (t.k==="lt"?'<span class="nav-sep"></span>':'')+'<button data-tab="'+t.k+'"'+(t.k==="mapa"?' class="nav-main"':'')+'>'+(t.k==="mapa"?MAP_ICON:'')+t.label+(t.k==="lt"?'<span class="nbadge" data-nb style="display:none"></span>':'')+(t.k==="racoes"?'<span class="nbadge low" data-nf style="display:none"></span>':'')+(t.k==="posturas"?'<span class="nbadge spawnb" data-ns style="display:none"></span>':'')+'</button>'}).join("")+'</nav>'+
    '<div class="spacer"></div><div class="savestate" id="save"><i></i><span>A ligar…</span></div>'+
    '<button class="userbtn" id="userBtn" title="Conta"><span class="uav">'+esc(((me&&me.name)||"?").trim().charAt(0).toUpperCase())+'</span><span class="unm">'+esc((me&&me.name)||"")+(readOnly?' · só leitura':'')+'</span><span class="nbadge low" data-nt style="display:none"></span></button>'+
    '<button class="iconbtn" id="themeBtn" title="Tema claro/escuro"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button></header>'+
   '<main id="view"></main>'+
   '<nav class="tabbar">'+tabbarHTML()+'</nav>'+
  '</div><div class="toast" id="toast"></div>';
  idleSave();updateTeamBadge();
  $("userBtn").onclick=openAccount;
  $("themeBtn").onclick=function(){ui.theme=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";saveUI();applyTheme()};
  document.querySelectorAll("nav.sections [data-tab]").forEach(function(b){b.onclick=function(){setTab(b.dataset.tab)}});bindTabbar();
  renderView();updateNavBadge();updateFeedBadge();
}
function tabBtn(t){return t.k==="mapa"?'<button data-tab="mapa" class="tb-main" aria-label="Mapa"><span class="tb-ring">'+MAP_ICON+'</span><span class="tl">Mapa</span></button>':'<button data-tab="'+t.k+'">'+t.icon+'<span class="tl">'+(TAB_SHORT[t.k]||t.label)+'</span>'+(t.k==="lt"?'<span class="nbadge" data-nb style="display:none"></span>':'')+(t.k==="racoes"?'<span class="nbadge low" data-nf style="display:none"></span>':'')+(t.k==="posturas"?'<span class="nbadge spawnb" data-ns style="display:none"></span>':'')+'</button>'}
/* Barra do telemóvel: cinco lugares iguais, Mapa em destaque ao centro */
function tabbarHTML(){return TABBAR_ORDER.map(function(k){
  if(k==="more")return '<button data-more class="tb-more'+(MORE_TABS.indexOf(ui.tab)>=0?' on':'')+'" aria-label="Mais separadores">'+(MORE_TABS.indexOf(ui.tab)>=0?TABS.filter(function(t){return t.k===ui.tab})[0].icon:MORE_ICON)+'<span class="tl">'+(MORE_TABS.indexOf(ui.tab)>=0?(TAB_SHORT[ui.tab]||ui.tab):'Mais')+'</span></button>';
  return tabBtn(TABS.filter(function(t){return t.k===k})[0])}).join("")}
function bindTabbar(){document.querySelectorAll("nav.tabbar [data-tab]").forEach(function(b){b.onclick=function(){setTab(b.dataset.tab)}});var mb=document.querySelector("nav.tabbar [data-more]");if(mb)mb.onclick=openMore}
function openMore(){
  var m=$("moremenu");if(m){m.remove();return}
  m=document.createElement("div");m.id="moremenu";
  m.innerHTML='<div class="mm-back"></div><div class="mm-sheet" role="menu"><div class="mm-grab"></div>'+MORE_TABS.map(function(k){var t=TABS.filter(function(x){return x.k===k})[0];
    return '<button class="mm-item'+(ui.tab===k?' on':'')+'" data-go="'+k+'"><span class="mm-ic">'+t.icon+'</span><span class="mm-tx"><b>'+t.label+'</b><small>'+MORE_DESC[k]+'</small></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>'}).join("")+'</div>';
  document.body.appendChild(m);requestAnimationFrame(function(){m.classList.add("open")});
  function close(){m.classList.remove("open");setTimeout(function(){m.remove()},200)}
  m.querySelector(".mm-back").onclick=close;
  m.querySelectorAll("[data-go]").forEach(function(b){b.onclick=function(){close();setTab(b.dataset.go)}});
}
function setTab(k,keepSel){
  if(k!=="mapa"&&dOpen)closeDiary();
  if(dirty)saveDraft(true);
  ui.tab=k;saveUI();if(!keepSel){selected=null}
  setHash(k==="mapa"?(selected||""):tabHash(k));
  renderView();window.scrollTo(0,0);
}
function setHash(h){try{history.replaceState(null,"",h?"#"+h:location.pathname+location.search)}catch(e){location.hash=h}}
function renderView(){
  var tb=document.querySelector("nav.tabbar");if(tb){tb.innerHTML=tabbarHTML();bindTabbar();updateNavBadge();updateFeedBadge();updatePostBadge()}
  document.querySelectorAll("[data-tab]").forEach(function(b){b.classList.toggle("on",b.dataset.tab===ui.tab)});
  if(ui.tab==="lt")viewLT();else if(ui.tab==="racoes")viewFeed();else if(ui.tab==="transf")viewTransfers();else if(ui.tab==="fichas")viewFichas();else if(ui.tab==="posturas")viewPosturas();else viewMap();
}
function refreshAll(){renderView();updateNavBadge();updatePostBadge()}

/* ================= Quadro (mapa) com pan/zoom ================= */
var cam=null,camKey="";
function boardHTML(){
  return '<div class="board" id="board">'+
    '<div class="zone interior" style="left:595px;top:30px;width:385px;height:410px"><span class="zlabel">Interior</span></div>'+
    '<div class="wall" style="left:786px;top:58px;width:3px;height:362px"></div>'+
    '<div class="area-label" style="left:420px;top:40px">Exterior</div>'+
    '<div class="area-label" style="left:20px;top:455px">PP</div>'+
    '<div class="area-label" style="left:478px;top:455px">P</div>'+
    '<div class="wall" style="left:451px;top:472px;width:3px;height:144px;opacity:.6"></div>'+
    '<div class="wall" style="left:451px;top:648px;width:3px;height:86px;opacity:.6"></div>'+
    TANKS.map(function(t){return tankHTML(t)}).join("")+'</div>';
}
function tankHTML(t){
  var d=peek(t.id),cd=cleanedThisWeek(t.id),cls="tank st-"+d.status+cleanCls(t.id),sub=d.species||"";
  if(activeTreat(t.id))cls+=" treating";if(spawnOf(t.id))cls+=" spawning";if(selected===t.id)cls+=" sel";if(!matches(t))cls+=" dim";
  var aria=t.label+" — "+STL[d.status]+(cd?", limpo esta semana":", por limpar");
  return '<button class="'+cls+'" data-id="'+t.id+'" style="left:'+t.x+'px;top:'+t.y+'px;width:'+t.w+'px;height:'+t.h+'px" aria-label="'+esc(aria)+'"><span class="tdot"></span>'+badgeHTML(t.id)+spawnBadge(t.id)+'<span class="tid">'+esc(t.label)+'</span><span class="tsub'+(sub?'':' none')+'">'+(sub?esc(sub):'sem espécie')+'</span></button>';
}
function mapHTML(){
  return '<div class="mapwrap" id="mapwrap">'+boardHTML()+
   '<div class="maphint">Arraste para mover · roda/pinça para zoom</div>'+
   '<div class="zoomctl"><button id="zin" aria-label="Aproximar">+</button><button id="zout" aria-label="Afastar">−</button><button id="zfit" aria-label="Ajustar" title="Ajustar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div></div>';
}
function applyCam(){var b=$("board");if(b&&cam)b.style.transform="translate("+cam.x+"px,"+cam.y+"px) scale("+cam.s+")"}
function storeCam(){var w=$("mapwrap");if(!w||!cam)return;ui.cams[camKey]={x:cam.x,y:cam.y,s:cam.s,w:w.clientWidth,h:w.clientHeight};saveUI()}
var camSaveT;function storeCamSoon(){clearTimeout(camSaveT);camSaveT=setTimeout(storeCam,400)}
function fit(){
  var w=$("mapwrap");if(!w)return;var W=w.clientWidth,H=w.clientHeight,pad=16,s=Math.min((W-pad*2)/1000,(H-pad*2)/750);
  cam={s:s,x:(W-1000*s)/2,y:(H-750*s)/2};applyCam();storeCamSoon();
}
function zoomAt(f,cx,cy){
  var w=$("mapwrap");if(!w||!cam)return;var r=w.getBoundingClientRect();if(cx==null){cx=r.width/2;cy=r.height/2}
  var ns=Math.max(.25,Math.min(3.5,cam.s*f));f=ns/cam.s;cam.x=cx-(cx-cam.x)*f;cam.y=cy-(cy-cam.y)*f;cam.s=ns;applyCam();storeCamSoon();
}
function setupMap(key,onTap){
  var w=$("mapwrap");camKey=key;
  var sv=ui.cams[key];
  if(sv&&Math.abs(sv.w-w.clientWidth)<2&&Math.abs(sv.h-w.clientHeight)<2){cam={x:sv.x,y:sv.y,s:sv.s};applyCam()}else fit();
  var pts={},start=null,moved=0,pinch=null;
  w.addEventListener("pointerdown",function(e){
    if(e.target.closest(".zoomctl"))return;
    pts[e.pointerId]={x:e.clientX,y:e.clientY};try{w.setPointerCapture(e.pointerId)}catch(_){}
    var ids=Object.keys(pts);
    if(ids.length===1){start={x:e.clientX,y:e.clientY,vx:cam.x,vy:cam.y};moved=0;pinch=null}
    else if(ids.length===2){var a=pts[ids[0]],b=pts[ids[1]];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),s:cam.s};moved=99}
  });
  w.addEventListener("pointermove",function(e){
    if(!pts[e.pointerId])return;pts[e.pointerId]={x:e.clientX,y:e.clientY};
    var ids=Object.keys(pts),r=w.getBoundingClientRect();
    if(ids.length===2&&pinch){var a=pts[ids[0]],b=pts[ids[1]],d=Math.hypot(a.x-b.x,a.y-b.y);zoomAt((pinch.s*d/pinch.d)/cam.s,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top)}
    else if(start){var dx=e.clientX-start.x,dy=e.clientY-start.y;moved=Math.max(moved,Math.abs(dx)+Math.abs(dy));if(moved>6){cam.x=start.vx+dx;cam.y=start.vy+dy;applyCam()}}
  });
  function end(e){
    var wasTap=moved<=6&&Object.keys(pts).length===1;delete pts[e.pointerId];
    if(wasTap&&e.type==="pointerup"){var el=document.elementFromPoint(e.clientX,e.clientY),t=el&&el.closest(".tank");if(t)onTap(t.dataset.id)}
    if(moved>6)storeCamSoon();
    var ids=Object.keys(pts);
    if(ids.length===1){var p=pts[ids[0]];start={x:p.x,y:p.y,vx:cam.x,vy:cam.y};pinch=null}
    if(!ids.length){start=null;pinch=null}
  }
  w.addEventListener("pointerup",end);w.addEventListener("pointercancel",end);
  w.addEventListener("wheel",function(e){e.preventDefault();var r=w.getBoundingClientRect();zoomAt(Math.exp(-e.deltaY*0.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
  w.addEventListener("keydown",function(e){var t=e.target.closest&&e.target.closest(".tank");if(t&&(e.key==="Enter"||e.key===" ")){e.preventDefault();onTap(t.dataset.id)}});
  $("zin").onclick=function(){zoomAt(1.3)};$("zout").onclick=function(){zoomAt(1/1.3)};$("zfit").onclick=fit;
}
function centerOn(id){
  var t=BYID[id],w=$("mapwrap");if(!t||!w||!cam)return;
  var r=w.getBoundingClientRect(),x=(t.x+t.w/2)*cam.s+cam.x,y=(t.y+t.h/2)*cam.s+cam.y;
  if(x<40||x>r.width-40||y<40||y>r.height-40){cam.x+=r.width/2-x;cam.y+=r.height/2-y;applyCam()}
}

/* ================= Separador: MAPA (ver · limpar · tratar) ================= */
var selected=null,filterStatus=null,query="",dirty=false;
function matches(t){
  var d=peek(t.id);if(filterStatus&&d.status!==filterStatus)return false;
  if(query){var q=query.toLowerCase().replace(/\s+/g,""),hay=(t.id+t.label+" "+(d.species||"")+" "+(d.content||"")+" "+(d.notes||"")).toLowerCase().replace(/\s+/g,"");if(hay.indexOf(q)<0)return false}
  return true;
}
function needsClean(id){return peek(id).status!=="empty"}
function cleanTotal(){return TANKS.filter(function(t){return needsClean(t.id)}).length}
function cleanCount(){return TANKS.filter(function(t){return needsClean(t.id)&&cleanedThisWeek(t.id)}).length}
function cleanCls(id){return !needsClean(id)?" cl-na":(cleanedThisWeek(id)?" cl-done":" cl-todo")}
function viewMap(){
  var v=$("view");
  v.innerHTML='<div class="pagehead"><div><h1>Tanques</h1><p>Toque num tanque para ver o estado, marcar a limpeza ou iniciar um tratamento.</p></div></div>'+dBtnHtml()+
   seedBanner()+'<div class="stats" id="stats"></div>'+
   '<div class="toolbar"><label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="Procurar tanque ou espécie" autocomplete="off"></label>'+
   '<div class="seg" id="viewSeg"><button data-v="map">Mapa</button><button data-v="list">Lista</button></div>'+
   '<div class="legend"><span><i style="background:color-mix(in srgb,var(--cdone) 35%,var(--surface))"></i>Limpo esta semana</span><span><i style="background:color-mix(in srgb,var(--ctodo) 40%,var(--surface))"></i>Falta limpar</span><span><i style="background:var(--surface)"></i>Vazio</span><span class="leg-spawn" id="legspawn"'+(spawnCount()?'':' hidden')+'>'+EGG_ICON+'Desova</span><span class="hcount" id="hcount">'+cleanCount()+'/'+cleanTotal()+'</span></div></div>'+
   '<div class="layout" id="layout"><div id="mainview"></div><div id="panelslot"></div></div>';
  var q=$("q");q.value=query;q.addEventListener("input",function(){query=q.value.trim();refreshMapFilters()});
  q.addEventListener("keydown",function(e){if(e.key==="Enter"){var r=TANKS.filter(matches);if(r.length){select(r[0].id);q.blur()}}});
  document.querySelectorAll("#viewSeg button").forEach(function(b){b.onclick=function(){ui.view=b.dataset.v;saveUI();renderMapMain()}});
  renderStats();renderMapMain();renderPanel();bindSeed();bindDBtn();ensureDToday();
}
function onTankTap(id){select(id)}
function renderStats(){
  var c={};STATUSES.forEach(function(s){c[s.k]=0});TANKS.forEach(function(t){c[peek(t.id).status]++});
  var el=$("stats");if(!el)return;
  el.innerHTML='<button class="stat'+(filterStatus?'':' on')+'" data-s=""><b>'+TANKS.length+'</b>Todos</button>'+
   STATUSES.map(function(s){return '<button class="stat st-'+s.k+(filterStatus===s.k?' on':'')+'" data-s="'+s.k+'"><span class="dot" style="background:var(--st)"></span><b>'+c[s.k]+'</b>'+s.label+'</button>'}).join("");
  el.querySelectorAll(".stat").forEach(function(b){b.onclick=function(){filterStatus=b.dataset.s||null;renderStats();refreshMapFilters()}});
}
function refreshMapFilters(){if(ui.view==="map")document.querySelectorAll(".tank").forEach(function(el){el.classList.toggle("dim",!matches(BYID[el.dataset.id]))});else renderMapList()}
function renderMapMain(){
  document.querySelectorAll("#viewSeg button").forEach(function(b){b.classList.toggle("on",b.dataset.v===ui.view)});
  if(ui.view==="map"){$("mainview").innerHTML=mapHTML();setupMap("status",onTankTap)}else renderMapList();
}
function renderMapList(){
  var html="";
  GROUPS.forEach(function(g){
    var list=TANKS.filter(function(t){return t.group===g.k}).filter(matches).sort(natural);if(!list.length)return;
    html+='<div class="group"><h3>'+g.t+'<span>'+list.length+'</span></h3><div class="cards">'+list.map(function(t){
      var d=peek(t.id),cd=cleanedThisWeek(t.id),cls="card st-"+d.status+cleanCls(t.id)+(selected===t.id?" sel":"");
      return '<div class="'+cls+'" style="padding-right:12px" data-id="'+t.id+'" role="button" tabindex="0"><div class="tid"><span class="cdot" title="'+STL[d.status]+'"></span>'+esc(t.label)+'</div><div class="tsub'+(d.species?'':' none')+'">'+(d.species?esc(d.species):'sem espécie')+'</div>'+(d.status!=="ok"?'<div class="tst">'+STL[d.status]+'</div>':'')+badgeHTML(t.id)+spawnBadge(t.id)+'</div>'}).join("")+'</div></div>';
  });
  var mv=$("mainview");mv.innerHTML=html||'<p class="empty">Nenhum tanque corresponde ao filtro.</p>';
  mv.querySelectorAll(".card").forEach(function(c){c.onclick=function(){select(c.dataset.id)};c.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();select(c.dataset.id)}}});
}
function refreshTank(id){
  if(ui.tab!=="mapa")return;
  if(ui.view==="map")replaceTank(id);else renderMapList();
  renderStats();
  var hc=$("hcount");if(hc)hc.textContent=cleanCount()+"/"+cleanTotal();
  var ls=$("legspawn");if(ls)ls.hidden=!spawnCount();updatePostBadge();
}
function updateTankEl(id){refreshTank(id)}
function replaceTank(id){var el=document.querySelector('.tank[data-id="'+id+'"]');if(el){var tmp=document.createElement("div");tmp.innerHTML=tankHTML(BYID[id]);el.replaceWith(tmp.firstChild)}}
function toggleClean(id){var on=!cleanedThisWeek(id);setCleaned(id,on);refreshTank(id)}
/* painel (modo ver) */
function select(id){
  if(ui.tab!=="mapa"){selected=id;setTab("mapa",true);setHash(id);return}
  if(dirty&&selected&&selected!==id)saveDraft(true);
  selected=id;dirty=false;setHash(id);
  document.querySelectorAll(".tank,.card").forEach(function(el){el.classList.toggle("sel",el.dataset.id===id)});
  renderPanel();if(ui.view==="map")centerOn(id);
}
function closePanel(){
  if(dirty)saveDraft(true);selected=null;dirty=false;setHash("");
  document.querySelectorAll(".sel").forEach(function(el){el.classList.remove("sel")});renderPanel();
}
function speciesList(){var m={};Object.keys(state.tanks).forEach(function(k){var v=state.tanks[k].species;if(v)m[v]=1});return Object.keys(m).sort(function(a,b){return a.localeCompare(b,"pt")})}
function renderPanel(){
  var slot=$("panelslot"),layout=$("layout");if(!slot)return;
  if(!selected||!BYID[selected]){slot.innerHTML="";var was=layout.classList.contains("withpanel");layout.classList.remove("withpanel");if(was&&ui.view==="map"&&!isMobile())setTimeout(fit,0);return}
  var wasOpen=layout.classList.contains("withpanel");layout.classList.add("withpanel");
  var id=selected,t=BYID[id],d=peek(id),log=(d.log||[]).slice().reverse();
  var cd=cleanedThisWeek(id),lc=lastClean(id),at=activeTreat(id),lastT=(d.treatments||[]).slice(-1)[0];
  var cleanBox=!needsClean(id)?'':'<span class="lbl">Limpeza semanal</span><div class="cleanbox '+(cd?'done':'todo')+'"><div class="ct">'+(cd?'✓ Limpo esta semana':'Falta limpar esta semana')+'</div>'+
     '<div class="cm">'+(lc?'Última limpeza: '+fmt(lc):'Ainda sem limpezas registadas')+'</div>'+
     (cd?'<button class="btn ghost" id="cl-undo">Anular limpeza desta semana</button>':'<button class="btn green" id="cl-do">Marcar como limpo</button>')+
     '<div class="cl-past"><button class="linkbtn" id="cl-past-t">'+(cd?'Registar outra limpeza noutro dia':'Foi noutro dia?')+'</button>'+
       '<div id="cl-past-f" class="cl-past-f" hidden><input id="cl-when" type="datetime-local" value="'+localDT(Date.now())+'" max="'+localDT(Date.now()+60000)+'"><button class="btn green sm" id="cl-past-ok">Registar</button>'+
       '<div class="cm" id="cl-past-h" style="margin:6px 0 0"></div></div></div>'+
     '</div>';
  var treatBox='<span class="lbl">Tratamento</span>';
  if(at){var late=isLate(at);
    treatBox+='<div class="treatbox'+(late?' late':'')+'" data-lt="'+id+'"><div class="ct">'+esc(at.product)+(at.dose?' · '+esc(at.dose):'')+'</div>'+
      '<div class="cm">Água desligada às '+hhmm(at.start)+' · ligar às <b>'+hhmm(at.waterUntil)+'</b></div>'+
      '<div class="countdown" data-cd="'+id+'" data-long="1">'+(late?'Atrasado '+fmtDur(at.waterUntil-Date.now()):fmtDur(at.waterUntil-Date.now()))+'</div>'+
      '<div class="row" style="flex-wrap:wrap;margin-top:6px"><button class="btn green" id="t-on" style="flex:1">Água ligada</button><button class="btn ghost" id="t-cancel">Cancelar</button></div>'+
      '<a class="linkbtn" href="'+gcalLink([id],at)+'" target="_blank" rel="noopener">Lembrete no Google Calendar</a></div>';
  }else treatBox+='<div style="margin-bottom:18px"><button class="btn purple" id="t-new">+ Novo tratamento</button><div class="meta" style="margin-top:6px">'+(lastT?'Último: '+esc(lastT.product)+' · '+fmt(lastT.start):'Sem tratamentos registados')+'</div></div>';
  var sp=spawnOf(id),lastSp=(d.spawns||[]).slice(-1)[0],spawnBox='';
  if(d.status!=="empty"||sp){
    spawnBox='<span class="lbl">Desova / posturas</span>';
    if(sp)spawnBox+='<div class="spawnbox"><div class="ct">'+EGG_ICON.replace('width="12" height="12"','width="18" height="18"')+' Há posturas / ovos</div><div class="cm">Desde '+fmt(sp.since)+' · '+(spawnDays(sp)?spawnDays(sp)+(spawnDays(sp)===1?' dia':' dias'):'hoje')+(sp.by?' · por '+esc(sp.by):'')+'</div>'+(sp.note?'<div class="cm" style="color:var(--text)">'+esc(sp.note)+'</div>':'')+
      '<div class="row" style="flex-wrap:wrap"><button class="btn spawn" id="sp-lots" style="flex:1;justify-content:center">Recolhas de ovos e taxas'+((d.eggLots||[]).length?' ('+d.eggLots.length+')':'')+'</button><button class="btn ghost" id="sp-end">Terminou a desova</button></div></div>';
    else spawnBox+='<div style="margin-bottom:18px"><button class="btn spawn" id="sp-new">'+EGG_ICON.replace('width="12" height="12"','width="16" height="16"')+' Assinalar desova</button>'+
      '<div id="sp-form" class="sp-form" hidden><div class="formgrid"><div class="field"><label class="lbl" for="sp-when">Desde</label><input id="sp-when" type="datetime-local" value="'+localDT(Date.now())+'" max="'+localDT(Date.now()+60000)+'"></div>'+
      '<div class="field"><label class="lbl" for="sp-note">Nota (opcional)</label><input id="sp-note" maxlength="80" placeholder="Ex.: ovos flutuantes, ~200 ml"></div></div><div class="row"><button class="btn spawn" id="sp-ok" style="flex:1">Confirmar</button><button class="btn ghost" id="sp-cancel">Cancelar</button></div></div>'+
      ((d.eggLots||[]).length?'<button class="linkbtn" id="sp-lots" style="display:block;margin-top:8px">Ver recolhas de ovos ('+d.eggLots.length+')</button>':'')+
      '<div class="meta" style="margin-top:6px">'+(lastSp?'Última: '+new Date(lastSp.start).toLocaleDateString("pt-PT")+' a '+new Date(lastSp.end).toLocaleDateString("pt-PT"):'Sem desovas registadas')+'</div></div>';
  }
  slot.innerHTML=(isMobile()?'<div class="sheet-backdrop" id="bd"></div>':'')+
  '<aside class="panel"><div class="phead"><div style="flex:1"><h2>'+esc(t.label)+'</h2><span class="badge">'+(t.zone==="interior"?"Interior":"Exterior")+' · grupo '+t.group+'</span></div>'+
   '<button class="iconbtn" id="pclose" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'+
   '<div class="pbody">'+
    '<span class="lbl">Estado</span><div class="statuses">'+STATUSES.map(function(s){return '<button class="sbtn st-'+s.k+(d.status===s.k?' on':'')+'" data-s="'+s.k+'"><i></i>'+s.label+'</button>'}).join("")+'</div>'+
    cleanBox+treatBox+spawnBox+
    '<span class="lbl">Peixe</span><div style="margin-bottom:18px"><div class="row" style="flex-wrap:wrap"><button class="btn ghost" id="x-from-panel">⇄ Transferir peixe</button>'+(t.group==="R"?'<button class="btn ghost" id="fi-from-panel">Ficha do peixe</button>':'')+'</div>'+(function(){var L=(d.log||[]).filter(function(l){return /^Transferência [→←]/.test(l.text)}).slice(-1)[0];return L?'<div class="meta" style="margin-top:6px">Última: '+esc(L.text.replace(/^Transferência /,""))+' · '+fmt(L.t)+'</div>':''})()+'</div>'+
    '<div class="field"><label class="lbl" for="fsp">Espécie</label><input id="fsp" maxlength="40" list="splist" placeholder="Ex.: Robalo, Dourada…" value="'+esc(d.species)+'"><datalist id="splist">'+speciesList().map(function(x){return '<option value="'+esc(x)+'">'}).join("")+'</datalist></div>'+
    '<div class="field"><label class="lbl" for="fc">Lote / conteúdo</label><input id="fc" maxlength="80" placeholder="Ex.: lote 2311" value="'+esc(d.content)+'"></div>'+
    '<div class="field"><label class="lbl" for="fn">Notas</label><textarea id="fn" placeholder="Observações sobre este tanque">'+esc(d.notes)+'</textarea></div>'+
    '<div class="row" style="justify-content:space-between;margin-bottom:20px"><span class="meta">Atualizado: '+fmt(d.updatedAt)+'</span><button class="btn" id="fsave" disabled>Guardar</button></div>'+
    '<details class="histd" id="histd"'+(histOpenFor===id?' open':'')+'><summary><span>Histórico</span><b>'+log.length+'</b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>'+
    '<div class="row"><input id="lognew" style="flex:1;min-width:0;border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:10px 12px;outline:none" placeholder="Adicionar registo…" maxlength="200"><button class="btn ghost" id="logadd">Adicionar</button></div>'+
    (log.length?'<ul class="log">'+log.slice(0,40).map(function(l){return '<li><time>'+fmt(l.t)+(l.by?' · '+esc(l.by):'')+'</time>'+esc(l.text)+'</li>'}).join("")+'</ul>':'<p class="empty" style="margin-top:10px">Sem registos ainda.</p>')+
   '</details></div></aside>';
  if(!wasOpen&&ui.view==="map"&&!isMobile())setTimeout(function(){fit();centerOn(id)},0);
  $("histd").addEventListener("toggle",function(){histOpenFor=this.open?id:null});
  $("pclose").onclick=closePanel;var bd=$("bd");if(bd)bd.onclick=closePanel;
  slot.querySelectorAll(".sbtn").forEach(function(b){b.onclick=function(){
    var td=tankData(id);if(td.status===b.dataset.s)return;captureDraft(td);
    var prev=td.status;td.status=b.dataset.s;td.updatedAt=Date.now();logTo(td,"Estado: "+STL[prev]+" → "+STL[td.status]);
    var auto=false;if(prev==="clean"&&td.status!=="empty"&&!cleanedThisWeek(id)){td.cleans=td.cleans||[];td.cleans.push(Date.now());logTo(td,"Limpeza registada (fim de Em limpeza)");auto=true}
    persist(t.label+": "+STL[td.status]+(auto?" · marcado como limpo":""));refreshTank(id);renderPanel();
  }});
  if($("cl-do"))$("cl-do").onclick=function(){captureDraft(tankData(id));setCleaned(id,true);refreshTank(id);renderPanel()};
  if($("cl-past-t"))$("cl-past-t").onclick=function(){var f=$("cl-past-f");f.hidden=!f.hidden;if(!f.hidden)pastHint()};
  function pastWhen(){var v=$("cl-when").value,d=v?new Date(v):null;return d&&!isNaN(d)?d.getTime():0}
  function pastHint(){var t=pastWhen(),h=$("cl-past-h"),ok=$("cl-past-ok");if(!h)return;
    if(!t){h.textContent="Escolha a data e hora.";ok.disabled=true;return}
    if(t>Date.now()+60000){h.textContent="⚠ A data não pode ser no futuro.";ok.disabled=true;return}
    ok.disabled=false;h.textContent=t>=weekStart(Date.now())?"Conta para a limpeza desta semana.":"É de uma semana anterior: fica no histórico, mas não conta para esta semana."}
  if($("cl-when")){$("cl-when").oninput=pastHint;$("cl-when").onchange=pastHint}
  if($("cl-past-ok"))$("cl-past-ok").onclick=function(){var t=pastWhen();if(!t||t>Date.now()+60000)return;captureDraft(tankData(id));setCleaned(id,true,false,t);refreshTank(id);renderPanel()};
  if($("cl-undo"))$("cl-undo").onclick=function(){captureDraft(tankData(id));setCleaned(id,false);refreshTank(id);renderPanel()};
  if($("t-new"))$("t-new").onclick=function(){captureDraft(tankData(id));openTreatModal([id])};
  if($("sp-new"))$("sp-new").onclick=function(){if(readOnly){toast("Só leitura — não tem permissão para alterar");return}this.hidden=true;$("sp-form").hidden=false};
  if($("sp-cancel"))$("sp-cancel").onclick=function(){$("sp-form").hidden=true;$("sp-new").hidden=false};
  if($("sp-ok"))$("sp-ok").onclick=function(){var v=$("sp-when").value,w=v?new Date(v).getTime():Date.now();if(!(w>0))w=Date.now();if(w>Date.now()+60000){toast("A data não pode ser no futuro");return}captureDraft(tankData(id));startSpawn(id,w,$("sp-note").value.trim())};
  if($("sp-lots"))$("sp-lots").onclick=function(){captureDraft(tankData(id));openEggLots(id)};
  if($("sp-end"))$("sp-end").onclick=function(){if(readOnly){toast("Só leitura — não tem permissão para alterar");return}captureDraft(tankData(id));endSpawn(id)};
  if($("x-from-panel"))$("x-from-panel").onclick=function(){captureDraft(tankData(id));openTransfer(id)};
  if($("fi-from-panel"))$("fi-from-panel").onclick=function(){captureDraft(tankData(id));openFicha(id)};
  if($("t-on"))$("t-on").onclick=function(){captureDraft(tankData(id));waterOn(id);showAlert();refreshTank(id);renderPanel();updateNavBadge()};
  if($("t-cancel"))$("t-cancel").onclick=function(){var b=$("t-cancel");if(!b.dataset.c){b.dataset.c=1;b.textContent="Confirmar cancelar";b.className="btn danger";return}captureDraft(tankData(id));cancelTreatment(id);showAlert();refreshTank(id);renderPanel();updateNavBadge()};
  var fc=$("fc"),fn=$("fn"),fs=$("fsave"),fsp=$("fsp");
  function mark(){dirty=(fsp.value.trim()!==(d.species||""))||(fc.value.trim()!==(d.content||""))||(fn.value!==(d.notes||""));fs.disabled=!dirty}
  fc.oninput=mark;fn.oninput=mark;fsp.oninput=mark;
  fsp.addEventListener("keydown",function(e){if(e.key==="Enter"&&dirty)saveDraft(false)});
  fs.onclick=function(){saveDraft(false)};
  var ln=$("lognew");
  function addLog(){var v=ln.value.trim();if(!v)return;var td=tankData(id);captureDraft(td);logTo(td,v);td.updatedAt=Date.now();persist("Registo adicionado");renderPanel()}
  $("logadd").onclick=addLog;ln.addEventListener("keydown",function(e){if(e.key==="Enter")addLog()});
}
function captureDraft(td){
  if(!dirty)return;var fc=$("fc"),fn=$("fn"),fsp=$("fsp");
  if(fsp)td.species=fsp.value.trim();if(fc)td.content=fc.value.trim();if(fn)td.notes=fn.value;dirty=false;
}
function saveDraft(silent){
  if(!$("fc")||!selected)return;var td=tankData(selected);dirty=true;captureDraft(td);td.updatedAt=Date.now();
  var id=selected;persist(silent?null:"Guardado");refreshTank(id);if(!silent)renderPanel();
}

/* ================= Janela "Novo tratamento" ================= */
var tform=null;
function openTreatModal(ids){unlockAudio();tform={ids:ids,product:"",dose:"",water:0,notes:"",other:false,more:false,start:Date.now()};renderTreatModal()}
function tPast(){return tform.start&&Date.now()-tform.start>5*60000}
function tDone(){var w=+tform.water||0;return w>0&&tform.start+w*60000<=Date.now()}
function closeTreatModal(){tform=null;var m=$("tmodal");if(m)m.remove()}
function hintText(){var w=+tform.water||0;
  if(tform.start>Date.now()+60000)return "⚠ A data e hora não podem ser no futuro.";
  if(tDone())return "O tratamento foi em "+fmt(tform.start)+": como o tempo de paragem ("+w+" min) já passou, fica registado como concluído, sem temporizador.";
  if(w>0)return (tPast()?"Início em "+fmt(tform.start)+". ":"")+"Arranca um temporizador até às "+hhmm(tform.start+w*60000)+" e avisa quando for para voltar a ligar a água.";
  return "Sem paragem de água: o tratamento fica só registado no histórico"+(tPast()?" com a data "+fmt(tform.start):"")+".";}
function canStart(){return !!(tform.product&&tform.ids.length)&&!(tform.start>Date.now()+60000)}
function startLabel(){var w=+tform.water||0,n=tform.ids.length;return(w>0&&!tDone()?"Iniciar e parar água":"Registar tratamento")+(n>1?" ("+n+" tanques)":"")}
function pickerHTML(){
  var f=tform;
  if(!f.more)return '<button class="linkbtn" id="t-more" style="margin:-4px 0 6px">+ Aplicar também a outros tanques</button>';
  return '<span class="lbl">Tanques ('+f.ids.length+')</span>'+GROUPS.map(function(g){var list=TANKS.filter(function(t){return t.group===g.k}).sort(natural);
     return '<div class="pick"><div class="ph">'+g.t+' <button data-all="'+g.k+'">todos</button><button data-none="'+g.k+'">nenhum</button></div><div class="pc">'+
       list.map(function(t){var busy=!!activeTreat(t.id);return '<button class="tp'+(f.ids.indexOf(t.id)>=0?' on':'')+'" data-tp="'+t.id+'"'+(busy?' disabled title="Já em tratamento"':'')+'>'+esc(t.label.replace("Text ","T"))+'</button>'}).join("")+'</div></div>'}).join("");
}
function renderTreatModal(){
  var P=products(),f=tform,w=+f.water||0,m=$("tmodal");
  if(!m){m=document.createElement("div");m.id="tmodal";m.className="tmodal";document.body.appendChild(m)}
  var sc=m.querySelector(".tm-sheet"),st=sc?sc.scrollTop:0;
  m.innerHTML='<div class="tm-back"></div><div class="tm-sheet" role="dialog" aria-label="Novo tratamento"><div class="tm-h"><div><h3>Novo tratamento</h3><div class="meta">'+(f.ids.length?esc(f.ids.map(function(i){return BYID[i].label}).join(", ")):'Nenhum tanque escolhido')+'</div></div><button class="iconbtn" id="tm-x" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'+
   '<span class="lbl">Produto</span><div class="pchips">'+P.map(function(p,i){return '<button class="pchip'+(!f.other&&f.product===p.name?' on':'')+'" data-p="'+i+'">'+esc(p.name)+(p.water?' · '+p.water+'′':'')+'</button>'}).join("")+
     '<button class="pchip'+(f.other?' on':'')+'" id="p-other">+ Outro</button></div>'+
   '<div class="formgrid">'+
     (f.other?'<div class="field full"><label class="lbl" for="t-name">Nome do produto</label><input id="t-name" maxlength="40" placeholder="Ex.: Sal, Cloramina-T…" value="'+esc(f.product||"")+'"></div>':'')+
     '<div class="field full"><label class="lbl" for="t-when">Data e hora do tratamento</label><input id="t-when" type="datetime-local" value="'+localDT(f.start||Date.now())+'" max="'+localDT(Date.now()+60000)+'"></div>'+
     '<div class="field"><label class="lbl" for="t-dose">Dose</label><input id="t-dose" maxlength="40" placeholder="Ex.: 150 ppm" value="'+esc(f.dose||"")+'"></div>'+
     '<div class="field"><label class="lbl" for="t-water">Parar água (min)</label><input id="t-water" type="number" inputmode="numeric" min="0" max="1440" value="'+w+'"></div>'+
     '<div class="field full"><label class="lbl" for="t-notes">Notas</label><input id="t-notes" maxlength="120" placeholder="Opcional" value="'+esc(f.notes||"")+'"></div>'+
   '</div>'+pickerHTML()+'<p class="hint" id="t-hint">'+hintText()+'</p>'+
   '<div class="row"><button class="btn purple" id="t-start" style="flex:1"'+(canStart()?'':' disabled')+'>'+startLabel()+'</button><button class="btn ghost" id="t-x">Cancelar</button></div></div>';
  if(st)m.querySelector(".tm-sheet").scrollTop=st;
  var q=$;
  function readForm(){if(q("t-when")&&q("t-when").value){var dd=new Date(q("t-when").value);if(!isNaN(dd))tform.start=dd.getTime()}if(q("t-dose"))tform.dose=q("t-dose").value;if(q("t-water"))tform.water=q("t-water").value;if(q("t-notes"))tform.notes=q("t-notes").value;if(q("t-name"))tform.product=q("t-name").value.trim()}
  function upd(){readForm();q("t-hint").textContent=hintText();var s=q("t-start");s.textContent=startLabel();s.disabled=!canStart()}
  m.querySelector(".tm-back").onclick=closeTreatModal;q("tm-x").onclick=closeTreatModal;q("t-x").onclick=closeTreatModal;
  m.querySelectorAll(".pchip[data-p]").forEach(function(b){b.onclick=function(){readForm();var p=products()[+b.dataset.p];tform.product=p.name;tform.water=p.water;tform.other=false;renderTreatModal()}});
  q("p-other").onclick=function(){readForm();tform.other=true;tform.product="";tform.water=0;renderTreatModal();setTimeout(function(){q("t-name")&&q("t-name").focus()},0)};
  ["t-dose","t-water","t-notes","t-name","t-when"].forEach(function(x){if(q(x)){q(x).oninput=upd;q(x).onchange=upd}});
  if(q("t-more"))q("t-more").onclick=function(){readForm();tform.more=true;renderTreatModal()};
  m.querySelectorAll("[data-tp]").forEach(function(b){b.onclick=function(){readForm();var id=b.dataset.tp,i=tform.ids.indexOf(id);if(i>=0)tform.ids.splice(i,1);else tform.ids.push(id);renderTreatModal()}});
  m.querySelectorAll("[data-all],[data-none]").forEach(function(b){b.onclick=function(){readForm();var g=b.dataset.all||b.dataset.none;
    TANKS.filter(function(t){return t.group===g}).forEach(function(t){var i=tform.ids.indexOf(t.id);if(b.dataset.all){if(i<0&&!activeTreat(t.id))tform.ids.push(t.id)}else if(i>=0)tform.ids.splice(i,1)});renderTreatModal()}});
  q("t-start").onclick=function(){readForm();if(!canStart())return;var ids=tform.ids.filter(function(i){return !activeTreat(i)});if(!ids.length){closeTreatModal();return}
    startTreatment(ids,tform);closeTreatModal();
    if(ui.tab==="mapa"){ids.forEach(refreshTank);renderPanel()}
    updateNavBadge()};
}

/* ================= Separador: LIMPEZAS E TRATAMENTOS (só informação) ================= */
var hFilter=null;
function viewLT(){
  $("view").innerHTML='<div class="pagehead"><div><h1>Limpezas e Tratamentos</h1><p>Resumo e registos. Para marcar limpezas ou iniciar tratamentos, toque no tanque no Mapa.</p></div></div>'+
    '<div class="fchips jump"><button class="chip" data-jump="sec-clean"><i style="background:var(--cdone)"></i>Limpezas</button><button class="chip" data-jump="sec-treat"><i style="background:var(--treat)"></i>Tratamentos</button></div>'+
    '<div id="sec-active"></div><div id="sec-clean"></div><div id="sec-treat"></div>';
  document.querySelectorAll("[data-jump]").forEach(function(b){b.onclick=function(){var el=$(b.dataset.jump);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})}});
  renderActive();viewClean();viewTreat();
}
function goMap(){setTab("mapa")}
function renderActive(){
  var va=$("sec-active");if(!va)return;var L=activeList();
  var groups={};L.forEach(function(x){var k=x.t.start+"|"+x.t.product;(groups[k]=groups[k]||[]).push(x)});
  if(!L.length){va.innerHTML="";return}
  va.innerHTML='<div class="section-title big" style="color:var(--treat)">Água desligada<span>'+L.length+'</span></div><div class="tgrid">'+Object.keys(groups).map(function(k){
    var arr=groups[k],t=arr[0].t,late=isLate(t),ids=arr.map(function(x){return x.id});
    return '<div class="tcard'+(late?' late':'')+'" data-lt="'+ids[0]+'" data-rr="1"><div class="tc-h"><span class="tc-tank">'+ids.map(function(i){return esc(BYID[i].label)}).join(", ")+'</span></div>'+
      '<div class="tc-prod">'+esc(t.product)+(t.dose?' · '+esc(t.dose):'')+'</div>'+
      '<div class="countdown" data-cd="'+ids[0]+'" data-long="1">'+(late?'Atrasado '+fmtDur(t.waterUntil-Date.now()):fmtDur(t.waterUntil-Date.now()))+'</div>'+
      '<div class="cm">Água desligada às '+hhmm(t.start)+' · ligar às <b>'+hhmm(t.waterUntil)+'</b> ('+t.waterMin+' min)</div>'+(t.notes?'<div class="cm">'+esc(t.notes)+'</div>':'')+
      '<div class="row"><button class="btn green" data-on="'+ids.join(",")+'" style="flex:1">'+(ids.length>1?'Água ligada em todos':'Água ligada')+'</button></div>'+
      '<a class="linkbtn" href="'+gcalLink(ids,t)+'" target="_blank" rel="noopener">Lembrete no Google Calendar</a></div>';
  }).join("")+'</div>';
  va.querySelectorAll("[data-on]").forEach(function(b){b.onclick=function(){var ids=b.dataset.on.split(",");ids.forEach(function(i){waterOn(i,true)});persist(ids.length>1?"Água ligada em "+ids.length+" tanques":BYID[ids[0]].label+": água ligada");showAlert();renderActive();viewTreat();updateNavBadge()}});
}
function viewClean(){
  var v=$("sec-clean");if(!v)return;
  var n=cleanCount(),N=cleanTotal(),pct=N?Math.round(100*n/N):100,empties=TANKS.length-N,miss=[].concat.apply([],GROUPS.map(function(g){return TANKS.filter(function(t){return t.group===g.k&&needsClean(t.id)&&!cleanedThisWeek(t.id)}).sort(natural)})),last=0,lastId=null;
  TANKS.forEach(function(t){var c=lastClean(t.id);if(c>last){last=c;lastId=t.id}});
  v.innerHTML='<div class="section-title big">Limpeza semanal</div>'+
   '<div class="csum"><div class="cs-top"><div class="cs-num"><b>'+n+'</b><span>/'+N+' limpos</span></div><div class="cs-pct">'+pct+'%</div></div>'+
    '<div class="cs-bar"><i style="width:'+pct+'%"></i></div>'+
    '<div class="cs-meta"><span>Semana '+weekLabel()+(empties?' · '+empties+(empties>1?' vazios não contam':' vazio não conta'):'')+'</span><span>Faltam '+timeLeft()+'</span></div></div>'+
   (miss.length?'<div class="cs-miss"><div class="cs-mh">Por limpar <span>'+miss.length+'</span></div><div class="cs-chips">'+
      miss.map(function(t){return '<button class="cs-chip" data-open="'+t.id+'">'+esc(t.label)+'</button>'}).join("")+'</div></div>'
    :'<div class="cs-done">✓ Todos os tanques limpos esta semana</div>')+
   (lastId?'<p class="hint" style="margin-top:10px">Última limpeza: <b>'+esc(BYID[lastId].label)+'</b> · '+fmtShort(last)+'</p>':'');
  v.querySelectorAll("[data-open]").forEach(function(b){b.onclick=function(){select(b.dataset.open)}});
}
function viewTreat(){
  var v=$("sec-treat");if(!v)return;var P=products();
  var hist=[];TANKS.forEach(function(t){(peek(t.id).treatments||[]).forEach(function(x){hist.push({id:t.id,t:x})})});
  hist.sort(function(a,b){return b.t.start-a.t.start});
  var prods={};hist.forEach(function(h){prods[h.t.product]=1});
  var hf=hist.filter(function(h){return !hFilter||h.t.product===hFilter});
  var html='<div class="section-title big">Tratamentos<button class="btn ghost sm" id="go-treat" style="margin-left:auto">Ir para o mapa →</button></div>'+
    '<details class="histd" id="thistd"'+(treatHistOpen?' open':'')+'><summary><span>Histórico de tratamentos</span><b>'+hist.length+'</b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>';
  if(hist.length){
    html+='<div class="fchips"><button class="chip'+(hFilter?'':' on')+'" data-hf="">Todos</button>'+Object.keys(prods).sort().map(function(p){return '<button class="chip'+(hFilter===p?' on':'')+'" data-hf="'+esc(p)+'">'+esc(p)+'</button>'}).join("")+'</div>'+
     '<table class="htable"><thead><tr><th>Data</th><th>Tanque</th><th>Produto</th><th class="hide-m">Água</th></tr></thead><tbody>'+
     hf.slice(0,80).map(function(h){var x=h.t,late=x.waterOnAt&&x.waterUntil?Math.round((x.waterOnAt-x.waterUntil)/60000):0;
       return '<tr><td>'+fmtShort(x.start)+'</td><td class="tk">'+esc(BYID[h.id].label)+'</td><td>'+esc(x.product)+(x.dose?'<div class="sub">'+esc(x.dose)+'</div>':'')+(x.notes?'<div class="sub">'+esc(x.notes)+'</div>':'')+'</td><td class="hide-m">'+(x.waterMin?x.waterMin+' min'+(x.waterOnAt?'<div class="sub">ligada '+hhmm(x.waterOnAt)+(late>1?' (+'+late+' min)':'')+'</div>':''):'—')+'</td></tr>'}).join("")+'</tbody></table>';
  }else html+='<p class="empty">Ainda não há tratamentos registados.</p>';
  html+='</details>';
  html+='<div class="section-title">Produtos</div><p class="hint" style="margin-top:-4px">Minutos de paragem de água propostos por defeito.</p><div class="fchips">'+
    P.map(function(p,i){return '<span class="pchip">'+esc(p.name)+' · <input data-pw="'+i+'" type="number" min="0" max="1440" inputmode="numeric" value="'+(p.water||0)+'" style="width:52px;border:1px solid var(--line);border-radius:7px;padding:2px 4px;background:var(--bg)"> min'+(isDefaultProduct(p.name)?'':'<button class="linkbtn" data-pdel="'+i+'" style="padding:0 0 0 4px;text-decoration:none" title="Remover">×</button>')+'</span>'}).join("")+'</div>';
  v.innerHTML=html;
  $("thistd").addEventListener("toggle",function(){treatHistOpen=this.open});
  $("go-treat").onclick=goMap;
  v.querySelectorAll("[data-hf]").forEach(function(b){b.onclick=function(){hFilter=b.dataset.hf||null;viewTreat()}});
  v.querySelectorAll("[data-pw]").forEach(function(inp){inp.onchange=function(){var p=products()[+inp.dataset.pw];p.water=Math.max(0,Math.min(1440,parseInt(inp.value,10)||0));persist(p.name+": "+p.water+" min por defeito")}});
  v.querySelectorAll("[data-pdel]").forEach(function(b){b.onclick=function(){var P=products(),i=+b.dataset.pdel,nm=P[i].name;P.splice(i,1);persist("Removido: "+nm);viewTreat()}});
  updateNavBadge();
}

/* ================= Separador: RAÇÕES (stock) ================= */
var feedFilter=null,fform=null;
function feeds(){if(!state.feeds)state.feeds=[];return state.feeds}
function feedMoves(){if(!state.feedMoves)state.feedMoves=[];return state.feedMoves}
function feedById(id){return feeds().filter(function(f){return f.id===id})[0]}
function kg(x){return(Math.round((+x||0)*10)/10).toLocaleString("pt-PT",{maximumFractionDigits:1})}
function bagsOf(f,k){return f.bagKg>0?(k/f.bagKg):0}
function isLow(f){return f.minKg>0&&f.stockKg<=f.minKg}
function lowCount(){return feeds().filter(isLow).length}
function updateFeedBadge(){var n=lowCount();document.querySelectorAll(".nbadge[data-nf]").forEach(function(b){b.textContent=n;b.style.display=n?"":"none"})}
function addMove(f,delta,bags,dest,note){
  var mv={t:Date.now(),feedId:f.id,name:f.name,kg:Math.round(delta*10)/10,bags:bags||0,dest:(dest||"").trim(),note:(note||"").trim(),after:Math.round(f.stockKg*10)/10,id:newId("m"),by:me?me.name:""};
  feedMoves().push(mv);if(feedMoves().length>LIM.moves)state.feedMoves=feedMoves().slice(-LIM.moves);return mv;
}
/* ---- Consumo mensal: cada ração guarda use = {"AAAA-MM": kg retirados} (não conta acertos nem entradas) ---- */
var FEED_COLORS=["#0e7c86","#7c4dde","#e08a2c","#2b74d6","#d14d72","#5a9e2f","#b8860b","#6b7a8a"];
var MES=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
var MES_L=["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
var consMonth=null,consSpan=6,useInitTried=false;
function monthKey(t){var d=new Date(t);return d.getFullYear()+"-"+(d.getMonth()<9?"0":"")+(d.getMonth()+1)}
function monthBack(n){var d=new Date();d.setDate(1);d.setMonth(d.getMonth()-n);return monthKey(d.getTime())}
function monthLabel(k,long){var p=k.split("-"),m=+p[1]-1;return long?MES_L[m]+" "+p[0]:MES[m]}
function isConsumption(m){return m.kg<0&&m.note!=="Acerto de contagem"}
function addUse(f,t,kgUsed){if(!f.use)f.use={};var k=monthKey(t);f.use[k]=Math.round(((f.use[k]||0)+kgUsed)*10)/10;if(f.use[k]<=0)delete f.use[k]}
function feedColor(f){var i=feeds().indexOf(f);return FEED_COLORS[(i<0?0:i)%FEED_COLORS.length]}
function dailyRate(f){var u=f.use||{},d=new Date(),dPrev=new Date(d.getFullYear(),d.getMonth(),0).getDate(),days=dPrev+d.getDate();var k=(u[monthBack(1)]||0)+(u[monthBack(0)]||0);return k>0?k/days:0}
/* Uma única vez: calcular o consumo a partir dos movimentos já guardados. */
function backfillUse(){
  if(useInitTried||readOnly||!FB.db)return;var need=feeds().filter(function(f){return !f.useInit});if(!need.length)return;useInitTried=true;
  FB.getDocs(FB.collection(FB.db,"feedMoves")).then(function(snap){
    var acc={};snap.forEach(function(d){var m=d.data();if(!isConsumption(m))return;var k=monthKey(m.t);acc[m.feedId]=acc[m.feedId]||{};acc[m.feedId][k]=(acc[m.feedId][k]||0)-m.kg});
    need.forEach(function(f){var a=acc[f.id]||{};f.use={};Object.keys(a).forEach(function(k){f.use[k]=Math.round(a[k]*10)/10});f.useInit=true});
    persist(null);if(ui.tab==="racoes"&&!isBusy())viewFeed();
  }).catch(function(){useInitTried=false});
}
function consumptionHtml(){
  var F=feeds();if(!F.length)return"";
  var months=[];for(var i=consSpan-1;i>=0;i--)months.push(monthBack(i));
  if(!consMonth||months.indexOf(consMonth)<0)consMonth=months[months.length-1];
  var tot=months.map(function(k){return F.reduce(function(a,f){return a+((f.use||{})[k]||0)},0)});
  var mx=Math.max.apply(null,tot.concat([1]));
  var W=Math.max(300,consSpan*54),H=150,B=20,T=16,bw=Math.min(34,(W/consSpan)*.58);
  var bars=months.map(function(k,i){
    var cx=(i+.5)*W/consSpan,y=H-B,sel=k===consMonth,seg="";
    F.forEach(function(f){var v=(f.use||{})[k]||0;if(!v)return;var h=(H-B-T)*v/mx;y-=h;seg+='<rect x="'+(cx-bw/2).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(h,.5).toFixed(1)+'" fill="'+feedColor(f)+'"'+(sel?'':' opacity=".55"')+'/>'});
    return '<g class="cb" data-cm="'+k+'">'+
      '<rect x="'+(cx-W/consSpan/2).toFixed(1)+'" y="0" width="'+(W/consSpan).toFixed(1)+'" height="'+H+'" fill="'+(sel?'var(--surface2)':'transparent')+'" rx="8"/>'+seg+
      (tot[i]?'<text x="'+cx.toFixed(1)+'" y="'+(y-4).toFixed(1)+'" text-anchor="middle" class="cv'+(sel?' on':'')+'">'+kg(tot[i])+'</text>':'')+
      '<text x="'+cx.toFixed(1)+'" y="'+(H-5)+'" text-anchor="middle" class="cm'+(sel?' on':'')+'">'+monthLabel(k)+'</text></g>';
  }).join("");
  var idx=months.indexOf(consMonth),cur=tot[idx],prev=idx>0?tot[idx-1]:null,isNow=consMonth===monthBack(0);
  var diff=prev?Math.round((cur-prev)/prev*100):null;
  var rows=F.map(function(f){var v=(f.use||{})[consMonth]||0,avg=months.reduce(function(a,k){return a+((f.use||{})[k]||0)},0)/consSpan;return{f:f,v:v,avg:avg}})
    .filter(function(r){return r.v>0||r.avg>0}).sort(function(a,b){return b.v-a.v||b.avg-a.avg});
  var maxRow=Math.max.apply(null,rows.map(function(r){return r.v}).concat([1]));
  var html='<div class="section-title big">Consumo mensal</div><div class="cons">'+
    '<div class="cons-top"><div><div class="cons-kg"><b>'+kg(cur)+'</b> kg</div><div class="cons-sub">gastos em '+monthLabel(consMonth,true)+(isNow?' (até hoje)':'')+
      (isNow&&cur>0?(function(){var d=new Date(),dim=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();return ' · a este ritmo, ≈ '+kg(Math.round(cur/d.getDate()*dim))+' kg no fim do mês'})():'')+
      (!isNow&&diff!=null&&isFinite(diff)?' · <span class="'+(diff>0?'up':'down')+'">'+(diff>0?'▲ +':'▼ ')+diff+'%</span> vs '+monthLabel(months[idx-1]):'')+'</div></div>'+
    '<div class="seg"><button data-span="6" class="'+(consSpan===6?'on':'')+'">6 meses</button><button data-span="12" class="'+(consSpan===12?'on':'')+'">12 meses</button></div></div>'+
    '<div class="cons-body"><div><div class="cons-chart"><svg viewBox="0 0 '+W+' '+H+'" style="min-width:'+(consSpan>6?560:0)+'px" role="img" aria-label="Consumo de ração por mês">'+bars+'</svg></div>'+
    '<p class="hint" style="margin:2px 0 10px">Toque num mês para ver o detalhe.</p></div><div>';
  if(!rows.length)html+='<p class="empty" style="margin:0">Ainda não há consumo registado neste período. O consumo conta cada vez que alguém faz <b>− Retirar</b>.</p>';
  else html+='<table class="ctable"><thead><tr><th>Ração</th><th style="text-align:right">'+monthLabel(consMonth)+'</th><th style="text-align:right" class="hide-s">Sacos</th><th style="text-align:right">Média/mês</th></tr></thead><tbody>'+
    rows.map(function(r){var f=r.f,pct=cur?Math.round(r.v/cur*100):0;
      return '<tr><td><div class="cname"><i style="background:'+feedColor(f)+'"></i>'+esc(f.name)+'</div><div class="cbar"><i style="width:'+(100*r.v/maxRow)+'%;background:'+feedColor(f)+'"></i></div></td>'+
        '<td style="text-align:right"><b>'+kg(r.v)+' kg</b>'+(r.v?'<div class="sub">'+pct+'%</div>':'')+'</td>'+
        '<td style="text-align:right" class="hide-s">'+(f.bagKg>0&&r.v?'≈ '+kg(r.v/f.bagKg):'—')+'</td>'+
        '<td style="text-align:right">'+kg(r.avg)+' kg</td></tr>'}).join("")+
    '</tbody></table><p class="hint" style="margin:8px 0 0">Média dos últimos '+consSpan+' meses. Conta só o que foi retirado (não conta entradas nem acertos de contagem).</p>';
  return html+'</div></div></div>';
}
/* Anular um movimento já registado: repõe o stock e o consumo e apaga o movimento. */
function undoMove(mid){
  var M=feedMoves(),i=-1;M.forEach(function(x,j){if(x.id===mid)i=j});if(i<0)return;
  var m=M[i],f=feedById(m.feedId);
  if(f){f.stockKg=Math.max(0,Math.round((f.stockKg-m.kg)*10)/10);if(isConsumption(m))addUse(f,m.t,m.kg)}
  M.splice(i,1);
  persist("Movimento anulado"+(f?" · "+f.name+" fica "+kg(f.stockKg)+" kg":""),{label:"Repor",fn:function(){var g=feedById(m.feedId);if(g){g.stockKg=Math.round((g.stockKg+m.kg)*10)/10;if(isConsumption(m))addUse(g,m.t,-m.kg)}feedMoves().push(m);sortArrays();persist(null);if(ui.tab==="racoes")viewFeed();updateFeedBadge()}});
  viewFeed();
}
function viewFeed(){
  ensureColl("feedMoves");
  backfillUse();
  var v=$("view"),F=feeds(),total=F.reduce(function(a,f){return a+(+f.stockKg||0)},0),low=F.filter(isLow);
  var html='<div class="pagehead"><div><h1>Stock de rações</h1><p>Retire sacos para abater ao stock; registe entradas quando chegar ração.</p></div><button class="btn" id="f-new">+ Nova ração</button></div>';
  if(!F.length){
    html+='<div class="csum" style="text-align:center;padding:28px"><div style="font-family:var(--display);font-size:18px;font-weight:600;margin-bottom:6px">Ainda não há rações</div><p class="hint" style="margin:0 0 14px">Comece por adicionar cada ração com o tamanho do saco e o stock atual.</p><button class="btn" id="f-new2">+ Adicionar primeira ração</button></div>';
  }else{
    html+='<div class="fsum"><div><b>'+kg(total)+'</b> kg em stock</div><div>'+F.length+(F.length>1?' rações':' ração')+'</div>'+(low.length?'<div class="flow">⚠ '+low.length+' com stock baixo</div>':'')+'</div>';
    html+='<div class="fgrid">'+F.map(function(f){
      var b=bagsOf(f,f.stockKg),lowc=isLow(f),pct=f.minKg>0?Math.min(100,100*f.stockKg/(f.minKg*3)):null;
      return '<div class="fcard'+(lowc?' low':'')+'"><div class="fc-h"><button class="fc-name" data-edit="'+f.id+'">'+esc(f.name)+'</button>'+(lowc?'<span class="fc-low">Stock baixo</span>':'')+'</div>'+
        '<div class="fc-kg"><b>'+kg(f.stockKg)+'</b> kg</div>'+
        '<div class="fc-bags">'+(f.bagKg>0?'≈ '+kg(b)+(Math.abs(b-1)<.05?' saco':' sacos')+' de '+kg(f.bagKg)+' kg':'')+(f.minKg>0?' · mín. '+kg(f.minKg)+' kg':'')+'</div>'+
        (function(){var r=dailyRate(f);if(!(r>0))return'';var d=Math.floor(f.stockKg/r);return '<div class="fc-days'+(d<14?' low':'')+'">'+(d<1?'Acaba hoje ao ritmo atual':'Dá para ≈ '+(d>=60?Math.round(d/30.44)+' meses':d+(d===1?' dia':' dias'))+' ao ritmo atual')+'</div>'})()+
        (pct!=null?'<div class="fc-bar'+(lowc?' low':'')+'"><i style="width:'+pct+'%"></i></div>':'')+
        '<div class="row fc-act"><button class="btn purple" data-take="'+f.id+'" style="flex:1">− Retirar</button><button class="btn ghost" data-in="'+f.id+'">+ Entrada</button></div></div>';
    }).join("")+'</div>';
    html+=consumptionHtml();
    var M=feedMoves().slice().reverse(),names={};M.forEach(function(m){names[m.feedId]=m.name});
    var MF=M.filter(function(m){return !feedFilter||m.feedId===feedFilter});
    html+='<div class="section-title big">Movimentos<span>'+(lazyLoaded("feedMoves")?M.length:'…')+'</span></div><p class="hint" style="margin-top:-6px">Últimos '+JANELA_DIAS+' dias. O histórico completo está na folha Google.</p>';
    if(M.length){
      html+='<div class="fchips"><button class="chip'+(feedFilter?'':' on')+'" data-ff="">Todas</button>'+Object.keys(names).map(function(id){var f=feedById(id);return '<button class="chip'+(feedFilter===id?' on':'')+'" data-ff="'+id+'">'+esc(f?f.name:names[id])+'</button>'}).join("")+'</div>'+
       '<table class="htable"><thead><tr><th>Data</th><th>Ração</th><th style="text-align:right">kg</th><th class="hide-m">Destino / nota</th></tr></thead><tbody>'+
       MF.slice(0,80).map(function(m){var f=feedById(m.feedId);return '<tr><td>'+fmtShort(m.t)+'</td><td>'+esc(f?f.name:m.name)+(m.bags?'<div class="sub">'+kg(m.bags)+(m.bags===1?' saco':' sacos')+'</div>':'')+'<div class="sub show-m">'+esc([m.dest,m.note].filter(Boolean).join(" · "))+'</div></td><td style="text-align:right" class="'+(m.kg<0?'mv-out':'mv-in')+'">'+(m.kg>0?'+':'')+kg(m.kg)+'<div class="sub">fica '+kg(m.after)+'</div><button class="linkbtn mv-del" data-mvdel="'+esc(m.id)+'">anular</button></td><td class="hide-m">'+esc([m.dest,m.note].filter(Boolean).join(" · "))+(m.by?'<div class="sub">por '+esc(m.by)+'</div>':'')+'</td></tr>'}).join("")+'</tbody></table>';
    }else html+='<p class="empty">Ainda não há movimentos.</p>';
  }
  v.innerHTML=html;
  [$("f-new"),$("f-new2")].forEach(function(b){if(b)b.onclick=function(){openFeedEdit(null)}});
  v.querySelectorAll("[data-edit]").forEach(function(b){b.onclick=function(){openFeedEdit(b.dataset.edit)}});
  v.querySelectorAll("[data-take]").forEach(function(b){b.onclick=function(){openFeedMove(b.dataset.take,-1)}});
  v.querySelectorAll("[data-in]").forEach(function(b){b.onclick=function(){openFeedMove(b.dataset.in,1)}});
  v.querySelectorAll("[data-mvdel]").forEach(function(b){b.onclick=function(){
    if(!b.dataset.c){b.dataset.c=1;b.textContent="confirmar?";b.classList.add("on");setTimeout(function(){if(b.isConnected){delete b.dataset.c;b.textContent="anular";b.classList.remove("on")}},4000);return}
    undoMove(b.dataset.mvdel)}});
  v.querySelectorAll("[data-cm]").forEach(function(g){g.onclick=function(){consMonth=g.dataset.cm;viewFeed()}});
  v.querySelectorAll("[data-span]").forEach(function(b){b.onclick=function(){consSpan=+b.dataset.span;consMonth=null;viewFeed()}});
  v.querySelectorAll("[data-ff]").forEach(function(b){b.onclick=function(){feedFilter=b.dataset.ff||null;viewFeed()}});
  updateFeedBadge();
}
/* janela genérica */
function openSheet(title,sub,body,bind){
  var m=$("fmodal");if(!m){m=document.createElement("div");m.id="fmodal";m.className="tmodal";document.body.appendChild(m)}
  m.innerHTML='<div class="tm-back"></div><div class="tm-sheet" role="dialog"><div class="tm-h"><div><h3>'+title+'</h3>'+(sub?'<div class="meta">'+sub+'</div>':'')+'</div><button class="iconbtn" data-x aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'+body+'</div>';
  m.querySelector(".tm-back").onclick=closeSheet;m.querySelectorAll("[data-x]").forEach(function(b){b.onclick=closeSheet});
  bind(m);
}
function closeSheet(){var m=$("fmodal");if(m)m.remove();fichaOpenId=null}
function numVal(id){var el=$(id);if(!el)return 0;var v=parseFloat(String(el.value).replace(",","."));return isFinite(v)?v:0}
/* retirar / entrada */
function openFeedMove(id,dir){
  var f=feedById(id);if(!f)return;var take=dir<0;
  var tankOpts=TANKS.slice().sort(function(a,b){return GROUPS.findIndex(function(g){return g.k===a.group})-GROUPS.findIndex(function(g){return g.k===b.group})||natural(a,b)}).map(function(t){return '<option value="'+esc(t.label)+'">'}).join("");
  var body=
    (f.bagKg>0?'<span class="lbl">Sacos de '+kg(f.bagKg)+' kg</span><div class="stepper"><button data-st="-1" aria-label="Menos">−</button><input id="m-bags" type="number" inputmode="decimal" min="0" step="1" value="1"><button data-st="1" aria-label="Mais">+</button></div>':'')+
    '<div class="field"><label class="lbl" for="m-kg">'+(f.bagKg>0?'Ou indique os kg':'Quantidade (kg)')+'</label><input id="m-kg" type="number" inputmode="decimal" min="0" step="0.1" value="'+(f.bagKg>0?f.bagKg:'')+'"></div>'+
    (take?'<div class="field"><label class="lbl" for="m-dest">Destino (opcional)</label><input id="m-dest" list="m-tanks" maxlength="40" placeholder="Ex.: R7, zona exterior…"><datalist id="m-tanks">'+tankOpts+'</datalist></div>'
         :'<div class="field"><label class="lbl" for="m-note">Nota (opcional)</label><input id="m-note" maxlength="60" placeholder="Ex.: fornecedor, lote, validade…"></div>')+
    '<div class="mprev" id="m-prev"></div>'+
    '<div class="row"><button class="btn '+(take?'purple':'green')+'" id="m-ok" style="flex:1">'+(take?'Retirar do stock':'Adicionar ao stock')+'</button><button class="btn ghost" data-x>Cancelar</button></div>';
  openSheet(take?'Retirar ração':'Entrada de ração',esc(f.name)+' · stock atual '+kg(f.stockKg)+' kg',body,function(m){
    var syncing=false;
    function prev(){var q=numVal("m-kg"),after=f.stockKg+(take?-q:q),p=$("m-prev");
      p.innerHTML=q>0?('<b>'+(take?'−':'+')+kg(q)+' kg</b> → fica <b>'+kg(Math.max(0,after))+' kg</b>'+(take&&after<0?'<div class="warn">Atenção: é mais do que o stock registado ('+kg(f.stockKg)+' kg). O stock fica a 0.</div>':'')+(take&&f.minKg>0&&after<=f.minKg&&after>=0?'<div class="warn">Vai ficar abaixo do mínimo ('+kg(f.minKg)+' kg).</div>':'')):'Indique a quantidade.';
      $("m-ok").disabled=!(q>0)}
    if($("m-bags")){
      $("m-bags").oninput=function(){var b=numVal("m-bags");$("m-kg").value=b>0?Math.round(b*f.bagKg*10)/10:"";prev()};
      m.querySelectorAll("[data-st]").forEach(function(b){b.onclick=function(){var n=Math.max(0,numVal("m-bags")+(+b.dataset.st));$("m-bags").value=n;$("m-bags").oninput()}});
    }
    $("m-kg").oninput=function(){if($("m-bags")){var q=numVal("m-kg");$("m-bags").value=q>0?Math.round(q/f.bagKg*100)/100:0}prev()};
    prev();
    $("m-ok").onclick=function(){var q=numVal("m-kg");if(!(q>0))return;
      var before=f.stockKg,bags=$("m-bags")?numVal("m-bags"):0;
      f.stockKg=Math.max(0,Math.round((f.stockKg+(take?-q:q))*10)/10);
      var mv=addMove(f,take?-q:q,bags,take&&$("m-dest")?$("m-dest").value:"",!take&&$("m-note")?$("m-note").value:"");
      if(take)addUse(f,mv.t,q);
      closeSheet();
      persist((take?"Retirado ":"Entrada ")+kg(q)+" kg · "+f.name+" fica "+kg(f.stockKg)+" kg",{label:"Anular",fn:function(){var g=feedById(f.id);if(g){g.stockKg=Math.round((g.stockKg-(take?-q:q))*10)/10;if(g.stockKg<0)g.stockKg=0;if(take)addUse(g,mv.t,-q)}var M=feedMoves(),i=-1;M.forEach(function(x,j){if(x.id===mv.id)i=j});if(i>=0)M.splice(i,1);persist(null);if(ui.tab==="racoes")viewFeed();updateFeedBadge()}});
      viewFeed();
    };
  });
}
/* criar / editar ração */
function openFeedEdit(id){
  var f=id?feedById(id):null;
  var body='<div class="field"><label class="lbl" for="e-name">Nome da ração</label><input id="e-name" maxlength="50" placeholder="Ex.: Ração 2 mm, Engorda 4.5 mm…" value="'+esc(f?f.name:"")+'"></div>'+
    '<div class="formgrid"><div class="field"><label class="lbl" for="e-bag">Saco (kg)</label><input id="e-bag" type="number" inputmode="decimal" min="0" step="0.5" value="'+(f?f.bagKg:25)+'"></div>'+
    (f?'':'<div class="field"><label class="lbl" for="e-stock">Stock atual (kg)</label><input id="e-stock" type="number" inputmode="decimal" min="0" step="0.1" value="0"></div>')+
    '<div class="field"><label class="lbl" for="e-min">Aviso abaixo de (kg)</label><input id="e-min" type="number" inputmode="decimal" min="0" step="1" value="'+(f?f.minKg||0:0)+'"></div></div>'+
    (f?'<div class="field"><label class="lbl" for="e-fix">Corrigir stock (contagem)</label><input id="e-fix" type="number" inputmode="decimal" min="0" step="0.1" value="'+f.stockKg+'"><div class="meta" style="margin-top:4px">Use só se a contagem real for diferente — fica registado como acerto.</div></div>':'')+
    '<div class="row"><button class="btn" id="e-ok" style="flex:1">'+(f?'Guardar':'Adicionar ração')+'</button>'+(f?'<button class="btn ghost" id="e-del">Apagar</button>':'<button class="btn ghost" data-x>Cancelar</button>')+'</div>';
  openSheet(f?'Editar ração':'Nova ração','',body,function(){
    $("e-ok").onclick=function(){
      var name=$("e-name").value.trim();if(!name){$("e-name").focus();return}
      var bag=Math.max(0,numVal("e-bag")),min=Math.max(0,numVal("e-min"));
      if(f){f.name=name;f.bagKg=bag;f.minKg=min;var fix=Math.max(0,numVal("e-fix"));
        if(Math.abs(fix-f.stockKg)>=0.05){var d=fix-f.stockKg;f.stockKg=Math.round(fix*10)/10;addMove(f,d,0,"","Acerto de contagem")}
        persist(name+" guardada");}
      else{var nf={id:"f"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:name,bagKg:bag,stockKg:Math.round(Math.max(0,numVal("e-stock"))*10)/10,minKg:min,createdAt:Date.now(),use:{},useInit:true};
        feeds().push(nf);if(nf.stockKg>0)addMove(nf,nf.stockKg,0,"","Stock inicial");persist(name+" adicionada")}
      closeSheet();viewFeed();
    };
    if($("e-del"))$("e-del").onclick=function(){var b=$("e-del");if(!b.dataset.c){b.dataset.c=1;b.textContent="Confirmar apagar";b.className="btn danger";return}
      var F=feeds(),i=F.indexOf(f);if(i>=0)F.splice(i,1);persist(f.name+" apagada");closeSheet();viewFeed()};
  });
}

/* ================= Separador: TRANSFERÊNCIAS ================= */
var OUT_REASONS=[
  {k:"banco",label:"Banco alimentar",detail:"Observação (opcional)"},
  {k:"externo",label:"Tanque fora do mapa",detail:"Qual tanque / local"},
  {k:"pessoa",label:"Levado por pessoa",detail:"Nome da pessoa"},
  {k:"outro",label:"Outro destino",detail:"Qual destino"}
];
var OUTL={};OUT_REASONS.forEach(function(r){OUTL[r.k]=r});
var trFilterTank="",trFilterType="",xform=null;
function transfers(){if(!state.transfers)state.transfers=[];return state.transfers}
function tankOptions(sel,withOut,outLabel){
  return (withOut?'<optgroup label="'+outLabel+'">'+withOut+'</optgroup>':'')+GROUPS.map(function(g){return '<optgroup label="'+g.t+'">'+TANKS.filter(function(t){return t.group===g.k}).sort(natural).map(function(t){return '<option value="'+t.id+'"'+(sel===t.id?' selected':'')+'>'+esc(t.label)+(peek(t.id).species?' — '+esc(peek(t.id).species):'')+(peek(t.id).status==="empty"?' (vazio)':'')+'</option>'}).join("")+'</optgroup>'}).join("");
}
function localDT(t){var d=new Date(t);function p(n){return(n<10?"0":"")+n}return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes())}
function trFromLabel(x){return x.from==="fora"?"Fora do mapa":(BYID[x.from]?BYID[x.from].label:x.from)}
function trToLabel(x){if(x.to&&BYID[x.to])return BYID[x.to].label;var r=OUTL[x.out]||{label:"Saída"};return r.label+(x.outDetail?" ("+x.outDetail+")":"")}
function trDesc(x){var p=[];if(x.species)p.push(x.species);if(x.qty)p.push(x.qty+" peixes");if(x.kg)p.push(kg(x.kg)+" kg");return p.join(" · ")}
function openTransfer(fromId){
  xform={t:Date.now(),from:fromId||"",to:"",species:fromId?(peek(fromId).species||""):"",qty:"",kg:"",outDetail:"",notes:"",srcEmpty:false,copySp:true};
  renderTransferSheet();
}
function renderTransferSheet(){
  var f=xform,isOut=f.to.indexOf("out:")===0,reason=isOut?OUTL[f.to.slice(4)]:null,toTank=!isOut&&BYID[f.to]?f.to:null;
  var outOpts=OUT_REASONS.map(function(r){return '<option value="out:'+r.k+'"'+(f.to==="out:"+r.k?' selected':'')+'>'+r.label+'</option>'}).join("");
  var body=
   '<div class="field"><label class="lbl" for="x-t">Data e hora</label><input id="x-t" type="datetime-local" value="'+localDT(f.t)+'"></div>'+
   '<div class="formgrid two"><div class="field"><label class="lbl" for="x-from">De</label><select id="x-from"><option value=""'+(f.from?'':' selected')+' disabled>Escolher origem…</option><option value="fora"'+(f.from==="fora"?' selected':'')+'>Entrada de fora do mapa</option>'+tankOptions(f.from)+'</select></div>'+
   '<div class="field"><label class="lbl" for="x-to">Para</label><select id="x-to"><option value=""'+(f.to?'':' selected')+' disabled>Escolher destino…</option>'+(f.from==="fora"?'':'<optgroup label="Saída (não vai para o mapa)">'+outOpts+'</optgroup>')+tankOptions(f.to)+'</select></div></div>'+
   (reason?'<div class="field"><label class="lbl" for="x-od">'+reason.detail+'</label><input id="x-od" maxlength="60" value="'+esc(f.outDetail)+'"></div>':'')+
   '<div class="formgrid"><div class="field full"><label class="lbl" for="x-sp">Espécie</label><input id="x-sp" maxlength="40" list="x-splist" placeholder="Ex.: Robalo" value="'+esc(f.species)+'"><datalist id="x-splist">'+speciesList().map(function(x){return '<option value="'+esc(x)+'">'}).join("")+'</datalist></div>'+
   '<div class="field"><label class="lbl" for="x-q">Nº de peixes</label><input id="x-q" type="number" inputmode="numeric" min="0" placeholder="Opcional" value="'+esc(f.qty)+'"></div>'+
   '<div class="field"><label class="lbl" for="x-kg">Peso total (kg)</label><input id="x-kg" type="number" inputmode="decimal" min="0" step="0.1" placeholder="Opcional" value="'+esc(f.kg)+'"></div>'+
   '<div class="field full"><label class="lbl" for="x-n">Notas</label><input id="x-n" maxlength="120" placeholder="Opcional (motivo, calibre…)" value="'+esc(f.notes)+'"></div></div>'+
   (f.from&&f.from!=="fora"?'<label class="check"><input type="checkbox" id="x-empty"'+(f.srcEmpty?' checked':'')+'> '+esc(BYID[f.from].label)+' ficou vazio (muda o estado para Vazio)</label>':'')+
   (toTank?'<label class="check"><input type="checkbox" id="x-copy"'+(f.copySp?' checked':'')+'> Pôr esta espécie em '+esc(BYID[toTank].label)+'</label>':'')+
   '<div class="row" style="margin-top:14px"><button class="btn" id="x-ok" style="flex:1">Registar transferência</button><button class="btn ghost" data-x>Cancelar</button></div>';
  openSheet("Transferência de peixe","",body,function(){
    function read(){var tv=$("x-t").value;if(tv){var d=new Date(tv);if(!isNaN(d))f.t=d.getTime()}
      f.species=$("x-sp").value.trim();f.qty=$("x-q").value;f.kg=$("x-kg").value;f.notes=$("x-n").value;if($("x-od"))f.outDetail=$("x-od").value;
      if($("x-empty"))f.srcEmpty=$("x-empty").checked;if($("x-copy"))f.copySp=$("x-copy").checked}
    function valid(){return f.from&&f.to&&f.from!==f.to}
    function upd(){read();$("x-ok").disabled=!valid()}
    $("x-from").onchange=function(){read();var nf=$("x-from").value;if(f.from!==nf&&(!f.species||(BYID[f.from]&&f.species===peek(f.from).species)))f.species=BYID[nf]?peek(nf).species||"":f.species;f.from=nf;if(nf==="fora"&&f.to.indexOf("out:")===0)f.to="";renderTransferSheet()};
    $("x-to").onchange=function(){read();f.to=$("x-to").value;renderTransferSheet()};
    ["x-t","x-sp","x-q","x-kg","x-n","x-od"].forEach(function(id){if($(id))$(id).oninput=upd});
    upd();
    $("x-ok").onclick=function(){read();if(!valid())return;saveTransfer(f);closeSheet()};
  });
}
function saveTransfer(f){
  var isOut=f.to.indexOf("out:")===0,rec={id:"x"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),t:f.t,from:f.from,to:isOut?"":f.to,out:isOut?f.to.slice(4):"",outDetail:isOut?(f.outDetail||"").trim():"",
    species:f.species,qty:Math.max(0,parseInt(f.qty,10)||0),kg:Math.max(0,Math.round((parseFloat(String(f.kg).replace(",","."))||0)*10)/10),notes:(f.notes||"").trim(),createdAt:Date.now(),by:me?me.name:""};
  transfers().push(rec);if(transfers().length>LIM.transfers)state.transfers=transfers().slice(-LIM.transfers);
  var desc=trDesc(rec),when=rec.t<Date.now()-5*60000?" (em "+fmt(rec.t)+")":"";
  if(BYID[rec.from]){var a=tankData(rec.from);logTo(a,"Transferência → "+trToLabel(rec)+(desc?" · "+desc:"")+when);a.updatedAt=Date.now();
    if(f.srcEmpty&&a.status!=="empty"){logTo(a,"Estado: "+STL[a.status]+" → Vazio");a.status="empty";a.species=""}}
  if(BYID[rec.to]){var b=tankData(rec.to);logTo(b,"Transferência ← "+trFromLabel(rec)+(desc?" · "+desc:"")+when);b.updatedAt=Date.now();
    if(f.copySp&&rec.species)b.species=rec.species;if(b.status==="empty"){logTo(b,"Estado: Vazio → Operacional");b.status="ok"}}
  persist("Transferência registada: "+trFromLabel(rec)+" → "+trToLabel(rec));
  if(ui.tab==="transf")viewTransfers();else if(ui.tab==="mapa"){[rec.from,rec.to].forEach(function(i){if(BYID[i])refreshTank(i)});renderPanel()}
}
function deleteTransfer(id){
  var T=transfers(),i=T.findIndex(function(x){return x.id===id});if(i<0)return;var x=T[i];T.splice(i,1);
  [x.from,x.to].forEach(function(tid){if(BYID[tid])logTo(tankData(tid),"Transferência apagada ("+trFromLabel(x)+" → "+trToLabel(x)+", "+fmt(x.t)+")")});
  persist("Transferência apagada");viewTransfers();
}
function dayLabel(t){var d=new Date(t);d.setHours(0,0,0,0);var today=new Date();today.setHours(0,0,0,0);var diff=Math.round((today-d)/864e5);
  if(diff===0)return"Hoje";if(diff===1)return"Ontem";return new Date(t).toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long",year:d.getFullYear()!==today.getFullYear()?"numeric":undefined})}
function viewTransfers(){
  ensureColl("transfers");
  if(!lazyLoaded("transfers")){$("view").innerHTML='<div class="pagehead"><div><h1>Transferências</h1><p>A carregar…</p></div></div>';return}
  var v=$("view"),T=transfers().slice().sort(function(a,b){return b.t-a.t});
  var F=T.filter(function(x){if(trFilterTank&&x.from!==trFilterTank&&x.to!==trFilterTank)return false;if(trFilterType==="tank"&&!x.to)return false;if(trFilterType==="out"&&x.to)return false;if(trFilterType==="in"&&x.from!=="fora")return false;return true});
  var ms=new Date();ms.setDate(1);ms.setHours(0,0,0,0);
  var month=T.filter(function(x){return x.t>=ms.getTime()}),mOut=month.filter(function(x){return !x.to}).reduce(function(a,x){return a+(x.qty||0)},0);
  var html='<div class="pagehead"><div><h1>Transferências</h1><p>Registo de peixes que mudam de tanque ou saem do mapa. Aqui: últimos '+JANELA_DIAS+' dias; o histórico completo está na folha Google.</p></div><button class="btn" id="x-new">+ Nova transferência</button></div>'+
   '<div class="fsum"><div><b>'+month.length+'</b> este mês</div><div>'+month.filter(function(x){return x.to}).length+' entre tanques</div><div>'+(function(){var no=month.filter(function(x){return !x.to}).length;return no+(no===1?' saída':' saídas')})()+(mOut?' ('+mOut+' peixes)':'')+'</div></div>'+
   '<div class="toolbar"><select id="x-ft" class="selectf"><option value="">Todos os tanques</option>'+tankOptions(trFilterTank)+'</select>'+
   '<div class="seg" id="x-ty">'+[["","Todas"],["tank","Entre tanques"],["out","Saídas"],["in","Entradas"]].map(function(o){return '<button data-ty="'+o[0]+'" class="'+(trFilterType===o[0]?'on':'')+'">'+o[1]+'</button>'}).join("")+'</div></div>';
  if(!F.length)html+='<p class="empty" style="margin-top:20px">'+(T.length?'Nenhuma transferência com este filtro.':'Ainda não há transferências registadas. Use “+ Nova transferência” ou o botão “Transferir peixe” no painel de um tanque.')+'</p>';
  else{
    var lastDay="";html+='<div class="xlist">';
    F.slice(0,200).forEach(function(x){var dl=dayLabel(x.t);if(dl!==lastDay){html+='<div class="xday">'+dl+'</div>';lastDay=dl}
      var kind=x.to?"tank":(x.from==="fora"?"in":"out");
      html+='<button class="xitem k-'+kind+'" data-x="'+x.id+'"><span class="xtime">'+hhmm(x.t)+'</span><span class="xmain"><span class="xroute"><b>'+esc(trFromLabel(x))+'</b><span class="xarrow">→</span><b>'+esc(trToLabel(x))+'</b></span>'+(trDesc(x)||x.notes?'<span class="xdesc">'+esc([trDesc(x),x.notes].filter(Boolean).join(" · "))+'</span>':'')+'</span>'+(kind!=="tank"?'<span class="xtag">'+(kind==="out"?'Saída':'Entrada')+'</span>':'')+'</button>';
    });
    html+='</div>';if(F.length>200)html+='<p class="hint">A mostrar as 200 mais recentes.</p>';
  }
  v.innerHTML=html;
  $("x-new").onclick=function(){openTransfer(trFilterTank||"")};
  $("x-ft").onchange=function(){trFilterTank=$("x-ft").value;viewTransfers()};
  v.querySelectorAll("[data-ty]").forEach(function(b){b.onclick=function(){trFilterType=b.dataset.ty;viewTransfers()}});
  v.querySelectorAll("[data-x]").forEach(function(b){b.onclick=function(){showTransfer(b.dataset.x)}});
}
function showTransfer(id){
  var x=transfers().filter(function(r){return r.id===id})[0];if(!x)return;
  var rows=[["Data",fmt(x.t)],["De",trFromLabel(x)],["Para",trToLabel(x)],["Espécie",x.species],["Nº de peixes",x.qty||""],["Peso",x.kg?kg(x.kg)+" kg":""],["Notas",x.notes],["Registado",fmt(x.createdAt)+(x.by?" por "+x.by:"")]].filter(function(r){return r[1]!==""&&r[1]!=null});
  openSheet("Transferência",fmt(x.t),'<table class="kv">'+rows.map(function(r){return '<tr><th>'+r[0]+'</th><td>'+esc(r[1])+'</td></tr>'}).join("")+'</table>'+
    '<div class="row" style="margin-top:14px">'+(BYID[x.from]?'<button class="btn ghost" data-go="'+x.from+'">Ver '+esc(BYID[x.from].label)+'</button>':'')+(BYID[x.to]?'<button class="btn ghost" data-go="'+x.to+'">Ver '+esc(BYID[x.to].label)+'</button>':'')+'<button class="btn ghost" id="x-del" style="margin-left:auto">Apagar</button></div>',function(m){
    m.querySelectorAll("[data-go]").forEach(function(b){b.onclick=function(){closeSheet();select(b.dataset.go)}});
    $("x-del").onclick=function(){var b=$("x-del");if(!b.dataset.c){b.dataset.c=1;b.textContent="Confirmar apagar";b.className="btn danger";return}closeSheet();deleteTransfer(id)};
  });
}

/* ================= Recolhas de ovos: viabilidade, incubação, taxa de eclosão e sobrevivência =================
   Guardado no próprio tanque: tankData.eggLots = [{id,t,phase,epg,gV,gI,gInc,tTank,tInc,volH2O2,
     ecl:{vol,counts:[]}, sob:{mouth,vol,counts:[]}, notes, by, upd}] (máx. 100). Segue o protocolo da equipa. */
var EGG_PHASES=["Mórula","Blástula","Gástrula","Embrião formado","Pré-eclosão"];
function eggLots(id){return (peek(id).eggLots||[]).slice().sort(function(a,b){return b.t-a.t})}
function nf(v,d){return v==null||!isFinite(v)?"—":(+v).toLocaleString("pt-PT",{maximumFractionDigits:d==null?1:d})}
function parseCounts(s){return String(s||"").split(/[\s;,]+/).map(function(x){return parseFloat(x.replace(",","."))}).filter(function(x){return isFinite(x)&&x>=0})}
function meanOf(a){return a.length?a.reduce(function(s,x){return s+x},0)/a.length:null}
/* Todos os cálculos do protocolo num só sítio */
function eggCalc(L){
  var r={},n=function(v){return v==null||v===""?null:+v};
  var epg=n(L.epg),gV=n(L.gV),gI=n(L.gI),gInc=n(L.gInc)!=null?n(L.gInc):gV;
  r.gTot=gV!=null||gI!=null?(gV||0)+(gI||0):null;
  r.viab=r.gTot?(gV||0)/r.gTot*100:null;
  r.ovosV=epg!=null&&gV!=null?epg*gV:null;
  r.gInc=gInc;
  r.esperadas=epg!=null&&gInc!=null?epg*gInc:null;
  r.dT=n(L.tTank)!=null&&n(L.tInc)!=null?Math.abs(n(L.tInc)-n(L.tTank)):null;
  r.aclimatar=r.dT!=null&&r.dT>=0.5;
  r.h2o2=n(L.volH2O2)!=null?n(L.volH2O2)*1:null;
  var e=L.ecl||{},ec=e.counts||[];r.eN=ec.length;r.eMean=meanOf(ec);
  r.eclodidas=r.eMean!=null&&n(e.vol)!=null?r.eMean*n(e.vol)*1000:null;
  r.tEcl=r.eclodidas!=null&&r.esperadas?r.eclodidas/r.esperadas*100:null;
  var s=L.sob||{},sc=s.counts||[];r.sN=sc.length;r.sMean=meanOf(sc);
  r.larvas=r.sMean!=null&&n(s.vol)!=null?r.sMean*n(s.vol)*1000:null;
  r.tSob=r.larvas!=null&&r.eclodidas?r.larvas/r.eclodidas*100:null;
  return r;
}
function rateCls(v,good,ok){return v==null?"":v>=good?" good":v>=ok?" mid":" bad"}
function openEggLots(id){
  var L=eggLots(id),t=BYID[id];
  var body='<p class="hint" style="margin-top:0">Cada recolha segue o protocolo: viabilidade → incubação → taxa de eclosão → sobrevivência até à abertura da boca. Introduza os valores e a app faz as contas.</p>'+
    (readOnly?'':'<button class="btn spawn" id="el-new" style="width:100%;justify-content:center">'+EGG_ICON.replace('width="12" height="12"','width="16" height="16"')+' Nova recolha de ovos</button>')+
    (L.length?'<div class="el-list">'+L.map(function(x){var c=eggCalc(x);
      return '<button class="el-item" data-el="'+x.id+'"><div class="el-d"><b>'+new Date(x.t).toLocaleDateString("pt-PT",{day:"2-digit",month:"short"})+'</b><span>'+esc(x.phase||"")+'</span></div>'+
        '<div class="el-k"><span>Viáveis</span><b class="'+rateCls(c.viab,70,50)+'">'+(c.viab!=null?nf(c.viab,0)+'%':'—')+'</b></div>'+
        '<div class="el-k"><span>Eclosão</span><b class="'+rateCls(c.tEcl,70,40)+'">'+(c.tEcl!=null?nf(c.tEcl,0)+'%':'—')+'</b></div>'+
        '<div class="el-k"><span>Sobrev.</span><b class="'+rateCls(c.tSob,60,30)+'">'+(c.tSob!=null?nf(c.tSob,0)+'%':'—')+'</b></div></button>'}).join("")+'</div>'
      :'<p class="empty">Ainda não há recolhas registadas neste tanque.</p>');
  openSheet("Recolhas de ovos · "+esc(t.label),L.length?L.length+(L.length===1?" recolha":" recolhas"):"",body,function(m){
    if($("el-new"))$("el-new").onclick=function(){openEggLot(id,null)};
    m.querySelectorAll("[data-el]").forEach(function(b){b.onclick=function(){openEggLot(id,b.dataset.el)}});
  });
}
function openEggLot(id,lid){
  var td=tankData(id),isNew=!lid,L=isNew?{id:newId("e"),t:Date.now(),ecl:{counts:[]},sob:{counts:[]}}:clean((td.eggLots||[]).filter(function(x){return x.id===lid})[0]||{});
  if(!L.id){toast("Recolha não encontrada");return}
  L.ecl=L.ecl||{counts:[]};L.sob=L.sob||{counts:[]};
  function v(x){return x==null?"":String(x).replace(".",",")}
  function F(idf,label,val,unit,ph){return '<div class="field"><label class="lbl" for="'+idf+'">'+label+(unit?' <small>('+unit+')</small>':'')+'</label><input id="'+idf+'" inputmode="decimal" autocomplete="off" value="'+v(val)+'"'+(ph?' placeholder="'+ph+'"':'')+'></div>'}
  function R(idr,label){return '<div class="er"><span>'+label+'</span><b id="'+idr+'">—</b></div>'}
  var body='<div class="eggform">'+
    '<details class="estep" open><summary><i>1</i>Recolha e viabilidade</summary><div class="formgrid">'+
      '<div class="field"><label class="lbl" for="e-date">Data da recolha</label><input id="e-date" type="datetime-local" value="'+localDT(L.t)+'" max="'+localDT(Date.now()+60000)+'"></div>'+
      '<div class="field"><label class="lbl" for="e-phase">Fase de desenvolvimento</label><input id="e-phase" list="e-phases" maxlength="40" value="'+esc(L.phase||"")+'" placeholder="Ex.: Gástrula"><datalist id="e-phases">'+EGG_PHASES.map(function(p){return '<option value="'+p+'">'}).join("")+'</datalist></div>'+
      F("e-epg","Ovos em 1 g",L.epg,"contagem","Ex.: 1500")+F("e-gv","Ovos viáveis",L.gV,"g")+F("e-gi","Ovos inviáveis",L.gI,"g")+
    '</div><div class="eres">'+R("r-viab","Viabilidade")+R("r-ovosv","Nº estimado de ovos viáveis")+'</div></details>'+
    '<details class="estep"'+(isNew?'':' open')+'><summary><i>2</i>Incubação e desinfeção</summary><div class="formgrid">'+
      F("e-ginc","Ovos incubados",L.gInc,"g","= viáveis")+F("e-vol2","Água para desinfeção",L.volH2O2,"L")+
      F("e-ttank","Temperatura do tanque",L.tTank,"°C")+F("e-tinc","Temperatura da incubadora",L.tInc,"°C")+
    '</div><div class="eres">'+R("r-h2o2","H₂O₂ a usar (1 mL por litro)")+R("r-dt","Diferença de temperatura")+R("r-esp","Larvas esperadas após eclosão")+'</div>'+
    '<div class="ewarn" id="r-acl" hidden>⚠️ Diferença ≥ 0,5 °C: aclimatar os ovos à incubadora antes de os colocar.</div>'+
    '<div class="enote">🧪 Agitar suavemente e trocar a água (90–110 s). Lavar 3 a 4 vezes e colocar os ovos com cuidado na incubadora.</div></details>'+
    '<details class="estep"'+(L.ecl.counts.length?' open':'')+'><summary><i>3</i>Taxa de eclosão</summary><div class="formgrid">'+
      F("e-evol","Volume do balde",L.ecl.vol,"L")+
      '<div class="field full"><label class="lbl" for="e-ecnt">Contagens das pipetagens de 1 mL <small>(15 a 20, separadas por espaço)</small></label><textarea id="e-ecnt" inputmode="decimal" style="min-height:64px" placeholder="Ex.: 12 9 14 11 10 …">'+L.ecl.counts.join(" ")+'</textarea></div>'+
    '</div><div class="eres">'+R("r-en","Pipetagens · média por mL")+R("r-ecl","Total de larvas eclodidas")+'<div class="er big"><span>Taxa de eclosão</span><b id="r-tecl">—</b></div></div></details>'+
    '<details class="estep"'+(L.sob.counts.length?' open':'')+'><summary><i>4</i>Sobrevivência até abertura da boca</summary>'+
      '<label class="check" style="margin:2px 0 10px"><input type="checkbox" id="e-mouth"'+(L.sob.mouth?' checked':'')+'> Abertura da boca verificada à lupa</label><div class="formgrid">'+
      F("e-svol","Volume do balde",L.sob.vol,"L")+
      '<div class="field full"><label class="lbl" for="e-scnt">Contagens das pipetagens de 1 mL <small>(15 a 20)</small></label><textarea id="e-scnt" inputmode="decimal" style="min-height:64px" placeholder="Ex.: 8 7 10 9 …">'+L.sob.counts.join(" ")+'</textarea></div>'+
    '</div><div class="eres">'+R("r-sn","Pipetagens · média por mL")+R("r-lar","Total de larvas")+'<div class="er big"><span>Taxa de sobrevivência</span><b id="r-tsob">—</b></div></div></details>'+
    '<div class="field" style="margin-top:12px"><label class="lbl" for="e-notes">Notas</label><textarea id="e-notes" maxlength="300" style="min-height:56px">'+esc(L.notes||"")+'</textarea></div>'+
    (readOnly?'':'<div class="row esave"><button class="btn" id="e-save" style="flex:1">Guardar recolha</button>'+(isNew?'':'<button class="btn ghost" id="e-del">Apagar</button>')+'</div>')+
    '<details class="eproto"><summary>Ver fórmulas usadas</summary><ul>'+
      '<li><b>Viabilidade</b> = g viáveis ÷ (g viáveis + g inviáveis) × 100</li>'+
      '<li><b>Larvas esperadas</b> = ovos em 1 g × g de ovos incubados</li>'+
      '<li><b>Larvas eclodidas</b> = média das pipetagens (por mL) × volume do balde (mL)</li>'+
      '<li><b>Taxa de eclosão</b> = larvas eclodidas ÷ larvas esperadas × 100</li>'+
      '<li><b>Total de larvas</b> = média das pipetagens × volume do balde (mL)</li>'+
      '<li><b>Taxa de sobrevivência</b> = total de larvas ÷ larvas eclodidas × 100</li>'+
      '<li><b>H₂O₂</b> = 1 mL por cada litro de água</li></ul></details></div>';
  openSheet((isNew?"Nova recolha":"Recolha")+" · "+esc(BYID[id].label),"Protocolo de recolha de ovos",body,function(m){
    if(readOnly)m.querySelectorAll("input,textarea").forEach(function(i){i.disabled=true});
    function num(idf){var el=$(idf);if(!el)return null;var s=String(el.value).replace(",",".").trim();if(s==="")return null;var x=parseFloat(s);return isFinite(x)?x:null}
    function read(){
      var d=$("e-date").value;L.t=d?new Date(d).getTime()||L.t:L.t;L.phase=$("e-phase").value.trim();
      L.epg=num("e-epg");L.gV=num("e-gv");L.gI=num("e-gi");L.gInc=num("e-ginc");L.volH2O2=num("e-vol2");L.tTank=num("e-ttank");L.tInc=num("e-tinc");
      L.ecl={vol:num("e-evol"),counts:parseCounts($("e-ecnt").value)};
      L.sob={mouth:$("e-mouth").checked,vol:num("e-svol"),counts:parseCounts($("e-scnt").value)};
      L.notes=$("e-notes").value.trim();
    }
    function show(){
      read();var c=eggCalc(L);
      function set(idr,txt,cls){var el=$(idr);if(el){el.textContent=txt;el.className=cls||""}}
      set("r-viab",c.viab!=null?nf(c.viab,1)+" %":"—",rateCls(c.viab,70,50));
      set("r-ovosv",c.ovosV!=null?nf(Math.round(c.ovosV),0)+" ovos":"—");
      set("r-h2o2",c.h2o2!=null?nf(c.h2o2,1)+" mL":"—");
      set("r-dt",c.dT!=null?nf(c.dT,1)+" °C":"—",c.dT==null?"":c.aclimatar?"bad":"good");
      $("r-acl").hidden=!c.aclimatar;
      set("r-esp",c.esperadas!=null?nf(Math.round(c.esperadas),0)+" larvas"+(L.gInc==null&&L.gV!=null?" (com os g viáveis)":""):"—");
      set("r-en",c.eN?c.eN+" · "+nf(c.eMean,2)+" larvas/mL"+(c.eN<15?" (faltam "+(15-c.eN)+")":""):"—");
      set("r-ecl",c.eclodidas!=null?nf(Math.round(c.eclodidas),0)+" larvas":"—");
      set("r-tecl",c.tEcl!=null?nf(c.tEcl,1)+" %":(c.eclodidas!=null?"falta ovos/g e g incubados":"—"),rateCls(c.tEcl,70,40));
      set("r-sn",c.sN?c.sN+" · "+nf(c.sMean,2)+" larvas/mL"+(c.sN<15?" (faltam "+(15-c.sN)+")":""):"—");
      set("r-lar",c.larvas!=null?nf(Math.round(c.larvas),0)+" larvas":"—");
      set("r-tsob",c.tSob!=null?nf(c.tSob,1)+" %":(c.larvas!=null?"falta a taxa de eclosão":"—"),rateCls(c.tSob,60,30));
    }
    m.querySelector(".eggform").addEventListener("input",show);m.querySelector(".eggform").addEventListener("change",show);show();
    if($("e-save"))$("e-save").onclick=function(){
      read();L.by=me?me.name:"";L.upd=Date.now();
      var t2=tankData(id),A=(t2.eggLots||[]).filter(function(x){return x.id!==L.id});A.push(clean(L));A.sort(function(a,b){return a.t-b.t});t2.eggLots=A.slice(-100);t2.updatedAt=Date.now();
      var c=eggCalc(L);if(isNew)logTo(t2,"Recolha de ovos registada"+(c.viab!=null?" · viáveis "+nf(c.viab,0)+"%":""));
      persist(BYID[id].label+": recolha de ovos guardada");openEggLots(id);if(ui.tab==="posturas")viewPosturas();
    };
    if($("e-del"))$("e-del").onclick=function(){var b=this;if(!b.dataset.c){b.dataset.c=1;b.textContent="Confirmar?";b.style.color="var(--alert)";return}
      var t2=tankData(id),old=t2.eggLots;t2.eggLots=(t2.eggLots||[]).filter(function(x){return x.id!==L.id});persist("Recolha apagada",{label:"Anular",fn:function(){tankData(id).eggLots=old;persist(null);if(ui.tab==="posturas")viewPosturas()}});openEggLots(id);if(ui.tab==="posturas")viewPosturas()};
  });
}

/* ================= Separador: POSTURAS (desovas ativas, recolhas de ovos e histórico) ================= */
var postHistOpen=false;
function spawningTanks(){return TANKS.filter(function(t){return spawnOf(t.id)}).sort(function(a,b){return spawnOf(a.id).since-spawnOf(b.id).since})}
function allEggLots(){var A=[];TANKS.forEach(function(t){(peek(t.id).eggLots||[]).forEach(function(l){A.push({id:t.id,l:l})})});return A.sort(function(a,b){return b.l.t-a.l.t})}
function pct0(v){return v!=null?nf(v,0)+"%":"—"}
function updatePostBadge(){var n=spawnCount();document.querySelectorAll(".nbadge[data-ns]").forEach(function(b){b.textContent=n;b.style.display=n?"":"none"})}
function viewPosturas(){
  var v=$("view"),S=spawningTanks(),A=allEggLots();
  var H=[];TANKS.forEach(function(t){(peek(t.id).spawns||[]).forEach(function(s){H.push({id:t.id,s:s})})});H.sort(function(a,b){return b.s.end-a.s.end});
  var html='<div class="pagehead"><div><h1>Posturas</h1><p>Tanques com desova, recolhas de ovos e as taxas de viabilidade, eclosão e sobrevivência.</p></div>'+(readOnly?'':'<button class="btn spawn" id="ps-new">'+EGG_ICON.replace('width="12" height="12"','width="16" height="16"')+' Assinalar desova</button>')+'</div>';
  html+='<div class="section-title big">Em desova agora<span>'+S.length+'</span></div>';
  if(!S.length)html+='<div class="ps-empty">'+EGG_ICON.replace('width="12" height="12"','width="40" height="40"')+'<p>Nenhum tanque com posturas neste momento.</p><p class="hint" style="margin:0">Assinale uma desova aqui ou no painel do tanque, no Mapa.</p></div>';
  else html+='<div class="psgrid">'+S.map(function(t){
    var sp=spawnOf(t.id),d=peek(t.id),L=eggLots(t.id),last=L[0],c=last?eggCalc(last):null,n=spawnDays(sp);
    return '<div class="pscard"><div class="ps-h"><div><div class="ps-t">'+esc(t.label)+'</div><div class="ps-sp">'+(d.species?esc(d.species):'<span class="muted">sem espécie</span>')+'</div></div><span class="sbadge static">'+EGG_ICON+'<span>'+(n?n+'d':'hoje')+'</span></span></div>'+
      '<div class="ps-m">Desde <b>'+fmt(sp.since)+'</b>'+(sp.by?' · '+esc(sp.by):'')+'</div>'+(sp.note?'<div class="ps-note">'+esc(sp.note)+'</div>':'')+
      (c?'<div class="ps-rates"><div><span>Viáveis</span><b class="'+rateCls(c.viab,70,50)+'">'+pct0(c.viab)+'</b></div><div><span>Eclosão</span><b class="'+rateCls(c.tEcl,70,40)+'">'+pct0(c.tEcl)+'</b></div><div><span>Sobrev.</span><b class="'+rateCls(c.tSob,60,30)+'">'+pct0(c.tSob)+'</b></div></div><div class="ps-last">Última recolha: '+new Date(last.t).toLocaleDateString("pt-PT",{day:"2-digit",month:"short"})+(last.phase?' · '+esc(last.phase):'')+' · '+L.length+(L.length===1?' recolha':' recolhas')+'</div>'
        :'<div class="ps-last">Ainda sem recolhas de ovos.</div>')+
      '<div class="ps-act">'+(readOnly?'':'<button class="btn spawn sm" data-pnew="'+t.id+'">+ Recolha</button>')+'<button class="btn ghost sm" data-plots="'+t.id+'">Ver recolhas</button>'+
        (readOnly?'':'<button class="btn ghost sm" data-pedit="'+t.id+'">Editar</button>')+'<button class="linkbtn" data-pmap="'+t.id+'">Ver no mapa</button></div></div>'}).join("")+'</div>';
  html+='<div class="section-title big">Recolhas de ovos<span>'+A.length+'</span></div>';
  if(!A.length)html+='<p class="empty">Ainda não há recolhas registadas.</p>';
  else html+='<table class="htable pstable"><thead><tr><th>Data</th><th>Tanque</th><th class="hide-m">Fase</th><th style="text-align:right">Viáveis</th><th style="text-align:right">Eclosão</th><th style="text-align:right">Sobrev.</th></tr></thead><tbody>'+
    A.slice(0,60).map(function(x){var c=eggCalc(x.l);return '<tr data-plot="'+x.id+'|'+x.l.id+'" style="cursor:pointer"><td>'+new Date(x.l.t).toLocaleDateString("pt-PT",{day:"2-digit",month:"short",year:"2-digit"})+'</td><td class="tk">'+esc(BYID[x.id].label)+'</td><td class="hide-m">'+esc(x.l.phase||"—")+'</td>'+
      '<td style="text-align:right" class="'+rateCls(c.viab,70,50)+'"><b>'+pct0(c.viab)+'</b></td><td style="text-align:right" class="'+rateCls(c.tEcl,70,40)+'"><b>'+pct0(c.tEcl)+'</b></td><td style="text-align:right" class="'+rateCls(c.tSob,60,30)+'"><b>'+pct0(c.tSob)+'</b></td></tr>'}).join("")+'</tbody></table>';
  html+='<details class="histd" id="pshist" style="margin-top:18px"'+(postHistOpen?' open':'')+'><summary><span>Desovas terminadas</span><b>'+H.length+'</b><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></summary>'+
    (H.length?'<table class="htable"><thead><tr><th>Tanque</th><th>Início</th><th>Fim</th><th style="text-align:right">Dias</th></tr></thead><tbody>'+H.slice(0,80).map(function(h){return '<tr><td class="tk">'+esc(BYID[h.id].label)+(h.s.note?'<div class="sub">'+esc(h.s.note)+'</div>':'')+'</td><td>'+new Date(h.s.start).toLocaleDateString("pt-PT")+'</td><td>'+new Date(h.s.end).toLocaleDateString("pt-PT")+'</td><td style="text-align:right">'+(Math.floor((h.s.end-h.s.start)/864e5)+1)+'</td></tr>'}).join("")+'</tbody></table>':'<p class="empty">Ainda não há desovas terminadas.</p>')+'</details>';
  v.innerHTML=html;
  if($("ps-new"))$("ps-new").onclick=openNewSpawn;
  v.querySelectorAll("[data-pnew]").forEach(function(b){b.onclick=function(){openEggLot(b.dataset.pnew,null)}});
  v.querySelectorAll("[data-plots]").forEach(function(b){b.onclick=function(){openEggLots(b.dataset.plots)}});
  v.querySelectorAll("[data-pedit]").forEach(function(b){b.onclick=function(){editSpawn(b.dataset.pedit)}});
  v.querySelectorAll("[data-pmap]").forEach(function(b){b.onclick=function(){select(b.dataset.pmap)}});
  v.querySelectorAll("[data-plot]").forEach(function(r){r.onclick=function(){var p=r.dataset.plot.split("|");openEggLot(p[0],p[1])}});
  $("pshist").addEventListener("toggle",function(){postHistOpen=this.open});
  updatePostBadge();
}
function spawnFormHtml(sp,withTank){
  var opts=withTank?TANKS.filter(function(t){return !spawnOf(t.id)&&peek(t.id).status!=="empty"}).sort(natural):[];
  return (withTank?'<div class="field"><label class="lbl" for="sf-tank">Tanque</label><select id="sf-tank" class="selectf">'+opts.map(function(t){var s=peek(t.id).species;return '<option value="'+t.id+'">'+esc(t.label)+(s?' — '+esc(s):'')+'</option>'}).join("")+'</select></div>':'')+
    '<div class="formgrid"><div class="field"><label class="lbl" for="sf-when">Desde</label><input id="sf-when" type="datetime-local" value="'+localDT(sp?sp.since:Date.now())+'" max="'+localDT(Date.now()+60000)+'"></div>'+
    '<div class="field"><label class="lbl" for="sf-note">Nota (opcional)</label><input id="sf-note" maxlength="80" value="'+esc(sp&&sp.note||"")+'" placeholder="Ex.: ovos flutuantes, ~200 ml"></div></div>';
}
function readWhen(){var v=$("sf-when").value,w=v?new Date(v).getTime():Date.now();if(!(w>0))w=Date.now();if(w>Date.now()+60000){toast("A data não pode ser no futuro");return null}return w}
function openNewSpawn(){
  openSheet("Assinalar desova","Escolha o tanque onde há posturas / ovos",spawnFormHtml(null,true)+'<button class="btn spawn" id="sf-ok" style="width:100%;justify-content:center">Confirmar</button>',function(){
    if(!$("sf-tank").options.length){$("sf-ok").disabled=true}
    $("sf-ok").onclick=function(){var w=readWhen();if(w==null)return;var id=$("sf-tank").value,note=$("sf-note").value.trim();if(!id)return;closeSheet();startSpawn(id,w,note);if(ui.tab==="posturas")viewPosturas()};
  });
}
function editSpawn(id){
  var sp=spawnOf(id);if(!sp)return;
  openSheet("Editar desova · "+esc(BYID[id].label),"",spawnFormHtml(sp,false)+'<div class="row"><button class="btn" id="sf-ok" style="flex:1">Guardar</button><button class="btn ghost" id="sf-end">Terminou a desova</button></div>',function(){
    $("sf-ok").onclick=function(){var w=readWhen();if(w==null)return;var td=tankData(id);td.spawn.since=w;td.spawn.note=$("sf-note").value.trim();td.updatedAt=Date.now();logTo(td,"Desova editada");persist(BYID[id].label+": desova atualizada");closeSheet();refreshTank(id);if(ui.tab==="posturas")viewPosturas()};
    $("sf-end").onclick=function(){closeSheet();endSpawn(id);if(ui.tab==="posturas")viewPosturas()};
  });
}

/* ================= Separador: FICHAS (informação pública do peixe por tanque) ================= */
var FICHA_TANKS=TANKS.filter(function(t){return t.group==="R"}).sort(natural);
function fichas(){if(!state.fichas)state.fichas={};return state.fichas}
function fichaOf(id){return fichas()[id]||null}
function lastWeigh(f){if(!f||!f.pesagens||!f.pesagens.length)return null;return f.pesagens.slice().sort(function(a,b){return b.t-a.t})[0]}
function fmtDate(t){return t?new Date(t).toLocaleDateString("pt-PT",{day:"2-digit",month:"2-digit",year:"numeric"}):"—"}
function dateVal(t){if(!t)return"";var d=new Date(t);function p(n){return(n<10?"0":"")+n}return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())}
function parseDate(v){if(!v)return 0;var d=new Date(v+"T12:00:00");return isNaN(d)?0:d.getTime()}
function ageText(birth){
  if(!birth)return"";var days=Math.floor((Date.now()-birth)/864e5);if(days<0)return"";
  if(days<60)return days+(days===1?" dia":" dias");
  var m=Math.floor(days/30.44);if(m<24)return m+" meses";
  var y=Math.floor(m/12),r=m%12;return y+(y===1?" ano":" anos")+(r?" e "+r+(r===1?" mês":" meses"):"");
}
function num(x,d){return(+x||0).toLocaleString("pt-PT",{maximumFractionDigits:d==null?1:d})}
function numIn(id){var v=$(id)?String($(id).value).replace(",",".").trim():"";if(v==="")return null;var n=parseFloat(v);return isFinite(n)?n:null}
function fichaUrl(id){return new URL("ficha.html?t="+encodeURIComponent(id),location.href.split("#")[0].split("?")[0]).href}

/* ---- Fotografias (guardadas comprimidas no Firestore: "fotos" = miniatura + dados, "fotosFull" = imagem) ---- */
var PHOTO_CATS=[{k:"especie",label:"Espécie"},{k:"amostragem",label:"Amostragens"},{k:"praticas",label:"Práticas"}];
var PCAT={};PHOTO_CATS.forEach(function(c){PCAT[c.k]=c.label});
var photos={},photosOn=false,fichaOpenId=null,photoCat="especie";
function ensurePhotos(){
  if(photosOn||!FB.db)return;photosOn=true;
  unsubs.push(FB.onSnapshot(FB.collection(FB.db,"fotos"),function(s){
    s.docChanges().forEach(function(ch){if(ch.type==="removed")delete photos[ch.doc.id];else{var d=ch.doc.data();d.id=ch.doc.id;photos[ch.doc.id]=d}});
    if(fichaOpenId&&$("fi-gallery"))renderFichaGallery(fichaOpenId);
    if(ui.tab==="fichas"&&!isBusy())viewFichas();
  },snapErr));
}
function tankPhotos(id,cat){return Object.keys(photos).map(function(k){return photos[k]}).filter(function(p){return p.tank===id&&(!cat||p.cat===cat)}).sort(function(a,b){return(b.t||0)-(a.t||0)})}
function coverOf(id){var f=fichaOf(id)||{};if(f.cover&&photos[f.cover])return photos[f.cover];return tankPhotos(id,"especie")[0]||null}
function loadImg(file){return new Promise(function(res,rej){var u=URL.createObjectURL(file),i=new Image();i.onload=function(){res(i)};i.onerror=function(){rej(new Error("Imagem inválida"))};i.src=u})}
function toJpeg(img,max,q){var W=img.naturalWidth,H=img.naturalHeight,r=Math.min(1,max/Math.max(W,H)),w=Math.max(1,Math.round(W*r)),h=Math.max(1,Math.round(H*r)),c=document.createElement("canvas");c.width=w;c.height=h;var g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);return{data:c.toDataURL("image/jpeg",q),w:w,h:h}}
function prepPhoto(file){
  return loadImg(file).then(function(img){
    var max=1600,q=.82,full=toJpeg(img,max,q);
    while(full.data.length>850000&&q>.45){q-=.08;if(q<.6)max=1280;full=toJpeg(img,max,q)}
    return{full:full,thumb:toJpeg(img,420,.72)};
  });
}
function uploadPhotos(id,files,cat,caption,when){
  var list=Array.prototype.slice.call(files||[]).filter(function(f){return /^image\//.test(f.type)||/\.(jpe?g|png|heic|webp)$/i.test(f.name)});
  if(!list.length)return Promise.resolve(0);
  var st=$("fi-up-status"),done=0;
  function next(i){
    if(i>=list.length)return Promise.resolve(done);
    if(st)st.textContent="A preparar "+(i+1)+" de "+list.length+"…";
    return prepPhoto(list[i]).then(function(p){
      var pid=newId("f"),b=FB.writeBatch(FB.db),t=when||Date.now();
      b.set(FB.doc(FB.db,"fotos/"+pid),{tank:id,cat:cat,caption:caption||"",t:t,by:me?me.name:"",w:p.full.w,h:p.full.h,thumb:p.thumb.data,createdAt:Date.now()});
      b.set(FB.doc(FB.db,"fotosFull/"+pid),{tank:id,data:p.full.data});
      if(st)st.textContent="A enviar "+(i+1)+" de "+list.length+"…";
      return b.commit().then(function(){done++;});
    }).catch(function(e){toast("Não foi possível enviar "+list[i].name+": "+(e&&e.code||e&&e.message||e))}).then(function(){return next(i+1)});
  }
  return next(0).then(function(n){
    if(st)st.textContent=n?(n===1?"1 fotografia adicionada.":n+" fotografias adicionadas."):"";
    if(n){var td=tankData(id);logTo(td,(n===1?"Fotografia adicionada":n+" fotografias adicionadas")+" ("+PCAT[cat]+")");td.updatedAt=Date.now();persist(null)}
    return n;
  });
}
function deletePhoto(pid){
  var p=photos[pid];if(!p)return;var b=FB.writeBatch(FB.db);
  b.delete(FB.doc(FB.db,"fotos/"+pid));b.delete(FB.doc(FB.db,"fotosFull/"+pid));
  b.commit().then(function(){
    var f=fichaOf(p.tank);if(f&&f.cover===pid){f.cover="";persist(null)}
    toast("Fotografia apagada");
  }).catch(function(e){toast("Erro ao apagar: "+(e&&e.code||e))});
}
function setCover(id,pid){var f=fichaOf(id)||{species:peek(id).species||"",pesagens:[]};f=clean(f);f.cover=pid;fichas()[id]=f;persist("Capa da ficha atualizada");renderFichaGallery(id)}
function openPhotoViewer(pid){
  var p=photos[pid];if(!p)return;
  var ov=document.createElement("div");ov.className="pv";ov.innerHTML='<button class="pv-x" aria-label="Fechar">×</button><img class="pv-img" src="'+p.thumb+'" alt=""><div class="pv-cap"><b>'+esc(PCAT[p.cat]||"")+'</b>'+(p.caption?' · '+esc(p.caption):'')+'<span>'+fmtDate(p.t)+(p.by?' · '+esc(p.by):'')+'</span></div>';
  document.body.appendChild(ov);
  ov.onclick=function(e){if(e.target===ov||e.target.classList.contains("pv-x"))ov.remove()};
  FB.getDoc(FB.doc(FB.db,"fotosFull/"+pid)).then(function(s){if(s.exists()){var im=ov.querySelector(".pv-img");if(im)im.src=s.data().data}}).catch(function(){});
}
function renderFichaGallery(id){
  var g=$("fi-gallery");if(!g)return;var f=fichaOf(id)||{},cov=coverOf(id),L=tankPhotos(id);
  if(!L.length){g.innerHTML='<p class="hint" style="margin:8px 0 0">Ainda sem fotografias.</p>';return}
  g.innerHTML=PHOTO_CATS.map(function(c){var P=L.filter(function(p){return p.cat===c.k});if(!P.length)return"";
    return '<div class="gal-h">'+c.label+' <span>'+P.length+'</span></div><div class="gal">'+P.map(function(p){var isC=cov&&cov.id===p.id;
      return '<figure class="gal-i'+(isC?' cover':'')+'"><img src="'+p.thumb+'" alt="'+esc(p.caption||c.label)+'" data-pv="'+p.id+'" loading="lazy">'+
        (isC?'<span class="gal-badge">Capa</span>':'')+
        '<div class="gal-act"><button data-cov="'+p.id+'" title="Usar como capa da ficha" aria-label="Usar como capa">★</button><button data-pdel2="'+p.id+'" title="Apagar" aria-label="Apagar">×</button></div>'+
        (p.caption?'<figcaption>'+esc(p.caption)+'</figcaption>':'')+'</figure>'}).join("")+'</div>'}).join("");
  g.querySelectorAll("[data-pv]").forEach(function(im){im.onclick=function(){openPhotoViewer(im.dataset.pv)}});
  g.querySelectorAll("[data-cov]").forEach(function(b){b.onclick=function(){setCover(id,b.dataset.cov)}});
  g.querySelectorAll("[data-pdel2]").forEach(function(b){b.onclick=function(){if(!b.dataset.c){b.dataset.c=1;b.textContent="?";b.classList.add("warn");b.title="Tocar outra vez para apagar";return}deletePhoto(b.dataset.pdel2)}});
}

function viewFichas(){
  ensurePhotos();
  var v=$("view");
  v.innerHTML='<div class="pagehead"><div><h1>Fichas dos tanques</h1><p>Informação do peixe em cada tanque interior. É o que vê quem ler o QR code do tanque (sem login).</p></div><a class="btn ghost" href="qrs.html" target="_blank" rel="noopener">Imprimir QR codes</a></div>'+
   '<div class="figrid">'+FICHA_TANKS.map(function(t){
     var f=fichaOf(t.id)||{},w=lastWeigh(f),sp=f.species||peek(t.id).species||"",age=ageText(f.birth),cov=coverOf(t.id),np=tankPhotos(t.id).length;
     var empty=!sp&&!w&&!f.count&&!f.birth;
     return '<div class="ficard'+(empty?' empty':'')+'">'+
       (cov?'<div class="fi-cover" style="background-image:url('+cov.thumb+')"><span class="fi-t on-img">'+esc(t.label)+'</span><span class="fi-qr">'+'<button class="iconbtn sm" data-qr="'+t.id+'" title="QR code" aria-label="QR code de '+esc(t.label)+'">'+QR_ICON+'</button>'+'</span></div>':'')+
       '<div class="fi-body">'+(cov?'':'<div class="fi-h"><span class="fi-t">'+esc(t.label)+'</span>'+'<button class="iconbtn sm" data-qr="'+t.id+'" title="QR code" aria-label="QR code de '+esc(t.label)+'">'+QR_ICON+'</button>'+'</div>')+
       '<div class="fi-sp">'+(sp?esc(sp):'<span class="muted">Sem espécie</span>')+(f.sci?' <i class="fi-sci">'+esc(f.sci)+'</i>':'')+'</div>'+
       '<div class="fi-stats">'+
         '<div><span>Idade</span><b>'+(age||'—')+'</b></div>'+
         '<div><span>Nº peixes</span><b>'+(f.count?num(f.count,0):'—')+'</b></div>'+
         '<div><span>Peso médio</span><b>'+(w&&w.weight?num(w.weight)+' g':'—')+'</b></div>'+
         '<div><span>Tamanho</span><b>'+(w&&w.length?num(w.length)+' cm':'—')+'</b></div>'+
       '</div>'+
       '<div class="fi-foot">'+(w?'Última pesagem: '+fmtDate(w.t):'Sem pesagens')+(np?' · '+np+(np===1?' foto':' fotos'):'')+'</div>'+
       '<button class="btn '+(empty?'':'ghost ')+'fi-edit" data-fe="'+t.id+'">'+(empty?'Preencher ficha':'Editar ficha')+'</button></div></div>';
   }).join("")+'</div>';
  v.querySelectorAll("[data-fe]").forEach(function(b){b.onclick=function(){openFicha(b.dataset.fe)}});
  v.querySelectorAll("[data-qr]").forEach(function(b){b.onclick=function(){openQr(b.dataset.qr)}});
}
var QR_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>';
function openQr(id){
  var url=fichaUrl(id),svg="";try{svg=qrSvg(url)}catch(e){svg='<p class="auth-err">'+esc(e.message)+'</p>'}
  openSheet("QR code · "+esc(BYID[id].label),"Quem ler este código vê a ficha pública do tanque",
    '<div class="qrbox">'+svg+'<div class="qr-cap">'+esc(BYID[id].label)+'</div></div>'+
    '<p class="hint" style="word-break:break-all;text-align:center">'+esc(url)+'</p>'+
    '<div class="row"><a class="btn" style="flex:1;text-align:center;text-decoration:none" href="'+esc(url)+'" target="_blank" rel="noopener">Abrir ficha pública</a><a class="btn ghost" style="text-decoration:none" href="qrs.html" target="_blank" rel="noopener">Imprimir todos</a></div>',function(){});
}
function openFicha(id){
  ensurePhotos();fichaOpenId=id;
  var t=BYID[id],f=clean(fichaOf(id)||{species:peek(id).species||"",pesagens:[]});
  if(!f.pesagens)f.pesagens=[];
  var P=f.pesagens.slice().sort(function(a,b){return b.t-a.t});
  function v(x){return x==null||x===""?"":esc(x)}
  var body='<p class="pubnote">🌐 Esta ficha é pública: qualquer pessoa com o QR code do tanque a pode ver.</p>'+
   '<div class="fsec">Espécie</div><div class="formgrid">'+
    '<div class="field"><label class="lbl" for="fi-sp">Nome comum</label><input id="fi-sp" maxlength="40" list="fi-splist" placeholder="Ex.: Robalo" value="'+v(f.species)+'"><datalist id="fi-splist">'+speciesList().map(function(x){return '<option value="'+esc(x)+'">'}).join("")+'</datalist></div>'+
    '<div class="field"><label class="lbl" for="fi-sci">Nome científico</label><input id="fi-sci" maxlength="60" placeholder="Ex.: Dicentrarchus labrax" value="'+v(f.sci)+'"></div>'+
    '<div class="field full"><label class="lbl" for="fi-about">Sobre a espécie</label><textarea id="fi-about" maxlength="900" style="min-height:80px" placeholder="Curiosidades, habitat, porque é estudada aqui…">'+v(f.about)+'</textarea></div>'+
   '</div>'+
   '<div class="fsec">Lote e população</div><div class="formgrid">'+
    '<div class="field"><label class="lbl" for="fi-birth">Nascimento / eclosão</label><input id="fi-birth" type="date" value="'+dateVal(f.birth)+'"></div>'+
    '<div class="field"><label class="lbl" for="fi-in">Entrada no tanque</label><input id="fi-in" type="date" value="'+dateVal(f.entry)+'"></div>'+
    '<div class="field"><label class="lbl" for="fi-count">Nº de peixes</label><input id="fi-count" type="number" inputmode="numeric" min="0" value="'+(f.count||"")+'"></div>'+
    '<div class="field"><label class="lbl" for="fi-lote">Lote</label><input id="fi-lote" maxlength="40" value="'+v(f.lote)+'"></div>'+
    '<div class="field full"><label class="lbl" for="fi-orig">Origem</label><input id="fi-orig" maxlength="60" placeholder="Ex.: maternidade, fornecedor…" value="'+v(f.origin)+'"></div>'+
   '</div>'+
   '<div class="fsec">Condições do tanque</div><div class="formgrid">'+
    '<div class="field"><label class="lbl" for="fi-temp">Temperatura (°C)</label><input id="fi-temp" type="number" inputmode="decimal" step="0.1" value="'+(f.temp!=null?f.temp:"")+'"></div>'+
    '<div class="field"><label class="lbl" for="fi-sal">Salinidade (‰)</label><input id="fi-sal" type="number" inputmode="decimal" step="0.1" value="'+(f.sal!=null?f.sal:"")+'"></div>'+
    '<div class="field"><label class="lbl" for="fi-o2">Oxigénio (mg/L)</label><input id="fi-o2" type="number" inputmode="decimal" step="0.1" value="'+(f.o2!=null?f.o2:"")+'"></div>'+
    '<div class="field"><label class="lbl" for="fi-feed">Alimentação</label><input id="fi-feed" maxlength="60" placeholder="Ex.: ração 2 mm, 3×/dia" value="'+v(f.feed)+'"></div>'+
   '</div>'+
   '<div class="field"><label class="lbl" for="fi-notes">Notas (visíveis na ficha)</label><textarea id="fi-notes" maxlength="400" style="min-height:60px">'+v(f.notes)+'</textarea></div>'+
   '<div class="row" style="margin-bottom:18px"><button class="btn" id="fi-save" style="flex:1">Guardar ficha</button><a class="btn ghost" style="text-decoration:none" href="'+esc(fichaUrl(id))+'" target="_blank" rel="noopener">Ver pública</a></div>'+
   '<div class="fsec">Fotografias</div>'+
   '<div class="wform up-form"><div class="pchips" id="fi-cats">'+PHOTO_CATS.map(function(c){return '<button class="pchip'+(photoCat===c.k?' on':'')+'" data-pc="'+c.k+'">'+c.label+'</button>'}).join("")+'</div>'+
     '<div class="formgrid"><div class="field"><label class="lbl" for="fi-pcap">Legenda (opcional)</label><input id="fi-pcap" maxlength="80" placeholder="Ex.: amostragem de outubro"></div>'+
     '<div class="field"><label class="lbl" for="fi-pdate">Data da fotografia</label><input id="fi-pdate" type="date" value="'+dateVal(Date.now())+'"></div></div>'+
     '<label class="btn purple up-btn" for="fi-files">＋ Adicionar fotografias</label><input id="fi-files" type="file" accept="image/*" multiple hidden>'+
     '<p class="hint" id="fi-up-status" style="margin:8px 0 0"></p></div>'+
   '<div id="fi-gallery"></div>'+
   '<div class="fsec" style="margin-top:18px">Pesagens</div>'+
   '<div class="wform"><div class="formgrid">'+
     '<div class="field"><label class="lbl" for="pw-d">Data</label><input id="pw-d" type="date" value="'+dateVal(Date.now())+'"></div>'+
     '<div class="field"><label class="lbl" for="pw-n">Amostra (nº)</label><input id="pw-n" type="number" inputmode="numeric" min="0" placeholder="Opcional"></div>'+
     '<div class="field"><label class="lbl" for="pw-w">Peso médio (g)</label><input id="pw-w" type="number" inputmode="decimal" min="0" step="0.1"></div>'+
     '<div class="field"><label class="lbl" for="pw-l">Tamanho médio (cm)</label><input id="pw-l" type="number" inputmode="decimal" min="0" step="0.1"></div>'+
   '</div><button class="btn purple" id="pw-add" style="width:100%">+ Registar pesagem</button></div>'+
   (P.length?'<table class="htable" style="margin-top:10px"><thead><tr><th>Data</th><th style="text-align:right">Peso</th><th style="text-align:right">Tamanho</th><th></th></tr></thead><tbody>'+
     P.map(function(w){return '<tr><td>'+fmtDate(w.t)+(w.n?'<div class="sub">amostra '+num(w.n,0)+'</div>':'')+(w.by?'<div class="sub">por '+esc(w.by)+'</div>':'')+'</td><td style="text-align:right">'+(w.weight?num(w.weight)+' g':'—')+'</td><td style="text-align:right">'+(w.length?num(w.length)+' cm':'—')+'</td><td style="text-align:right"><button class="linkbtn" data-pwdel="'+esc(w.id)+'" title="Apagar">×</button></td></tr>'}).join("")+'</tbody></table>':'<p class="hint" style="margin-top:8px">Ainda sem pesagens.</p>');
  openSheet("Ficha · "+esc(t.label),f.updatedAt?"Atualizada em "+fmt(f.updatedAt)+(f.by?" por "+esc(f.by):""):"Ficha nova",body,function(m){
        function read(){
      f.species=$("fi-sp").value.trim();f.sci=$("fi-sci").value.trim();f.about=$("fi-about").value.trim();
      f.birth=parseDate($("fi-birth").value);f.entry=parseDate($("fi-in").value);f.count=Math.max(0,parseInt($("fi-count").value,10)||0);
      f.lote=$("fi-lote").value.trim();f.origin=$("fi-orig").value.trim();f.notes=$("fi-notes").value.trim();f.feed=$("fi-feed").value.trim();
      var nt=numIn("fi-temp"),ns=numIn("fi-sal"),no=numIn("fi-o2");
      if(nt!==(f.temp==null?null:f.temp)||ns!==(f.sal==null?null:f.sal)||no!==(f.o2==null?null:f.o2))f.condAt=Date.now();
      f.temp=nt;f.sal=ns;f.o2=no;
    }
    function save(msg){
      read();var cur=fichaOf(id);if(cur&&cur.cover)f.cover=cur.cover;
      f.updatedAt=Date.now();f.by=me?me.name:"";fichas()[id]=clean(f);
      var td=tankData(id);if(f.species&&td.species!==f.species){td.species=f.species;td.updatedAt=Date.now()}
      logTo(td,msg);persist(t.label+": "+msg.toLowerCase());
    }
    $("fi-save").onclick=function(){save("Ficha atualizada");closeSheet();fichaOpenId=null;if(ui.tab==="fichas")viewFichas()};
    $("pw-add").onclick=function(){
      var w=numIn("pw-w"),l=numIn("pw-l"),n=parseInt($("pw-n").value,10),d=parseDate($("pw-d").value)||Date.now();
      if(!(w>0)&&!(l>0)){toast("Indique o peso médio ou o tamanho");return}
      read();f.pesagens.push({id:newId("w"),t:d,weight:w>0?Math.round(w*10)/10:0,length:l>0?Math.round(l*10)/10:0,n:n>0?n:0,by:me?me.name:""});
      save("Pesagem registada"+(w>0?": "+num(w)+" g":"")+(l>0?" · "+num(l)+" cm":""));openFicha(id);if(ui.tab==="fichas")viewFichas();
    };
    document.querySelectorAll("[data-pwdel]").forEach(function(b){b.onclick=function(){if(!b.dataset.c){b.dataset.c=1;b.textContent="apagar?";b.style.color="var(--alert)";return}
      read();f.pesagens=f.pesagens.filter(function(w){return w.id!==b.dataset.pwdel});save("Pesagem apagada");openFicha(id);if(ui.tab==="fichas")viewFichas()}});
    document.querySelectorAll("[data-pc]").forEach(function(b){b.onclick=function(){photoCat=b.dataset.pc;document.querySelectorAll("[data-pc]").forEach(function(x){x.classList.toggle("on",x===b)})}});
    $("fi-files").onchange=function(){
      var files=this.files,cap=$("fi-pcap").value.trim(),when=parseDate($("fi-pdate").value)||Date.now(),lbl=document.querySelector(".up-btn");
      if(!files||!files.length)return;lbl.classList.add("busy");
      uploadPhotos(id,files,photoCat,cap,when).then(function(){lbl.classList.remove("busy");$("fi-files").value="";$("fi-pcap").value=""});
    };
    renderFichaGallery(id);
  });
}

/* ================= Registos diários (painel lateral do Mapa): oxigénio e alimentação =================
   Um documento por dia em "diario/AAAA-MM-DD":
     {d, r:{R1:{o2,sat,temp,sp,t,by}}, al:{R1:{items:{"7mmSH Sparos":800}, t, by}}, _mod}
   Lista de alimentos em "diario/_config" {foods:[...]} ("—" = coluna vazia no Excel).
   Leituras: 1 por dia aberto (+ alterações), 1 do dia anterior, 1 da lista de alimentos. */
var OXY_F=[{k:"o2",label:"O₂",unit:"mg/L"},{k:"sat",label:"Sat.",unit:"%"},{k:"temp",label:"Temp.",unit:"°C"}];
var DEFAULT_FOODS=["22mm Sparus","7mmSH Sparos","7mm seca Sparos","Mar-17 Vitalis Repro","Mar-9 Vitalis Prima","Mar-22 Vitalis Prima","Mar-9 Vitalis Repro","Pota","Cavala","Douradinhas","Carapau","Sardinha","8mm Aquasoja","—","Mexilhão","Poliquetas"];
var dToday=null,dTodayKey="",dTodayOn=false,dDay=null,dPrev=null,dDate="",dUnsub=null,dMode="oxy",dFoods=null,dOpen=false;
var LASTFOOD_KEY="mwg_lastfood";
function todayKey(){return dateVal(Date.now())}
function dayShift(k,n){var d=new Date(k+"T12:00:00");d.setDate(d.getDate()+n);return dateVal(d.getTime())}
var GORDER={R:0,Text:1,P:2,PP:3};
function byGroup(a,b){return (GORDER[a.group]-GORDER[b.group])||natural(a,b)}
function dTanks(){return TANKS.filter(function(t){return peek(t.id).status!=="empty"}).sort(byGroup)}
function oxyHas(r){return !!r&&(r.o2!=null||r.sat!=null||r.temp!=null)}
function alItems(a){var o={};if(a&&a.items)Object.keys(a.items).forEach(function(k){var g=a.items[k];if(g!=null&&g>0)o[k]=g});return o}
function alHas(a){return Object.keys(alItems(a)).length>0}
function oxyLow(r){return !!r&&((r.o2!=null&&r.o2<5)||(r.sat!=null&&r.sat<70))}
function dCount(day,which){var T=dTanks();if(!day)return 0;return T.filter(function(t){return which==="oxy"?oxyHas((day.r||{})[t.id]):alHas((day.al||{})[t.id])}).length}
function foodsList(){return (dFoods||DEFAULT_FOODS).filter(function(f){return f&&f!=="—"})}
function loadFoods(){if(dFoods)return Promise.resolve(dFoods);return FB.getDoc(FB.doc(FB.db,"diario/_config")).then(function(s){dFoods=s.exists()&&s.data().foods&&s.data().foods.length?s.data().foods:DEFAULT_FOODS.slice();return dFoods}).catch(function(){dFoods=DEFAULT_FOODS.slice();return dFoods})}
function lastFood(id){var m=lsGet(LASTFOOD_KEY)||{};return m[id]||""}
function setLastFood(id,f){var m=lsGet(LASTFOOD_KEY)||{};m[id]=f;lsSet(LASTFOOD_KEY,m)}
function ensureDToday(){
  var k=todayKey();if(dTodayOn&&dTodayKey===k||!FB.db)return;
  dTodayOn=true;dTodayKey=k;
  unsubs.push(FB.onSnapshot(FB.doc(FB.db,"diario/"+k),function(s){if(dTodayKey!==k)return;dToday=s.exists()?s.data():null;updateDBtn()},function(){}));
}
var DIARY_ICON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 10h16M8 14h3M8 17.5h6"/></svg>';
function dBtnHtml(){var tot=dTanks().length,o=dCount(dToday,"oxy"),a=dCount(dToday,"al"),done=tot&&o>=tot&&a>=tot,left=Math.max(0,tot-o)+Math.max(0,tot-a);
  return '<button class="dhandle'+(done?' done':'')+'" id="d-open" title="Registos diários — Oxigénio '+o+'/'+tot+' · Alimentação '+a+'/'+tot+'" aria-label="Abrir registos diários">'+DIARY_ICON+
    '<span class="dh-txt">Registos diários</span><span class="dh-st'+(done?'':' todo')+'">'+(done?'✓':'')+'</span></button>'}
function updateDBtn(){var b=$("d-open");if(b){b.outerHTML=dBtnHtml();bindDBtn()}}
function bindDBtn(){var b=$("d-open");if(b)b.onclick=function(){openDiary(todayKey())}}

function fmtNum(v){return v==null?"":String(v).replace(".",",")}
function readNum(el){var s=String(el.value).replace(",",".").trim();if(s==="")return null;var n=parseFloat(s);return isFinite(n)?Math.round(n*100)/100:null}
function longDay(k){return new Date(k+"T12:00:00").toLocaleDateString("pt-PT",{weekday:"long",day:"numeric",month:"long"})}

/* ---- Painel lateral ---- */
function closeDiary(){var d=$("drawer");if(d){d.classList.remove("open");setTimeout(function(){if(!dOpen&&d.parentNode)d.remove()},250)}dOpen=false;if(dUnsub){dUnsub();dUnsub=null}document.body.classList.remove("drawer-on")}
function openDiary(k){
  dDate=k;dDay=null;dPrev=null;if(dUnsub){dUnsub();dUnsub=null}
  var d=$("drawer");
  if(!d){d=document.createElement("div");d.id="drawer";d.innerHTML='<div class="dr-bg"></div><aside class="dr" role="dialog" aria-label="Registos diários"></aside>';document.body.appendChild(d);
    d.querySelector(".dr-bg").onclick=closeDiary;
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&dOpen&&!$("fmodal"))closeDiary()});}
  dOpen=true;document.body.classList.add("drawer-on");
  requestAnimationFrame(function(){d.classList.add("open")});
  var isToday=k===todayKey();
  d.querySelector(".dr").innerHTML='<div class="dr-h"><div><h2>Registos diários</h2><p>'+(isToday?"Hoje, ":"")+longDay(k)+'</p></div><button class="iconbtn" id="d-x" aria-label="Fechar">×</button></div>'+
    '<div class="dr-tools"><div class="oxy-date"><button class="iconbtn sm" id="d-prev" aria-label="Dia anterior">‹</button><input type="date" id="d-d" value="'+k+'" max="'+todayKey()+'"><button class="iconbtn sm" id="d-next" aria-label="Dia seguinte"'+(isToday?' disabled':'')+'>›</button></div>'+
      '<div class="seg" id="d-seg"><button data-dm="oxy">Oxigénio <b id="d-no"></b></button><button data-dm="al">Alimentação <b id="d-na"></b></button></div></div>'+
    '<div class="dr-body" id="d-body"><div class="skel" style="height:40px;margin:14px 0"></div></div>'+
    '<div class="dr-foot"><input type="month" id="d-m" value="'+k.slice(0,7)+'" max="'+todayKey().slice(0,7)+'"><button class="btn ghost" id="d-xls">Descarregar Excel</button><span class="hint" id="d-xs"></span></div>';
  $("d-x").onclick=closeDiary;
  $("d-d").onchange=function(){var v=this.value;if(v&&v<=todayKey())openDiary(v)};
  $("d-prev").onclick=function(){openDiary(dayShift(k,-1))};
  $("d-next").onclick=function(){var n=dayShift(k,1);if(n<=todayKey())openDiary(n)};
  d.querySelectorAll("[data-dm]").forEach(function(b){b.onclick=function(){dMode=b.dataset.dm;renderDiaryBody()}});
  $("d-xls").onclick=function(){exportDiary($("d-m").value)};
  loadFoods().then(function(){
    if(!dOpen||dDate!==k)return;
    dUnsub=FB.onSnapshot(FB.doc(FB.db,"diario/"+k),function(s){dDay=s.exists()?s.data():null;if(!$("d-body").dataset.ready)renderDiaryBody();else fillDiary()},function(e){$("d-body").innerHTML='<p class="empty">Não foi possível ler os registos ('+esc(e&&e.code||e)+'). Confirme se as regras do Firebase incluem <b>diario</b>.</p>'});
    FB.getDoc(FB.doc(FB.db,"diario/"+dayShift(k,-1))).then(function(s){dPrev=s.exists()?s.data():null;if($("d-body").dataset.ready)fillDiary(true)}).catch(function(){});
  });
}
function renderDiaryBody(){
  var B=$("d-body");if(!B)return;B.dataset.ready=1;
  document.querySelectorAll("[data-dm]").forEach(function(b){b.classList.toggle("on",b.dataset.dm===dMode)});
  var T=dTanks();
  if(!T.length){B.innerHTML='<p class="empty">Não há tanques com peixe.</p>';return}
  if(dMode==="oxy"){
    B.innerHTML='<p class="hint dr-hint">Grava sozinho ao passar ao campo seguinte. A cinzento: valor do dia anterior.</p>'+
      '<div class="oxy-head"><span>Tanque</span>'+OXY_F.map(function(f){return '<span>'+f.label+' <small>'+f.unit+'</small></span>'}).join("")+'<span></span></div>'+
      T.map(function(t){var sp=peek(t.id).species||"";
        return '<div class="oxy-row" data-ot="'+t.id+'"><div class="oxy-t"><b>'+esc(t.label)+'</b>'+(sp?'<small>'+esc(sp)+'</small>':'')+'</div>'+
          OXY_F.map(function(f){return '<input class="oxy-in" data-f="'+f.k+'" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="'+f.label+' '+esc(t.label)+'">'}).join("")+
          '<span class="oxy-ok"></span></div>'}).join("");
  } else {
    B.innerHTML='<p class="hint dr-hint">Escolha o alimento e escreva os gramas. Fica sugerido o último alimento dado a cada tanque; a cinzento, os gramas do dia anterior.'+(readOnly?'':' <button class="linkbtn" id="d-foods">Editar lista de alimentos</button>')+'</p>'+
      T.map(function(t){var sp=peek(t.id).species||"";
        return '<div class="al-row" data-ot="'+t.id+'"><div class="oxy-t"><b>'+esc(t.label)+'</b>'+(sp?'<small>'+esc(sp)+'</small>':'')+'</div><div class="al-lines"></div><span class="oxy-ok"></span></div>'}).join("");
    var fb=$("d-foods");if(fb)fb.onclick=editFoods;
  }
  fillDiary(true);bindDiaryInputs();
}
function foodOptions(sel){var L=foodsList();if(sel&&L.indexOf(sel)<0)L=[sel].concat(L);
  return '<option value=""'+(sel?'':' selected')+'>Alimento…</option>'+L.map(function(f){return '<option'+(f===sel?' selected':'')+'>'+esc(f)+'</option>'}).join("")}
function alLineHtml(food,g,ph){return '<div class="al-line"><select class="al-f">'+foodOptions(food)+'</select><input class="al-g oxy-in" inputmode="numeric" enterkeyhint="next" autocomplete="off" value="'+(g!=null?g:"")+'" placeholder="'+(ph!=null?ph:"")+'"><span class="al-u">g</span><button class="al-x" aria-label="Remover">×</button></div>'}
function fillDiary(force){
  var B=$("d-body");if(!B)return;
  var no=$("d-no"),na=$("d-na"),tot=dTanks().length;if(no)no.textContent=dCount(dDay,"oxy")+"/"+tot;if(na)na.textContent=dCount(dDay,"al")+"/"+tot;
  B.querySelectorAll("[data-ot]").forEach(function(row){
    var id=row.dataset.ot,pt=+row.dataset.pt||0;
    if(dMode==="oxy"){
      var r=(dDay&&dDay.r||{})[id],p=(dPrev&&dPrev.r||{})[id];
      if(pt){if((pt<0&&!oxyHas(r))||(pt>0&&r&&r.t>=pt))row.dataset.pt="";else return}
      row.querySelectorAll(".oxy-in").forEach(function(el){var f=el.dataset.f;if(document.activeElement!==el)el.value=r&&r[f]!=null?fmtNum(r[f]):"";el.placeholder=p&&p[f]!=null?fmtNum(p[f]):""});
      row.classList.toggle("saved",oxyHas(r));row.classList.toggle("low",oxyLow(r));
      var ok=row.querySelector(".oxy-ok");ok.textContent=oxyLow(r)?"!":(oxyHas(r)?"✓":"");ok.title=r&&r.by?"Registado por "+r.by:"";
    } else {
      var a=(dDay&&dDay.al||{})[id],pa=alItems((dPrev&&dPrev.al||{})[id]),items=alItems(a);
      if(pt){if((pt<0&&!alHas(a))||(pt>0&&a&&a.t>=pt))row.dataset.pt="";else return}
      if(!force&&row.contains(document.activeElement))return;
      var L=row.querySelector(".al-lines"),keys=Object.keys(items),html;
      if(keys.length)html=keys.map(function(f){return alLineHtml(f,items[f],pa[f])}).join("");
      else{var pk=Object.keys(pa),f0=pk[0]||lastFood(id);html=pk.length?pk.map(function(f){return alLineHtml(f,null,pa[f])}).join(""):alLineHtml(f0,null,null)}
      L.innerHTML=html+(readOnly?'':'<button class="linkbtn al-add">+ outro alimento</button>');
      row.classList.toggle("saved",keys.length>0);
      var ok2=row.querySelector(".oxy-ok");ok2.textContent=keys.length?"✓":"";ok2.title=a&&a.by?"Registado por "+a.by:"";
      if(readOnly)row.querySelectorAll("input,select").forEach(function(i){i.disabled=true});
    }
  });
}
function bindDiaryInputs(){
  var B=$("d-body");if(!B||B.dataset.bound)return;B.dataset.bound=1;
  function inputs(){return Array.prototype.slice.call(B.querySelectorAll(".oxy-in"))}
  B.addEventListener("keydown",function(e){if(e.key!=="Enter"||!e.target.classList.contains("oxy-in"))return;e.preventDefault();var L=inputs(),i=L.indexOf(e.target),n=L[i+1];if(n){n.focus();n.select&&n.select()}else e.target.blur()});
  B.addEventListener("focusin",function(e){if(e.target.matches("input,select"))e.target.dataset.v=e.target.value});
  B.addEventListener("focusout",function(e){var el=e.target;if(!el.matches("input"))return;if(el.value===el.dataset.v)return;var row=el.closest("[data-ot]");if(dMode==="oxy")saveOxyRow(row);else saveAlRow(row)});
  B.addEventListener("change",function(e){if(!e.target.classList.contains("al-f"))return;var row=e.target.closest("[data-ot]"),g=e.target.parentNode.querySelector(".al-g");
    if(e.target.value)setLastFood(row.dataset.ot,e.target.value);if(g.value.trim())saveAlRow(row);else g.focus()});
  B.addEventListener("click",function(e){
    if(e.target.classList.contains("al-add")){var L=e.target.parentNode;e.target.insertAdjacentHTML("beforebegin",alLineHtml("",null,null));L.querySelectorAll(".al-f")[L.querySelectorAll(".al-f").length-1].focus()}
    else if(e.target.classList.contains("al-x")){var row=e.target.closest("[data-ot]"),line=e.target.parentNode,had=line.querySelector(".al-g").value.trim();
      if(row.querySelectorAll(".al-line").length>1)line.remove();else{line.querySelector(".al-g").value=""}
      if(had)saveAlRow(row)}
  });
}
function canEditDay(){if(readOnly){toast("Só leitura — não tem permissão para alterar");return false}return true}
function writeDay(row,upd,label){
  setSave("saving","A guardar…");
  return FB.setDoc(FB.doc(FB.db,"diario/"+dDate),upd,{merge:true}).then(function(){idleSave()})
    .catch(function(e){row.dataset.pt="";idleSave();toast("Não foi possível guardar "+label+": "+(e&&e.code||e))});
}
function saveOxyRow(row){
  if(!canEditDay())return;
  var id=row.dataset.ot,rec={},any=false;
  row.querySelectorAll(".oxy-in").forEach(function(el){var v=readNum(el);rec[el.dataset.f]=v;if(v!=null)any=true});
  var k=dDate,val=any?{o2:rec.o2,sat:rec.sat,temp:rec.temp,sp:peek(id).species||"",t:Date.now(),by:me?me.name:""}:null;
  var upd={d:k,_mod:Date.now(),r:{}};upd.r[id]=val;row.dataset.pt=val?val.t:-1;
  writeDay(row,upd,BYID[id].label).then(function(){
    if(val&&oxyLow(val))toast(BYID[id].label+": oxigénio baixo ("+(val.o2!=null&&val.o2<5?fmtNum(val.o2)+" mg/L":fmtNum(val.sat)+" %")+")");
    if(val&&k===todayKey()&&fichaOf(id)){var f=fichaOf(id),ch=false;
      if(val.temp!=null&&f.temp!==val.temp){f.temp=val.temp;ch=true}
      if(val.o2!=null&&f.o2!==val.o2){f.o2=val.o2;ch=true}
      if(ch){f.condAt=Date.now();persist(null)}}
  });
}
function saveAlRow(row){
  if(!canEditDay())return;
  var id=row.dataset.ot,items={},any=false;
  row.querySelectorAll(".al-line").forEach(function(l){var f=l.querySelector(".al-f").value,g=readNum(l.querySelector(".al-g"));if(f&&g!=null&&g>0){items[f]=Math.round((items[f]||0)+g);any=true}});
  var old=alItems((dDay&&dDay.al||{})[id]);Object.keys(old).forEach(function(f){if(!(f in items))items[f]=null});
  var t=Date.now(),upd={d:dDate,_mod:t,al:{}};upd.al[id]={items:items,t:t,by:me?me.name:""};row.dataset.pt=any?t:-1;
  Object.keys(items).forEach(function(f){if(items[f])setLastFood(id,f)});
  writeDay(row,upd,BYID[id].label);
}
function editFoods(){
  var cur=(dFoods||DEFAULT_FOODS).join("\n");
  openSheet("Lista de alimentos","Uma linha por alimento, pela ordem das colunas do Excel. Escreva — para deixar uma coluna vazia.",
    '<textarea id="fd-t" style="min-height:300px;font-size:15px;line-height:1.5">'+esc(cur)+'</textarea><div class="row" style="margin-top:12px"><button class="btn" id="fd-ok" style="flex:1">Guardar lista</button><button class="btn ghost" id="fd-def">Repor lista original</button></div>',function(){
    $("fd-def").onclick=function(){$("fd-t").value=DEFAULT_FOODS.join("\n")};
    $("fd-ok").onclick=function(){
      var L=$("fd-t").value.split("\n").map(function(x){return x.trim().replace(/^-+$/,"—")}).filter(function(x,i,a){return x&&(x==="—"||a.indexOf(x)===i)});
      if(!L.filter(function(x){return x!=="—"}).length){toast("A lista não pode ficar vazia");return}
      FB.setDoc(FB.doc(FB.db,"diario/_config"),{foods:L,_mod:Date.now(),by:me?me.name:""}).then(function(){dFoods=L;closeSheet();toast("Lista de alimentos guardada");renderDiaryBody()}).catch(function(e){toast("Erro: "+(e&&e.code||e))});
    };
  });
}

/* ---- Exportação para Excel: uma folha por tanque no formato do Excel do trabalho ---- */
function exportDiary(month){
  if(!month)return;var st=$("d-xs"),from=month+"-01",to=month+"-31";st.textContent="A preparar…";
  Promise.all([loadFoods(),FB.getDocs(FB.query(FB.collection(FB.db,"diario"),FB.where("d",">=",from)))]).then(function(res){
    var foods=res[0],snap=res[1],days=[];snap.forEach(function(d){var x=d.data();if(x.d&&x.d<=to)days.push(x)});
    days.sort(function(a,b){return a.d<b.d?-1:1});
    var ids={},extra={};days.forEach(function(d){
      Object.keys(d.r||{}).forEach(function(id){if(oxyHas(d.r[id]))ids[id]=1});
      Object.keys(d.al||{}).forEach(function(id){var it=alItems(d.al[id]);if(Object.keys(it).length){ids[id]=1;Object.keys(it).forEach(function(f){if(foods.indexOf(f)<0)extra[f]=1})}});
    });
    var cols=Object.keys(ids).filter(function(id){return BYID[id]}).map(function(id){return BYID[id]}).sort(byGroup);
    if(!cols.length){st.textContent="Não há registos em "+monthLabel(month,true)+".";return}
    var F=foods.concat(Object.keys(extra));
    var p=month.split("-"),dim=new Date(+p[0],+p[1],0).getDate(),byDay={};days.forEach(function(d){byDay[+d.d.slice(8,10)]=d});
    var mes="Mês : "+MES_L[+p[1]-1].charAt(0).toUpperCase()+MES_L[+p[1]-1].slice(1)+" "+p[0];
    function dt(k){return{date:new Date(k+"T12:00:00").getTime()}}
    var sheets=cols.map(function(t){
      var f=fichaOf(t.id)||{},sp=f.sci||f.species||peek(t.id).species||"",H=function(v){return{v:v,s:4}};
      var r1=[H("TANQUE:"),H(""),H(t.label),H("Lote:"),H(f.lote||""),H("")].concat(F.map(function(){return H("")}));
      var r2=[H("ESPÉCIE:"),H(""),{v:sp,s:5},H(""),H(""),H("")].concat(F.map(function(x,i){return i===0?{v:mes,s:5}:H("")}));
      var head=["Dia","N.º Ind","O2mg/l","O2Sat %","T.ºC","Sat% calculada"].concat(F.map(function(x){return x==="—"?"":x})).map(function(h){return{v:h,s:6}});
      var rows=[r1,r2,[],["",{v:"Ração: "+(f.feed||""),s:9}],["","","","","","",{v:"Alimento (g)",s:9}],head],tot=F.map(function(){return 0});
      for(var i=1;i<=dim;i++){var dd=byDay[i]||{},r=(dd.r||{})[t.id]||{},it=alItems((dd.al||{})[t.id]);
        rows.push([{v:i,s:7},{v:"",s:8},{v:r.o2!=null?r.o2:"",s:8},{v:r.sat!=null?r.sat:"",s:8},{v:r.temp!=null?r.temp:"",s:8},{v:"",s:8}].concat(F.map(function(x,j){var g=x==="—"?null:it[x];if(g)tot[j]+=g;return{v:g||"",s:8}})))}
      rows.push([{v:"Total",s:6},{v:"",s:6},{v:"",s:6},{v:"",s:6},{v:"",s:6},{v:"",s:6}].concat(tot.map(function(g,j){return{v:F[j]==="—"||!g?"":g,s:6}})));
      return{name:t.label,plain:true,widths:[8,9,10,10,9,14].concat(F.map(function(x){return x==="—"?6:Math.max(11,Math.min(22,x.length+2))})),rows:rows};
    });
    var ox=[["Data","Tanque","Espécie","O2 (mg/L)","Saturação (%)","Temperatura (°C)","Hora","Registado por"]],al=[["Data","Tanque","Espécie","Alimento","Gramas","Registado por"]];
    days.forEach(function(d){cols.forEach(function(t){var r=(d.r||{})[t.id];
      if(oxyHas(r))ox.push([dt(d.d),t.label,r.sp||"",r.o2!=null?r.o2:"",r.sat!=null?r.sat:"",r.temp!=null?r.temp:"",r.t?new Date(r.t).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}):"",r.by||""]);
      var a=(d.al||{})[t.id],it=alItems(a);Object.keys(it).forEach(function(f){al.push([dt(d.d),t.label,peek(t.id).species||"",f,it[f],a.by||""])});
    })});
    sheets.push({name:"Oxigénio (lista)",widths:[12,9,18,10,13,16,8,16],rows:ox},{name:"Alimentação (lista)",widths:[12,9,18,22,10,16],rows:al});
    var blob=makeXlsx(sheets),a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download="Registos_diarios_"+month+".xlsx";document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},4000);
    st.textContent=cols.length+(cols.length===1?" tanque":" tanques")+", "+days.length+(days.length===1?" dia":" dias")+".";
  }).catch(function(e){st.textContent="Erro: "+(e&&e.code||e)});
}

/* ================= Login, registo e aprovação ================= */
var LOGO='<div class="logo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>';
var EYE='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
var EYE_OFF='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7c1.9 0 3.5-.5 4.9-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';
var ROLE_L={pending:"A aguardar",viewer:"Só leitura",editor:"Editor",admin:"Administrador"};
var meUnsub=null,pendUnsub=null,pendingCount=0,authUser=null,entered=false,regName="";
function authShell(inner){root.innerHTML='<div class="auth"><div class="auth-card"><div class="auth-logo"><img src="icon-192.png" alt="MyWorkGuru" width="96" height="96"></div>'+inner+'</div></div><div class="toast" id="toast"></div>'}
function showAuthMsg(m){authShell('<p class="auth-p">'+esc(m)+'</p><button class="btn ghost wide" id="a-out">Terminar sessão</button>');$("a-out").onclick=doSignOut}
function authErr(e){var c=(e&&e.code)||"";return({
  "auth/invalid-credential":"Email ou palavra-passe errados.","auth/wrong-password":"Email ou palavra-passe errados.","auth/user-not-found":"Não existe conta com esse email.",
  "auth/email-already-in-use":"Já existe uma conta com esse email. Use “Entrar”.","auth/weak-password":"A palavra-passe tem de ter pelo menos 6 caracteres.",
  "auth/invalid-email":"O email não é válido.","auth/too-many-requests":"Demasiadas tentativas. Espere um pouco e tente outra vez.",
  "auth/network-request-failed":"Sem ligação à internet.","auth/missing-password":"Escreva a palavra-passe."
})[c]||("Erro: "+(c||e))}
function viewAuth(mode){
  mode=mode||"login";var reg=mode==="register",reset=mode==="reset";
  authShell('<h1 class="auth-h">'+(reg?'Criar conta':reset?'Recuperar palavra-passe':'Entrar')+'</h1>'+
    (reg?'<p class="auth-p">Depois de criar a conta, o administrador tem de aprovar o seu acesso.</p>':'')+
    (reset?'<p class="auth-p">Enviamos-lhe um email com um link para escolher uma nova palavra-passe.</p>':'')+
    '<form id="a-form" novalidate>'+
    (reg?'<div class="field"><label class="lbl" for="a-name">Nome</label><input id="a-name" autocomplete="name" maxlength="40" required></div>':'')+
    '<div class="field"><label class="lbl" for="a-email">Email</label><input id="a-email" type="email" autocomplete="email" inputmode="email" required></div>'+
    (reset?'':'<div class="field"><label class="lbl" for="a-pass">Palavra-passe'+(reg?' <span class="lbl-note">(mínimo 6 caracteres)</span>':'')+'</label><div class="pwwrap"><input id="a-pass" type="password" autocomplete="'+(reg?'new-password':'current-password')+'" minlength="6" required><button type="button" class="pweye" id="a-eye" aria-label="Mostrar palavra-passe" title="Mostrar palavra-passe">'+EYE+'</button></div></div>')+
    '<p class="auth-err" id="a-err"></p>'+
    '<button class="btn wide" id="a-go" type="submit">'+(reg?'Criar conta':reset?'Enviar email':'Entrar')+'</button></form>'+
    '<div class="auth-links">'+(mode!=="login"?'<button class="linkbtn" data-m="login">Já tenho conta — entrar</button>':'<button class="linkbtn" data-m="register">Criar conta nova</button><button class="linkbtn" data-m="reset">Esqueci-me da palavra-passe</button>')+'</div>');
  document.querySelectorAll("[data-m]").forEach(function(b){b.onclick=function(){viewAuth(b.dataset.m)}});
  var eye=$("a-eye");if(eye)eye.onclick=function(){var i=$("a-pass"),show=i.type==="password";i.type=show?"text":"password";eye.innerHTML=show?EYE_OFF:EYE;eye.setAttribute("aria-label",show?"Esconder palavra-passe":"Mostrar palavra-passe");eye.title=eye.getAttribute("aria-label");eye.classList.toggle("on",show);i.focus()};
  $("a-form").onsubmit=function(e){
    e.preventDefault();var err=$("a-err"),go=$("a-go"),email=$("a-email").value.trim();err.textContent="";
    if(reg&&!$("a-name").value.trim()){err.textContent="Escreva o seu nome.";return}
    go.disabled=true;
    var p;
    if(reset)p=FB.sendPasswordResetEmail(FB.auth,email).then(function(){err.className="auth-ok";err.textContent="Email enviado. Veja a caixa de entrada (e o spam)."});
    else if(reg){regName=$("a-name").value.trim();p=FB.createUserWithEmailAndPassword(FB.auth,email,$("a-pass").value).then(function(c){var nm=$("a-name").value.trim();return FB.updateProfile(c.user,{displayName:nm}).then(function(){return ensureProfile(c.user,nm)}).then(function(d){if(d&&d.name!==nm)return FB.updateDoc(FB.doc(FB.db,"users/"+c.user.uid),{name:nm})})})}
    else p=FB.signInWithEmailAndPassword(FB.auth,email,$("a-pass").value);
    p.catch(function(e2){err.className="auth-err";err.textContent=authErr(e2)}).then(function(){go.disabled=false});
  };
}
function ensureProfile(user,name){
  var ref=FB.doc(FB.db,"users/"+user.uid);
  return FB.getDoc(ref).then(function(s){if(s.exists())return s.data();var d={name:name||regName||user.displayName||(user.email||"").split("@")[0],email:user.email||"",role:"pending",createdAt:Date.now()};return FB.setDoc(ref,d).then(function(){return d})});
}
var ME_KEY="mwg_me_";
function enterApp(){
  readOnly=me.role==="viewer";document.body.classList.toggle("ro",readOnly);
  if(!entered){entered=true;if(!$("view"))authShell('<p class="auth-p">A carregar dados…</p>');startData();if(isAdminUser&&!pendUnsub)watchPending()}
  else if($("view")){render()}
}
function onAuth(user){
  authUser=user;if(meUnsub){meUnsub();meUnsub=null}if(pendUnsub){pendUnsub();pendUnsub=null}
  if(!user){me=null;isAdminUser=false;entered=false;stopData();document.body.classList.remove("ro");viewAuth("login");return}
  // Arranque rápido: se este telemóvel já conhece o acesso desta conta, mostra logo os dados guardados
  // e confirma as permissões em segundo plano (quem manda continua a ser o Firebase).
  var cached=lsGet(ME_KEY+user.uid);
  if(cached&&cached.role&&cached.role!=="pending"){me=cached;isAdminUser=!!cached.admin;enterApp()}
  else authShell('<p class="auth-p">A entrar…</p>');
  Promise.all([ensureProfile(user),FB.getDoc(FB.doc(FB.db,"config/admin"))]).then(function(r){
    var a=r[1];
    if(!a.exists()){entered=false;stopData();lsSet(ME_KEY+user.uid,null);viewClaim();return}
    isAdminUser=a.data().uid===user.uid;
    meUnsub=FB.onSnapshot(FB.doc(FB.db,"users/"+user.uid),function(s){
      if(!s.exists()){entered=false;stopData();lsSet(ME_KEY+user.uid,null);showAuthMsg("O seu pedido de acesso foi recusado ou o acesso foi removido.");return}
      var d=s.data(),prevRole=me&&me.role;
      me={uid:user.uid,name:d.name||user.displayName||"",email:d.email,role:isAdminUser?"admin":d.role,admin:isAdminUser};
      lsSet(ME_KEY+user.uid,me);
      if(me.role==="pending"){entered=false;stopData();viewWaiting();return}
      if(entered&&prevRole===me.role){if(isAdminUser&&!pendUnsub)watchPending();var ub=document.querySelector("#userBtn .unm");if(ub)ub.textContent=me.name+(readOnly?" · só leitura":"");return}
      enterApp();
    },function(e){if(!entered)showAuthMsg("Erro ao ler o seu perfil: "+(e&&e.code||e))});
  }).catch(function(e){if(!entered)showAuthMsg("Erro ao entrar: "+(e&&e.code||e))});
}
function viewWaiting(){
  authShell('<h1 class="auth-h">A aguardar aprovação</h1><p class="auth-p">Olá <b>'+esc(me.name)+'</b>. O seu pedido foi enviado ao administrador. Assim que for aprovado, a app abre automaticamente aqui.</p><p class="auth-p small">'+esc(me.email||"")+'</p><button class="btn ghost wide" id="a-out">Terminar sessão</button>');
  $("a-out").onclick=doSignOut;
}
function viewClaim(){
  authShell('<h1 class="auth-h">Configuração inicial</h1><p class="auth-p">Ainda não existe administrador. A primeira conta a confirmar fica como <b>administrador</b> e passa a aprovar o acesso dos colegas.</p><p class="auth-err" id="a-err"></p><button class="btn wide" id="a-claim">Sou o responsável — tornar-me administrador</button><button class="btn ghost wide" id="a-out" style="margin-top:8px">Terminar sessão</button>');
  $("a-out").onclick=doSignOut;
  $("a-claim").onclick=function(){var b=$("a-claim");b.disabled=true;
    FB.setDoc(FB.doc(FB.db,"config/admin"),{uid:authUser.uid,at:Date.now()}).then(function(){return FB.updateDoc(FB.doc(FB.db,"users/"+authUser.uid),{role:"admin"})}).then(function(){onAuth(authUser)})
    .catch(function(e){b.disabled=false;$("a-err").textContent="Não foi possível: "+(e&&e.code||e)+(e&&e.code==="permission-denied"?" — já existe administrador ou as regras de segurança ainda não foram publicadas.":"")})};
}
function doSignOut(){if(dirty)saveDraft(true);if(authUser)lsSet(ME_KEY+authUser.uid,null);if(syncTimer){clearTimeout(syncTimer);syncNow()}FB.signOut(FB.auth)}
function watchPending(){
  pendUnsub=FB.onSnapshot(FB.query(FB.collection(FB.db,"users"),FB.where("role","==","pending")),function(s){pendingCount=s.size;updateTeamBadge();var t=$("teamlist");if(t)renderTeam()},function(){});
}
function updateTeamBadge(){document.querySelectorAll("[data-nt]").forEach(function(b){b.textContent=pendingCount;b.style.display=pendingCount?"":"none"})}
function openAccount(){
  openSheet(esc(me.name),esc(me.email||"")+' · '+ROLE_L[me.role],
    (isAdminUser?'<button class="btn wide" id="ac-team" style="margin-bottom:8px">Equipa e pedidos de acesso'+(pendingCount?' ('+pendingCount+')':'')+'</button>':'')+
    (readOnly?'<p class="hint">Tem acesso só de leitura. Para alterar dados, peça ao administrador para o tornar editor.</p>':'')+
    '<button class="btn ghost wide" id="ac-out">Terminar sessão</button>',function(){
    if($("ac-team"))$("ac-team").onclick=openTeam;$("ac-out").onclick=function(){closeSheet();doSignOut()};
  });
}
var teamUsers=[];
function openTeam(){
  openSheet("Equipa","Aprove pedidos e defina quem pode editar",'<div id="teamlist"><p class="hint">A carregar…</p></div>',function(){renderTeam()});
}
function renderTeam(){
  FB.getDocs(FB.collection(FB.db,"users")).then(function(s){
    var L=[];s.forEach(function(d){var x=d.data();x.uid=d.id;L.push(x)});
    var order={pending:0,admin:1,editor:2,viewer:3};L.sort(function(a,b){return(order[a.role]-order[b.role])||String(a.name).localeCompare(String(b.name),"pt")});
    var el=$("teamlist");if(!el)return;
    el.innerHTML=L.map(function(u){var self=u.uid===me.uid;
      return '<div class="tm-u'+(u.role==="pending"?' pend':'')+'"><div class="tm-i"><b>'+esc(u.name||"(sem nome)")+(self?' (você)':'')+'</b><span>'+esc(u.email||"")+'</span><span class="tm-r r-'+u.role+'">'+ROLE_L[u.role]+'</span></div>'+
        (self?'':(u.role==="pending"
          ?'<div class="tm-a"><button class="btn sm" data-r="editor" data-u="'+u.uid+'">Aprovar editor</button><button class="btn ghost sm" data-r="viewer" data-u="'+u.uid+'">Só leitura</button><button class="btn ghost sm" data-del="'+u.uid+'">Recusar</button></div>'
          :'<div class="tm-a"><button class="btn ghost sm" data-r="'+(u.role==="editor"?'viewer':'editor')+'" data-u="'+u.uid+'">'+(u.role==="editor"?'Passar a só leitura':'Passar a editor')+'</button><button class="btn ghost sm" data-del="'+u.uid+'">Remover</button></div>'))+'</div>'}).join("")||'<p class="hint">Ainda não há utilizadores.</p>';
    el.querySelectorAll("[data-r]").forEach(function(b){b.onclick=function(){b.disabled=true;FB.updateDoc(FB.doc(FB.db,"users/"+b.dataset.u),{role:b.dataset.r}).then(function(){toast("Acesso atualizado");renderTeam()}).catch(function(e){b.disabled=false;toast("Erro: "+(e&&e.code||e))})}});
    el.querySelectorAll("[data-del]").forEach(function(b){b.onclick=function(){if(!b.dataset.c){b.dataset.c=1;b.textContent="Confirmar";b.className="btn danger sm";return}FB.deleteDoc(FB.doc(FB.db,"users/"+b.dataset.del)).then(function(){toast("Acesso removido");renderTeam()}).catch(function(e){toast("Erro: "+(e&&e.code||e))})}});
  }).catch(function(e){var el=$("teamlist");if(el)el.innerHTML='<p class="auth-err">Erro: '+esc(e&&e.code||e)+'</p>'});
}
/* importação única dos dados da versão anterior */
var seedData=null;
function checkSeed(){
  if(!isAdminUser||Object.keys(state.tanks).length)return;
  fetch("seed.json",{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(d){if(d&&d.tanks&&Object.keys(d.tanks).length&&!Object.keys(state.tanks).length){seedData=d;scheduleRender(true)}}).catch(function(){});
}
function seedBanner(){
  if(!seedData||!isAdminUser||Object.keys(state.tanks).length)return"";
  return '<div class="seedbar"><div><b>Importar dados da versão anterior</b><span>'+Object.keys(seedData.tanks).length+' tanques com registos (limpezas, estados, histórico) e a lista de produtos.</span></div><button class="btn" id="seed-go">Importar</button></div>';
}
function bindSeed(){var b=$("seed-go");if(!b)return;b.onclick=function(){
  var d=seedData;state.tanks=d.tanks||{};state.products=d.products||null;state.feeds=d.feeds||[];state.feedMoves=(d.feedMoves||[]).map(function(m){m.id=m.id||newId("m");return m});state.transfers=d.transfers||[];
  seedData=null;persist("Dados importados");renderView();
}}

/* ================= Aviso de nova versão (verifica no GitHub, não gasta leituras do Firebase) ================= */
var lastVerCheck=0,newVer=null;
function checkVersion(){
  if(APP_VERSION==="dev"||newVer||Date.now()-lastVerCheck<60000)return;lastVerCheck=Date.now();
  fetch("version.json?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.ok?r.json():null}).then(function(j){
    if(j&&j.version&&j.version!==APP_VERSION){newVer=j.version;showUpdateBar()}
  }).catch(function(){});
}
function showUpdateBar(){
  if($("updbar"))return;var b=document.createElement("button");b.id="updbar";b.className="updbar";
  b.innerHTML='<b>Nova versão disponível</b><span>Tocar para atualizar</span>';
  b.onclick=function(){b.disabled=true;b.querySelector("span").textContent="A atualizar…";
    if(dirty)saveDraft(true);if(syncTimer){clearTimeout(syncTimer);syncNow()}
    setTimeout(function(){location.replace(location.pathname+"?v="+newVer+location.hash)},pendingWrites>0?1200:150)};
  document.body.appendChild(b);
}
setTimeout(checkVersion,8000);setInterval(checkVersion,10*60000);
document.addEventListener("visibilitychange",function(){if(!document.hidden)checkVersion()});

/* ================= Arranque ================= */
applyTheme();
if(window.matchMedia)try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){if(!ui.theme)applyTheme()})}catch(e){}
(function(){var h=(location.hash||"").replace("#","");
  if(BYID[h]){ui.tab="mapa";selected=h}else if(tabFromHash(h))ui.tab=tabFromHash(h);else ui.tab="mapa"; /* sem link direto, a app abre sempre no Mapa */
  if(ui.tab==="limpezas"||ui.tab==="tratamentos")ui.tab="lt";
  if(!TABS.some(function(t){return t.k===ui.tab}))ui.tab="mapa";
  if(ui.tab!=="mapa")setHash(tabHash(ui.tab));
})();
FB.auth.languageCode="pt";
FB.onAuthStateChanged(FB.auth,onAuth);
var rt;window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(function(){if($("mapwrap"))fit()},150)});
window.addEventListener("hashchange",function(){var h=(location.hash||"").replace("#","");if(h==="registos"){if(ui.tab!=="mapa")setTab("mapa");openDiary(todayKey());return}if(BYID[h]&&h!==selected)select(h);else if(tabFromHash(h)&&ui.tab!==tabFromHash(h))setTab(tabFromHash(h))});
window.addEventListener("keydown",function(e){if(e.key==="Escape"&&selected&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName))closePanel()});
window.addEventListener("beforeunload",function(){if(dirty)saveDraft(true);if(syncTimer){clearTimeout(syncTimer);syncNow()}});
setInterval(tick,1000);
setInterval(function(){var w=weekStart(Date.now());if(w!==curWeek){curWeek=w;renderView()}else if(ui.tab==="lt"){var ws=document.querySelector(".week .ws");if(ws)ws.textContent="Faltam "+timeLeft()+" · recomeça na segunda às 00:00"}},60000);
document.addEventListener("visibilitychange",function(){if(!document.hidden){var w=weekStart(Date.now());if(w!==curWeek){curWeek=w;renderView()}tick()}});
setTimeout(tick,50);
