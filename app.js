
import {FB} from "./firebase.js";
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
  ,{k:"racoes",label:"Rações",icon:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1.2 12.2A2 2 0 0 1 14.8 21H9.2a2 2 0 0 1-2-1.8L6 7z"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M9.5 12h5"/></svg>'}
];
var LT_HASH="limpezas-tratamentos";
function tabFromHash(h){return h==="limpezas"||h==="tratamentos"||h===LT_HASH||h==="lt"?"lt":(h==="racoes"?"racoes":(h==="transferencias"||h==="transf"?"transf":(h==="mapa"?"mapa":null)))}
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
var state={tanks:{},products:null,feeds:[],feedMoves:[],transfers:[]};
var ui=Object.assign({tab:"mapa",view:"map",theme:null,cams:{}},lsGet(UI_KEY)||{});
if(!ui.cams)ui.cams={};
function saveUI(){lsSet(UI_KEY,ui)}
function blank(){return{status:"ok",species:"",content:"",notes:"",updatedAt:0,log:[]}}
function tankData(id){if(!state.tanks[id])state.tanks[id]=blank();return state.tanks[id]}
function peek(id){return state.tanks[id]||blank()}
function logTo(td,text){td.log=td.log||[];var e={t:Date.now(),text:text};if(me&&me.name)e.by=me.name;td.log.push(e);if(td.log.length>300)td.log=td.log.slice(-300)}
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
    ops.slice(i,i+400).forEach(function(o){var r=FB.doc(FB.db,o[0]);if(o[1])batch.set(r,o[1]);else batch.delete(r)});
    pendingWrites++;idleSave();
    batch.commit().then(function(){pendingWrites--;idleSave()}).catch(function(err){pendingWrites--;setSave("err","Erro ao guardar");toast("Não foi possível guardar ("+(err&&err.code||err)+")");});
  }
}
function revertLocal(){
  var s={tanks:{},products:null,feeds:[],feedMoves:[],transfers:[]};
  Object.keys(synced).forEach(function(k){applyTo(s,k,JSON.parse(synced[k]))});
  state=s;sortArrays();scheduleRender(true);
}
function applyTo(s,k,d){
  var i=k.indexOf("/"),coll=k.slice(0,i),id=k.slice(i+1);
  if(coll==="tanks"){if(d)s.tanks[id]=d;else delete s.tanks[id];return}
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
var COLLS=["tanks","meta","feeds","feedMoves","transfers"],unsubs=[];
function startData(){
  if(unsubs.length)return;
  var loaded={};
  COLLS.forEach(function(c){
    unsubs.push(FB.onSnapshot(FB.collection(FB.db,c),function(snap){
      var changed=false;
      snap.docChanges().forEach(function(ch){
        var k=c+"/"+ch.doc.id;
        if(ch.type==="removed"){if(k in synced){delete synced[k];applyTo(state,k,null);changed=true}}
        else{var d=ch.doc.data(),s=stable(d);if(synced[k]!==s){synced[k]=s;applyTo(state,k,JSON.parse(s));changed=true}}
      });
      if(changed)sortArrays();
      loaded[c]=1;
      if(!dataReady&&COLLS.every(function(x){return loaded[x]})){dataReady=true;render();checkSeed()}
      else if(changed)scheduleRender();
    },function(err){
      if(err&&err.code==="permission-denied")showAuthMsg("Sem permissão para ver os dados. Peça ao administrador para aprovar o seu acesso.");
      else toast("Erro de ligação: "+(err&&err.code||err));
    }));
  });
}
function stopData(){unsubs.forEach(function(u){try{u()}catch(e){}});unsubs=[];synced={};dataReady=false;state={tanks:{},products:null,feeds:[],feedMoves:[],transfers:[]}}

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
function setCleaned(id,on,silent){
  var td=tankData(id),ws=weekStart(Date.now());td.cleans=td.cleans||[];
  if(on){td.cleans.push(Date.now());logTo(td,"Limpeza registada")}
  else{td.cleans=td.cleans.filter(function(c){return c<ws});logTo(td,"Limpeza desta semana anulada")}
  if(td.cleans.length>60)td.cleans=td.cleans.slice(-60);
  td.updatedAt=Date.now();
  if(!silent)persist(BYID[id].label+(on?" limpo ✓":" — limpeza anulada"),{label:"Anular",fn:function(){setCleaned(id,!on,true);persist(null);if(ui.tab==="lt")viewClean();else{refreshTank(id);if(selected===id)renderPanel()}}});
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
  ids.forEach(function(id){
    var td=tankData(id);td.treatments=td.treatments||[];
    var t={product:f.product,dose:(f.dose||"").trim(),notes:(f.notes||"").trim(),start:now,waterMin:mins,waterUntil:mins?now+mins*60000:0,waterOnAt:0,endedAt:0};
    if(mins){td.treat=t;logTo(td,"Tratamento iniciado: "+t.product+(t.dose?" ("+t.dose+")":"")+" · água desligada "+mins+" min")}
    else{t.endedAt=now;td.treatments.push(t);logTo(td,"Tratamento registado: "+t.product+(t.dose?" ("+t.dose+")":""))}
    if(td.treatments.length>150)td.treatments=td.treatments.slice(-150);
    td.updatedAt=now;
  });
  if(f.other&&f.product&&!products().some(function(p){return p.name.toLowerCase()===f.product.toLowerCase()}))products().push({name:f.product,water:mins});
  var who=ids.length===1?BYID[ids[0]].label:ids.length+" tanques";
  persist(who+": "+f.product+(mins?" · temporizador "+mins+" min":" registado"));
  if(mins)askNotify();
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
function badgeHTML(id){var t=activeTreat(id);if(!t)return"";var late=isLate(t);return '<span class="tbadge'+(late?' late':'')+'" data-lt="'+id+'" title="'+esc(t.product)+' — água desligada"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M4 4l16 16"/></svg><span data-cd="'+id+'">'+(late?"Ligar!":fmtDur(t.waterUntil-Date.now()))+'</span></span>'}

/* ================= Shell ================= */
var root=$("root");
function render(){
  root.innerHTML='<div class="app">'+
   '<header class="top"><div class="brand"><div class="logo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>MyWorkGuru</div>'+
    '<nav class="sections">'+TABS.map(function(t){return '<button data-tab="'+t.k+'">'+t.label+(t.k==="lt"?'<span class="nbadge" data-nb style="display:none"></span>':'')+(t.k==="racoes"?'<span class="nbadge low" data-nf style="display:none"></span>':'')+'</button>'}).join("")+'</nav>'+
    '<div class="spacer"></div><div class="savestate" id="save"><i></i><span>A ligar…</span></div>'+
    '<button class="userbtn" id="userBtn" title="Conta"><span class="uav">'+esc(((me&&me.name)||"?").trim().charAt(0).toUpperCase())+'</span><span class="unm">'+esc((me&&me.name)||"")+(readOnly?' · só leitura':'')+'</span><span class="nbadge low" data-nt style="display:none"></span></button>'+
    '<button class="iconbtn" id="themeBtn" title="Tema claro/escuro"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button></header>'+
   '<main id="view"></main>'+
   '<nav class="tabbar">'+TABS.map(function(t){return '<button data-tab="'+t.k+'">'+t.icon+t.label+(t.k==="lt"?'<span class="nbadge" data-nb style="display:none"></span>':'')+(t.k==="racoes"?'<span class="nbadge low" data-nf style="display:none"></span>':'')+'</button>'}).join("")+'</nav>'+
  '</div><div class="toast" id="toast"></div>';
  idleSave();updateTeamBadge();
  $("userBtn").onclick=openAccount;
  $("themeBtn").onclick=function(){ui.theme=document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";saveUI();applyTheme()};
  document.querySelectorAll("[data-tab]").forEach(function(b){b.onclick=function(){setTab(b.dataset.tab)}});
  renderView();updateNavBadge();updateFeedBadge();
}
function setTab(k,keepSel){
  if(dirty)saveDraft(true);
  ui.tab=k;saveUI();if(!keepSel){selected=null}
  setHash(k==="mapa"?(selected||""):tabHash(k));
  renderView();window.scrollTo(0,0);
}
function setHash(h){try{history.replaceState(null,"",h?"#"+h:location.pathname+location.search)}catch(e){location.hash=h}}
function renderView(){
  document.querySelectorAll("[data-tab]").forEach(function(b){b.classList.toggle("on",b.dataset.tab===ui.tab)});
  if(ui.tab==="lt")viewLT();else if(ui.tab==="racoes")viewFeed();else if(ui.tab==="transf")viewTransfers();else viewMap();
}
function refreshAll(){renderView();updateNavBadge()}

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
  if(activeTreat(t.id))cls+=" treating";if(selected===t.id)cls+=" sel";if(!matches(t))cls+=" dim";
  var aria=t.label+" — "+STL[d.status]+(cd?", limpo esta semana":", por limpar");
  return '<button class="'+cls+'" data-id="'+t.id+'" style="left:'+t.x+'px;top:'+t.y+'px;width:'+t.w+'px;height:'+t.h+'px" aria-label="'+esc(aria)+'"><span class="tdot"></span>'+badgeHTML(t.id)+'<span class="tid">'+esc(t.label)+'</span><span class="tsub'+(sub?'':' none')+'">'+(sub?esc(sub):'sem espécie')+'</span></button>';
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
  v.innerHTML='<div class="pagehead"><div><h1>Tanques</h1><p>Toque num tanque para ver o estado, marcar a limpeza ou iniciar um tratamento.</p></div></div>'+
   seedBanner()+'<div class="stats" id="stats"></div>'+
   '<div class="toolbar"><label class="search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="Procurar tanque ou espécie" autocomplete="off"></label>'+
   '<div class="seg" id="viewSeg"><button data-v="map">Mapa</button><button data-v="list">Lista</button></div>'+
   '<div class="legend"><span><i style="background:color-mix(in srgb,var(--cdone) 35%,var(--surface))"></i>Limpo esta semana</span><span><i style="background:color-mix(in srgb,var(--ctodo) 40%,var(--surface))"></i>Falta limpar</span><span><i style="background:var(--surface)"></i>Vazio</span><span class="hcount" id="hcount">'+cleanCount()+'/'+cleanTotal()+'</span></div></div>'+
   '<div class="layout" id="layout"><div id="mainview"></div><div id="panelslot"></div></div>';
  var q=$("q");q.value=query;q.addEventListener("input",function(){query=q.value.trim();refreshMapFilters()});
  q.addEventListener("keydown",function(e){if(e.key==="Enter"){var r=TANKS.filter(matches);if(r.length){select(r[0].id);q.blur()}}});
  document.querySelectorAll("#viewSeg button").forEach(function(b){b.onclick=function(){ui.view=b.dataset.v;saveUI();renderMapMain()}});
  renderStats();renderMapMain();renderPanel();bindSeed();
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
      return '<div class="'+cls+'" style="padding-right:12px" data-id="'+t.id+'" role="button" tabindex="0"><div class="tid"><span class="cdot" title="'+STL[d.status]+'"></span>'+esc(t.label)+'</div><div class="tsub'+(d.species?'':' none')+'">'+(d.species?esc(d.species):'sem espécie')+'</div>'+(d.status!=="ok"?'<div class="tst">'+STL[d.status]+'</div>':'')+badgeHTML(t.id)+'</div>'}).join("")+'</div></div>';
  });
  var mv=$("mainview");mv.innerHTML=html||'<p class="empty">Nenhum tanque corresponde ao filtro.</p>';
  mv.querySelectorAll(".card").forEach(function(c){c.onclick=function(){select(c.dataset.id)};c.onkeydown=function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();select(c.dataset.id)}}});
}
function refreshTank(id){
  if(ui.tab!=="mapa")return;
  if(ui.view==="map")replaceTank(id);else renderMapList();
  renderStats();
  var hc=$("hcount");if(hc)hc.textContent=cleanCount()+"/"+cleanTotal();
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
     (cd?'<button class="btn ghost" id="cl-undo">Anular limpeza desta semana</button>':'<button class="btn green" id="cl-do">Marcar como limpo</button>')+'</div>';
  var treatBox='<span class="lbl">Tratamento</span>';
  if(at){var late=isLate(at);
    treatBox+='<div class="treatbox'+(late?' late':'')+'" data-lt="'+id+'"><div class="ct">'+esc(at.product)+(at.dose?' · '+esc(at.dose):'')+'</div>'+
      '<div class="cm">Água desligada às '+hhmm(at.start)+' · ligar às <b>'+hhmm(at.waterUntil)+'</b></div>'+
      '<div class="countdown" data-cd="'+id+'" data-long="1">'+(late?'Atrasado '+fmtDur(at.waterUntil-Date.now()):fmtDur(at.waterUntil-Date.now()))+'</div>'+
      '<div class="row" style="flex-wrap:wrap;margin-top:6px"><button class="btn green" id="t-on" style="flex:1">Água ligada</button><button class="btn ghost" id="t-cancel">Cancelar</button></div>'+
      '<a class="linkbtn" href="'+gcalLink([id],at)+'" target="_blank" rel="noopener">Lembrete no Google Calendar</a></div>';
  }else treatBox+='<div style="margin-bottom:18px"><button class="btn purple" id="t-new">+ Novo tratamento</button><div class="meta" style="margin-top:6px">'+(lastT?'Último: '+esc(lastT.product)+' · '+fmt(lastT.start):'Sem tratamentos registados')+'</div></div>';
  slot.innerHTML=(isMobile()?'<div class="sheet-backdrop" id="bd"></div>':'')+
  '<aside class="panel"><div class="phead"><div style="flex:1"><h2>'+esc(t.label)+'</h2><span class="badge">'+(t.zone==="interior"?"Interior":"Exterior")+' · grupo '+t.group+'</span></div>'+
   '<button class="iconbtn" id="pclose" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'+
   '<div class="pbody">'+
    '<span class="lbl">Estado</span><div class="statuses">'+STATUSES.map(function(s){return '<button class="sbtn st-'+s.k+(d.status===s.k?' on':'')+'" data-s="'+s.k+'"><i></i>'+s.label+'</button>'}).join("")+'</div>'+
    cleanBox+treatBox+
    '<span class="lbl">Peixe</span><div style="margin-bottom:18px"><button class="btn ghost" id="x-from-panel">⇄ Transferir peixe</button>'+(function(){var L=transfers().filter(function(x){return x.from===id||x.to===id}).sort(function(a,b){return b.t-a.t})[0];return L?'<div class="meta" style="margin-top:6px">Última: '+esc(trFromLabel(L))+' → '+esc(trToLabel(L))+' · '+fmt(L.t)+'</div>':''})()+'</div>'+
    '<div class="field"><label class="lbl" for="fsp">Espécie</label><input id="fsp" maxlength="40" list="splist" placeholder="Ex.: Robalo, Dourada…" value="'+esc(d.species)+'"><datalist id="splist">'+speciesList().map(function(x){return '<option value="'+esc(x)+'">'}).join("")+'</datalist></div>'+
    '<div class="field"><label class="lbl" for="fc">Lote / conteúdo</label><input id="fc" maxlength="80" placeholder="Ex.: lote 2311" value="'+esc(d.content)+'"></div>'+
    '<div class="field"><label class="lbl" for="fn">Notas</label><textarea id="fn" placeholder="Observações sobre este tanque">'+esc(d.notes)+'</textarea></div>'+
    '<div class="row" style="justify-content:space-between;margin-bottom:20px"><span class="meta">Atualizado: '+fmt(d.updatedAt)+'</span><button class="btn" id="fsave" disabled>Guardar</button></div>'+
    '<span class="lbl">Histórico</span>'+
    '<div class="row"><input id="lognew" style="flex:1;min-width:0;border:1px solid var(--line);background:var(--bg);border-radius:10px;padding:10px 12px;outline:none" placeholder="Adicionar registo…" maxlength="200"><button class="btn ghost" id="logadd">Adicionar</button></div>'+
    (log.length?'<ul class="log">'+log.slice(0,40).map(function(l){return '<li><time>'+fmt(l.t)+(l.by?' · '+esc(l.by):'')+'</time>'+esc(l.text)+'</li>'}).join("")+'</ul>':'<p class="empty" style="margin-top:10px">Sem registos ainda.</p>')+
   '</div></aside>';
  if(!wasOpen&&ui.view==="map"&&!isMobile())setTimeout(function(){fit();centerOn(id)},0);
  $("pclose").onclick=closePanel;var bd=$("bd");if(bd)bd.onclick=closePanel;
  slot.querySelectorAll(".sbtn").forEach(function(b){b.onclick=function(){
    var td=tankData(id);if(td.status===b.dataset.s)return;captureDraft(td);
    var prev=td.status;td.status=b.dataset.s;td.updatedAt=Date.now();logTo(td,"Estado: "+STL[prev]+" → "+STL[td.status]);
    var auto=false;if(prev==="clean"&&td.status!=="empty"&&!cleanedThisWeek(id)){td.cleans=td.cleans||[];td.cleans.push(Date.now());logTo(td,"Limpeza registada (fim de Em limpeza)");auto=true}
    persist(t.label+": "+STL[td.status]+(auto?" · marcado como limpo":""));refreshTank(id);renderPanel();
  }});
  if($("cl-do"))$("cl-do").onclick=function(){captureDraft(tankData(id));setCleaned(id,true);refreshTank(id);renderPanel()};
  if($("cl-undo"))$("cl-undo").onclick=function(){captureDraft(tankData(id));setCleaned(id,false);refreshTank(id);renderPanel()};
  if($("t-new"))$("t-new").onclick=function(){captureDraft(tankData(id));openTreatModal([id])};
  if($("x-from-panel"))$("x-from-panel").onclick=function(){captureDraft(tankData(id));openTransfer(id)};
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
function openTreatModal(ids){unlockAudio();tform={ids:ids,product:"",dose:"",water:0,notes:"",other:false,more:false};renderTreatModal()}
function closeTreatModal(){tform=null;var m=$("tmodal");if(m)m.remove()}
function hintText(){var w=+tform.water||0;return w>0?"Arranca um temporizador de "+w+" min e avisa quando for para voltar a ligar a água.":"Sem paragem de água: o tratamento fica só registado no histórico."}
function canStart(){return !!(tform.product&&tform.ids.length)}
function startLabel(){var w=+tform.water||0,n=tform.ids.length;return(w>0?"Iniciar e parar água":"Registar tratamento")+(n>1?" ("+n+" tanques)":"")}
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
     '<div class="field"><label class="lbl" for="t-dose">Dose</label><input id="t-dose" maxlength="40" placeholder="Ex.: 150 ppm" value="'+esc(f.dose||"")+'"></div>'+
     '<div class="field"><label class="lbl" for="t-water">Parar água (min)</label><input id="t-water" type="number" inputmode="numeric" min="0" max="1440" value="'+w+'"></div>'+
     '<div class="field full"><label class="lbl" for="t-notes">Notas</label><input id="t-notes" maxlength="120" placeholder="Opcional" value="'+esc(f.notes||"")+'"></div>'+
   '</div>'+pickerHTML()+'<p class="hint" id="t-hint">'+hintText()+'</p>'+
   '<div class="row"><button class="btn purple" id="t-start" style="flex:1"'+(canStart()?'':' disabled')+'>'+startLabel()+'</button><button class="btn ghost" id="t-x">Cancelar</button></div></div>';
  if(st)m.querySelector(".tm-sheet").scrollTop=st;
  var q=$;
  function readForm(){if(q("t-dose"))tform.dose=q("t-dose").value;if(q("t-water"))tform.water=q("t-water").value;if(q("t-notes"))tform.notes=q("t-notes").value;if(q("t-name"))tform.product=q("t-name").value.trim()}
  function upd(){readForm();q("t-hint").textContent=hintText();var s=q("t-start");s.textContent=startLabel();s.disabled=!canStart()}
  m.querySelector(".tm-back").onclick=closeTreatModal;q("tm-x").onclick=closeTreatModal;q("t-x").onclick=closeTreatModal;
  m.querySelectorAll(".pchip[data-p]").forEach(function(b){b.onclick=function(){readForm();var p=products()[+b.dataset.p];tform.product=p.name;tform.water=p.water;tform.other=false;renderTreatModal()}});
  q("p-other").onclick=function(){readForm();tform.other=true;tform.product="";tform.water=0;renderTreatModal();setTimeout(function(){q("t-name")&&q("t-name").focus()},0)};
  ["t-dose","t-water","t-notes","t-name"].forEach(function(x){if(q(x))q(x).oninput=upd});
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
    '<div class="section-title" style="margin-top:4px">Histórico<span>'+hist.length+'</span></div>';
  if(hist.length){
    html+='<div class="fchips"><button class="chip'+(hFilter?'':' on')+'" data-hf="">Todos</button>'+Object.keys(prods).sort().map(function(p){return '<button class="chip'+(hFilter===p?' on':'')+'" data-hf="'+esc(p)+'">'+esc(p)+'</button>'}).join("")+'</div>'+
     '<table class="htable"><thead><tr><th>Data</th><th>Tanque</th><th>Produto</th><th class="hide-m">Água</th></tr></thead><tbody>'+
     hf.slice(0,80).map(function(h){var x=h.t,late=x.waterOnAt&&x.waterUntil?Math.round((x.waterOnAt-x.waterUntil)/60000):0;
       return '<tr><td>'+fmtShort(x.start)+'</td><td class="tk">'+esc(BYID[h.id].label)+'</td><td>'+esc(x.product)+(x.dose?'<div class="sub">'+esc(x.dose)+'</div>':'')+(x.notes?'<div class="sub">'+esc(x.notes)+'</div>':'')+'</td><td class="hide-m">'+(x.waterMin?x.waterMin+' min'+(x.waterOnAt?'<div class="sub">ligada '+hhmm(x.waterOnAt)+(late>1?' (+'+late+' min)':'')+'</div>':''):'—')+'</td></tr>'}).join("")+'</tbody></table>';
  }else html+='<p class="empty">Ainda não há tratamentos registados.</p>';
  html+='<div class="section-title">Produtos</div><p class="hint" style="margin-top:-4px">Minutos de paragem de água propostos por defeito.</p><div class="fchips">'+
    P.map(function(p,i){return '<span class="pchip">'+esc(p.name)+' · <input data-pw="'+i+'" type="number" min="0" max="1440" inputmode="numeric" value="'+(p.water||0)+'" style="width:52px;border:1px solid var(--line);border-radius:7px;padding:2px 4px;background:var(--bg)"> min'+(isDefaultProduct(p.name)?'':'<button class="linkbtn" data-pdel="'+i+'" style="padding:0 0 0 4px;text-decoration:none" title="Remover">×</button>')+'</span>'}).join("")+'</div>';
  v.innerHTML=html;
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
  feedMoves().push(mv);if(feedMoves().length>800)state.feedMoves=feedMoves().slice(-800);return mv;
}
function viewFeed(){
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
        (pct!=null?'<div class="fc-bar'+(lowc?' low':'')+'"><i style="width:'+pct+'%"></i></div>':'')+
        '<div class="row fc-act"><button class="btn purple" data-take="'+f.id+'" style="flex:1">− Retirar</button><button class="btn ghost" data-in="'+f.id+'">+ Entrada</button></div></div>';
    }).join("")+'</div>';
    var M=feedMoves().slice().reverse(),names={};M.forEach(function(m){names[m.feedId]=m.name});
    var MF=M.filter(function(m){return !feedFilter||m.feedId===feedFilter});
    html+='<div class="section-title big">Movimentos<span>'+M.length+'</span></div>';
    if(M.length){
      html+='<div class="fchips"><button class="chip'+(feedFilter?'':' on')+'" data-ff="">Todas</button>'+Object.keys(names).map(function(id){var f=feedById(id);return '<button class="chip'+(feedFilter===id?' on':'')+'" data-ff="'+id+'">'+esc(f?f.name:names[id])+'</button>'}).join("")+'</div>'+
       '<table class="htable"><thead><tr><th>Data</th><th>Ração</th><th style="text-align:right">kg</th><th class="hide-m">Destino / nota</th></tr></thead><tbody>'+
       MF.slice(0,80).map(function(m){var f=feedById(m.feedId);return '<tr><td>'+fmtShort(m.t)+'</td><td>'+esc(f?f.name:m.name)+(m.bags?'<div class="sub">'+kg(m.bags)+(m.bags===1?' saco':' sacos')+'</div>':'')+'<div class="sub show-m">'+esc([m.dest,m.note].filter(Boolean).join(" · "))+'</div></td><td style="text-align:right" class="'+(m.kg<0?'mv-out':'mv-in')+'">'+(m.kg>0?'+':'')+kg(m.kg)+'<div class="sub">fica '+kg(m.after)+'</div></td><td class="hide-m">'+esc([m.dest,m.note].filter(Boolean).join(" · "))+(m.by?'<div class="sub">por '+esc(m.by)+'</div>':'')+'</td></tr>'}).join("")+'</tbody></table>';
    }else html+='<p class="empty">Ainda não há movimentos.</p>';
  }
  v.innerHTML=html;
  [$("f-new"),$("f-new2")].forEach(function(b){if(b)b.onclick=function(){openFeedEdit(null)}});
  v.querySelectorAll("[data-edit]").forEach(function(b){b.onclick=function(){openFeedEdit(b.dataset.edit)}});
  v.querySelectorAll("[data-take]").forEach(function(b){b.onclick=function(){openFeedMove(b.dataset.take,-1)}});
  v.querySelectorAll("[data-in]").forEach(function(b){b.onclick=function(){openFeedMove(b.dataset.in,1)}});
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
function closeSheet(){var m=$("fmodal");if(m)m.remove()}
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
      closeSheet();
      persist((take?"Retirado ":"Entrada ")+kg(q)+" kg · "+f.name+" fica "+kg(f.stockKg)+" kg",{label:"Anular",fn:function(){f.stockKg=before;var M=feedMoves(),i=M.indexOf(mv);if(i>=0)M.splice(i,1);persist(null);if(ui.tab==="racoes")viewFeed();updateFeedBadge()}});
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
      else{var nf={id:"f"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),name:name,bagKg:bag,stockKg:Math.round(Math.max(0,numVal("e-stock"))*10)/10,minKg:min,createdAt:Date.now()};
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
  transfers().push(rec);if(transfers().length>2000)state.transfers=transfers().slice(-2000);
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
  var v=$("view"),T=transfers().slice().sort(function(a,b){return b.t-a.t});
  var F=T.filter(function(x){if(trFilterTank&&x.from!==trFilterTank&&x.to!==trFilterTank)return false;if(trFilterType==="tank"&&!x.to)return false;if(trFilterType==="out"&&x.to)return false;if(trFilterType==="in"&&x.from!=="fora")return false;return true});
  var ms=new Date();ms.setDate(1);ms.setHours(0,0,0,0);
  var month=T.filter(function(x){return x.t>=ms.getTime()}),mOut=month.filter(function(x){return !x.to}).reduce(function(a,x){return a+(x.qty||0)},0);
  var html='<div class="pagehead"><div><h1>Transferências</h1><p>Registo de peixes que mudam de tanque ou saem do mapa.</p></div><button class="btn" id="x-new">+ Nova transferência</button></div>'+
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

/* ================= Login, registo e aprovação ================= */
var LOGO='<div class="logo"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>';
var ROLE_L={pending:"A aguardar",viewer:"Só leitura",editor:"Editor",admin:"Administrador"};
var meUnsub=null,pendUnsub=null,pendingCount=0,authUser=null,entered=false,regName="";
function authShell(inner){root.innerHTML='<div class="auth"><div class="auth-card"><div class="brand auth-brand">'+LOGO+'MyWorkGuru</div>'+inner+'</div></div><div class="toast" id="toast"></div>'}
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
    (reset?'':'<div class="field"><label class="lbl" for="a-pass">Palavra-passe</label><input id="a-pass" type="password" autocomplete="'+(reg?'new-password':'current-password')+'" minlength="6" required></div>')+
    '<p class="auth-err" id="a-err"></p>'+
    '<button class="btn wide" id="a-go" type="submit">'+(reg?'Criar conta':reset?'Enviar email':'Entrar')+'</button></form>'+
    '<div class="auth-links">'+(mode!=="login"?'<button class="linkbtn" data-m="login">Já tenho conta — entrar</button>':'<button class="linkbtn" data-m="register">Criar conta nova</button><button class="linkbtn" data-m="reset">Esqueci-me da palavra-passe</button>')+'</div>');
  document.querySelectorAll("[data-m]").forEach(function(b){b.onclick=function(){viewAuth(b.dataset.m)}});
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
function onAuth(user){
  authUser=user;if(meUnsub){meUnsub();meUnsub=null}if(pendUnsub){pendUnsub();pendUnsub=null}
  if(!user){me=null;isAdminUser=false;entered=false;stopData();document.body.classList.remove("ro");viewAuth("login");return}
  authShell('<p class="auth-p">A entrar…</p>');
  ensureProfile(user).then(function(){
    return FB.getDoc(FB.doc(FB.db,"config/admin"));
  }).then(function(a){
    if(!a.exists()){viewClaim();return}
    isAdminUser=a.data().uid===user.uid;
    meUnsub=FB.onSnapshot(FB.doc(FB.db,"users/"+user.uid),function(s){
      if(!s.exists()){entered=false;stopData();showAuthMsg("O seu pedido de acesso foi recusado ou o acesso foi removido.");return}
      var d=s.data();me={uid:user.uid,name:d.name||user.displayName||"",email:d.email,role:isAdminUser?"admin":d.role};
      if(me.role==="pending"){entered=false;stopData();viewWaiting();return}
      readOnly=me.role==="viewer";document.body.classList.toggle("ro",readOnly);
      if(!entered){entered=true;authShell('<p class="auth-p">A carregar dados…</p>');startData();if(isAdminUser)watchPending()}
      else if($("view")){render()}
    },function(e){showAuthMsg("Erro ao ler o seu perfil: "+(e&&e.code||e))});
  }).catch(function(e){showAuthMsg("Erro ao entrar: "+(e&&e.code||e))});
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
function doSignOut(){if(dirty)saveDraft(true);if(syncTimer){clearTimeout(syncTimer);syncNow()}FB.signOut(FB.auth)}
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

/* ================= Arranque ================= */
applyTheme();
if(window.matchMedia)try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){if(!ui.theme)applyTheme()})}catch(e){}
(function(){var h=(location.hash||"").replace("#","");
  if(BYID[h]){ui.tab="mapa";selected=h}else if(tabFromHash(h))ui.tab=tabFromHash(h);
  if(ui.tab==="limpezas"||ui.tab==="tratamentos")ui.tab="lt";
  if(!TABS.some(function(t){return t.k===ui.tab}))ui.tab="mapa";
  if(ui.tab!=="mapa")setHash(tabHash(ui.tab));
})();
FB.auth.languageCode="pt";
FB.onAuthStateChanged(FB.auth,onAuth);
var rt;window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(function(){if($("mapwrap"))fit()},150)});
window.addEventListener("hashchange",function(){var h=(location.hash||"").replace("#","");if(BYID[h]&&h!==selected)select(h);else if(tabFromHash(h)&&ui.tab!==tabFromHash(h))setTab(tabFromHash(h))});
window.addEventListener("keydown",function(e){if(e.key==="Escape"&&selected&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName))closePanel()});
window.addEventListener("beforeunload",function(){if(dirty)saveDraft(true);if(syncTimer){clearTimeout(syncTimer);syncNow()}});
setInterval(tick,1000);
setInterval(function(){var w=weekStart(Date.now());if(w!==curWeek){curWeek=w;renderView()}else if(ui.tab==="lt"){var ws=document.querySelector(".week .ws");if(ws)ws.textContent="Faltam "+timeLeft()+" · recomeça na segunda às 00:00"}},60000);
document.addEventListener("visibilitychange",function(){if(!document.hidden){var w=weekStart(Date.now());if(w!==curWeek){curWeek=w;renderView()}tick()}});
setTimeout(tick,50);
