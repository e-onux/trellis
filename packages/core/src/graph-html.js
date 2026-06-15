// Renders the evidence graph as one self-contained, dependency-free HTML file: a single string
// with inline CSS + vanilla JS and the graph embedded as JSON. No CDN, no server, no graph library
// (ADR-0004) - it opens offline in any browser. Pure and browser-safe: builds a string, touches no
// Node API. The client script is kept as plain concatenated JS (no template literals) so embedding
// it inside this module needs no escaping.

const STYLE = `
:root{--bg:#fbfbf9;--panel:#fff;--ink:#1d1c1a;--muted:#6b6a64;--line:#d9d7cd;--edge:#b9b6aa;
--source:#b9791a;--source-bg:#faeeda;--decision:#185fa5;--decision-bg:#e6f1fb;--capability:#3b6d11;--capability-bg:#eaf3de;--fade:.12}
@media(prefers-color-scheme:dark){:root{--bg:#1a1916;--panel:#22211d;--ink:#ece9e0;--muted:#9a988f;--line:#3a382f;--edge:#55524a;
--source:#efb154;--source-bg:#3a2c12;--decision:#6aa6e6;--decision-bg:#13243a;--capability:#9ac459;--capability-bg:#1d2c11}}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column}
header{padding:12px 16px;border-bottom:1px solid var(--line);display:flex;flex-wrap:wrap;gap:12px;align-items:center}
header h1{font-size:15px;font-weight:500;margin:0}
.meta{color:var(--muted);font-size:12px}
.legend{display:flex;gap:6px;margin-left:auto;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border:1px solid var(--line);border-radius:999px;cursor:pointer;font-size:12px;user-select:none}
.chip .dot{width:9px;height:9px;border-radius:50%}
.chip.off{opacity:.4;text-decoration:line-through}
.dot.source{background:var(--source)}.dot.decision{background:var(--decision)}.dot.capability{background:var(--capability)}
input#q{padding:5px 9px;border:1px solid var(--line);border-radius:7px;background:var(--panel);color:var(--ink);font-size:12px;min-width:160px}
main{flex:1;display:flex;min-height:0}
#graph{flex:1;overflow:hidden;position:relative}
#canvas{width:100%;height:100%;cursor:grab;touch-action:none}
#canvas.grabbing{cursor:grabbing}
.edge{fill:none;stroke:var(--edge);stroke-width:1.2}
.edge.governed-by{stroke-dasharray:5 4}
#arrow path{stroke:var(--edge);fill:none}
.node .box{stroke-width:1.2}
.node.type-source .box{fill:var(--source-bg);stroke:var(--source)}
.node.type-decision .box{fill:var(--decision-bg);stroke:var(--decision)}
.node.type-capability .box{fill:var(--capability-bg);stroke:var(--capability)}
.node{cursor:pointer}
.node .tlabel{font-size:13px;font-weight:500;fill:var(--ink)}
.node .tmeta{font-size:11px;fill:var(--muted)}
.node.dim,.edge.dim{opacity:var(--fade)}
.node.sel .box{stroke-width:2.4}
.hidden{display:none}
aside{width:300px;border-left:1px solid var(--line);background:var(--panel);padding:16px;overflow:auto}
aside.empty{color:var(--muted)}
aside h2{font-size:14px;margin:0 0 2px}
aside .tag{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
aside .claim{border-left:2px solid var(--line);padding-left:10px;color:var(--muted);margin:12px 0}
aside h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin:16px 0 6px}
aside a.ref{display:block;padding:4px 0;color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line);cursor:pointer}
aside a.ref:hover{color:var(--decision)}
aside a.ext{color:var(--decision)}
.danger{color:#a32d2d}
`;

const CLIENT = clientScript();

/**
 * @param {{nodes:object[],edges:object[],dangling?:object[],stats?:object,generatedAt?:string}} graph
 * @param {{title?:string, now?:string}} [opts]
 * @returns {string} a complete standalone HTML document
 */
export function renderGraphHtml(graph, { title = 'Trellis evidence graph', now } = {}) {
  const payload = {
    nodes: graph.nodes || [],
    edges: graph.edges || [],
    dangling: graph.dangling || [],
    stats: graph.stats || {},
    title,
    generatedAt: graph.generatedAt || now || new Date().toISOString()
  };
  const json = JSON.stringify(payload).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  const s = payload.stats;
  const counts = `${s.sources || 0} sources · ${s.decisions || 0} decisions · ${s.capabilities || 0} capabilities · ${s.edges || 0} links`;
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>' + escapeHtml(title) + '</title>',
    '<style>' + STYLE + '</style></head><body>',
    '<header><h1>' + escapeHtml(title) + '</h1>',
    '<span class="meta">' + counts + '</span>',
    '<input id="q" type="search" placeholder="Filter nodes…" aria-label="Filter nodes">',
    '<div class="legend">',
    '<span class="chip" data-type="source"><span class="dot source"></span>source</span>',
    '<span class="chip" data-type="decision"><span class="dot decision"></span>decision</span>',
    '<span class="chip" data-type="capability"><span class="dot capability"></span>capability</span>',
    '</div></header>',
    '<main><div id="graph"></div><aside id="detail" class="empty">Hover a node to highlight its links; click to inspect it.</aside></main>',
    '<script>var DATA=' + json + ';\n' + CLIENT + '</script>',
    '</body></html>'
  ].join('\n');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// The browser-side renderer. Plain ES5-ish JS, no template literals or ${...}, so it embeds as-is.
function clientScript() {
  return [
    '(function(){',
    'var SVGNS="http://www.w3.org/2000/svg";',
    'var nodes=DATA.nodes,edges=DATA.edges,byId={},nbr={},deg={};',
    'nodes.forEach(function(n){byId[n.id]=n;nbr[n.id]={cites:[],"governed-by":[],in:[]};deg[n.id]=0;});',
    'edges.forEach(function(e){deg[e.from]=(deg[e.from]||0)+1;deg[e.to]=(deg[e.to]||0)+1;if(nbr[e.from])nbr[e.from][e.kind].push(e.to);if(nbr[e.to])nbr[e.to].in.push(e);});',
    'var COL={source:0,decision:1,capability:2},COLW=300,NW=210;',
    'var NHH=46,GAP=22,TOP=34;',
    'var cols=[[],[],[]];',
    'nodes.slice().sort(function(a,b){return (deg[b.id]-deg[a.id])||(a.id<b.id?-1:1);}).forEach(function(n){var c=COL[n.type];cols[c===undefined?1:c].push(n);});',
    'var rows=Math.max(cols[0].length,cols[1].length,cols[2].length,1);',
    'var pos={};var totalH=rows*(NHH+GAP);',
    'cols.forEach(function(col,ci){var off=TOP+(totalH-col.length*(NHH+GAP))/2;col.forEach(function(n,i){pos[n.id]={x:40+ci*COLW,y:off+i*(NHH+GAP)};});});',
    'var W=40+2*COLW+NW+40,H=TOP+totalH+40;',
    'function mk(t,a){var e=document.createElementNS(SVGNS,t);for(var k in a)e.setAttribute(k,a[k]);return e;}',
    'var graphEl=document.getElementById("graph");',
    'var canvas=mk("svg",{id:"canvas",viewBox:"0 0 "+W+" "+H,preserveAspectRatio:"xMidYMid meet"});',
    'var defs=mk("defs",{});var m=mk("marker",{id:"arrow",viewBox:"0 0 10 10",refX:"9",refY:"5",markerWidth:"6",markerHeight:"6",orient:"auto-start-reverse"});',
    'var mp=mk("path",{d:"M1 1L9 5L1 9",fill:"none",stroke:"var(--edge)","stroke-width":"1.4","stroke-linecap":"round"});m.appendChild(mp);defs.appendChild(m);canvas.appendChild(defs);',
    'var gE=mk("g",{}),gN=mk("g",{});canvas.appendChild(gE);canvas.appendChild(gN);graphEl.appendChild(canvas);',
    'var edgeEls=[];',
    'edges.forEach(function(e){var a=pos[e.from],b=pos[e.to];if(!a||!b)return;var x1=a.x,y1=a.y+NHH/2,x2=b.x+NW,y2=b.y+NHH/2;',
    'var d="M"+x1+" "+y1+" C"+(x1-50)+" "+y1+" "+(x2+50)+" "+y2+" "+x2+" "+y2;',
    'var p=mk("path",{class:"edge "+e.kind,d:d,"marker-end":"url(#arrow)"});p.__e=e;gE.appendChild(p);edgeEls.push(p);});',
    'var nodeEls={};',
    'nodes.forEach(function(n){var p=pos[n.id];if(!p)return;var g=mk("g",{class:"node type-"+n.type,transform:"translate("+p.x+","+p.y+")"});',
    'g.appendChild(mk("rect",{class:"box",width:NW,height:NHH,rx:8}));',
    'var t1=mk("text",{class:"tlabel",x:12,y:19});t1.textContent=trunc(n.title||n.id,28);g.appendChild(t1);',
    'var t2=mk("text",{class:"tmeta",x:12,y:35});t2.textContent=n.id;g.appendChild(t2);',
    'g.addEventListener("mouseenter",function(){if(!sel)focus(n.id);});',
    'g.addEventListener("mouseleave",function(){if(!sel)clear();});',
    'g.addEventListener("click",function(ev){ev.stopPropagation();select(n.id);});',
    'gN.appendChild(g);nodeEls[n.id]=g;});',
    'function trunc(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+"…":s;}',
    'function neighbors(id){var set={};set[id]=1;(edges).forEach(function(e){if(e.from===id)set[e.to]=1;if(e.to===id)set[e.from]=1;});return set;}',
    'function focus(id){var keep=neighbors(id);for(var k in nodeEls)nodeEls[k].classList.toggle("dim",!keep[k]);edgeEls.forEach(function(p){p.classList.toggle("dim",!(p.__e.from===id||p.__e.to===id));});}',
    'function clear(){for(var k in nodeEls)nodeEls[k].classList.remove("dim");edgeEls.forEach(function(p){p.classList.remove("dim");});}',
    'var sel=null;',
    'function select(id){if(sel)nodeEls[sel].classList.remove("sel");sel=id;nodeEls[id].classList.add("sel");focus(id);detail(id);}',
    'canvas.addEventListener("click",function(){if(sel){nodeEls[sel].classList.remove("sel");sel=null;}clear();empty();});',
    'var aside=document.getElementById("detail");',
    'function empty(){aside.className="empty";aside.textContent="Hover a node to highlight its links; click to inspect it.";}',
    'function row(label,to){var a=document.createElement("a");a.className="ref";a.textContent=(byId[to]&&byId[to].title)||to;a.title=to;a.addEventListener("click",function(ev){ev.stopPropagation();if(nodeEls[to])select(to);});return a;}',
    'function h3(txt){var h=document.createElement("h3");h.textContent=txt;return h;}',
    'function detail(id){var n=byId[id];aside.className="";aside.innerHTML="";',
    'var tag=document.createElement("div");tag.className="tag";tag.textContent=n.type+(n.status?" · "+n.status:"");aside.appendChild(tag);',
    'var h=document.createElement("h2");h.textContent=n.title||n.id;aside.appendChild(h);',
    'var idl=document.createElement("div");idl.className="meta";idl.textContent=n.id;aside.appendChild(idl);',
    'if(n.claim){var q=document.createElement("div");q.className="claim";q.textContent=n.claim;aside.appendChild(q);}',
    'if(n.url){var u=document.createElement("a");u.className="ext";u.href=n.url;u.textContent=n.url;u.target="_blank";u.rel="noopener";aside.appendChild(u);}',
    'var cites=nbr[id].cites,gov=nbr[id]["governed-by"];',
    'if(gov.length){aside.appendChild(h3("Governed by"));gov.forEach(function(t){aside.appendChild(row("",t));});}',
    'if(cites.length){aside.appendChild(h3("Cites"));cites.forEach(function(t){aside.appendChild(row("",t));});}',
    'var inc=nbr[id].in;if(inc.length){aside.appendChild(h3("Referenced by"));inc.forEach(function(e){aside.appendChild(row("",e.from));});}',
    '}',
    'var hidden={};',
    'Array.prototype.forEach.call(document.querySelectorAll(".chip"),function(ch){ch.addEventListener("click",function(){var ty=ch.dataset.type;hidden[ty]=!hidden[ty];ch.classList.toggle("off",hidden[ty]);apply();});});',
    'function apply(){for(var k in nodeEls)nodeEls[k].classList.toggle("hidden",!!hidden[byId[k].type]);edgeEls.forEach(function(p){p.classList.toggle("hidden",!!hidden[byId[p.__e.from].type]||!!hidden[byId[p.__e.to].type]);});}',
    'var q=document.getElementById("q");q.addEventListener("input",function(){var v=q.value.trim().toLowerCase();for(var k in nodeEls){var n=byId[k];var hit=!v||(n.id+" "+(n.title||"")).toLowerCase().indexOf(v)>=0;nodeEls[k].classList.toggle("dim",!hit);}edgeEls.forEach(function(p){p.classList.toggle("dim",!!v);});});',
    'var vb={x:0,y:0,w:W,h:H};function setVB(){canvas.setAttribute("viewBox",vb.x+" "+vb.y+" "+vb.w+" "+vb.h);}',
    'canvas.addEventListener("wheel",function(ev){ev.preventDefault();var s=ev.deltaY>0?1.1:0.9;var r=canvas.getBoundingClientRect();var mx=vb.x+(ev.clientX-r.left)/r.width*vb.w;var my=vb.y+(ev.clientY-r.top)/r.height*vb.h;vb.w*=s;vb.h*=s;vb.x=mx-(ev.clientX-r.left)/r.width*vb.w;vb.y=my-(ev.clientY-r.top)/r.height*vb.h;setVB();},{passive:false});',
    'var pan=null;canvas.addEventListener("pointerdown",function(ev){pan={x:ev.clientX,y:ev.clientY,vx:vb.x,vy:vb.y};canvas.classList.add("grabbing");canvas.setPointerCapture(ev.pointerId);});',
    'canvas.addEventListener("pointermove",function(ev){if(!pan)return;var r=canvas.getBoundingClientRect();vb.x=pan.vx-(ev.clientX-pan.x)/r.width*vb.w;vb.y=pan.vy-(ev.clientY-pan.y)/r.height*vb.h;setVB();});',
    'canvas.addEventListener("pointerup",function(ev){pan=null;canvas.classList.remove("grabbing");});',
    'if(!nodes.length){graphEl.innerHTML="<p style=\\"padding:24px;color:var(--muted)\\">This repository has no evidence graph yet. Add sources, ADRs and capabilities.</p>";}',
    '})();'
  ].join('\n');
}
