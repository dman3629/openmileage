"use strict";

const PRO_URL = "";
const API = "https://drezar.site/api/x";
const STORE_KEY = "openmileage-data-v1";
const defaultRegion = navigator.language.toLowerCase() === "en-gb" ? "UK" : "US";
const state = loadState();
let mode = "shift";
let pendingImport = [];

const $ = id => document.getElementById(id);
const todayISO = () => new Date().toLocaleDateString("en-CA");
const number = value => Number.parseFloat(value);
const tidy = value => Number(value || 0).toLocaleString(undefined, {maximumFractionDigits: 2});
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    return {region: defaultRegion, units: "miles", vehicle: "My car", entries: [], backup: {}, ...saved};
  } catch { return {region: defaultRegion, units: "miles", vehicle: "My car", entries: [], backup: {}}; }
}
function saveState() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function taxBounds(date = new Date(), region = state.region) {
  if (region === "US") { const y = date.getFullYear(); return [new Date(y,0,1), new Date(y,11,31,23,59,59)]; }
  const y = date.getMonth() > 3 || (date.getMonth() === 3 && date.getDate() >= 6) ? date.getFullYear() : date.getFullYear()-1;
  return [new Date(y,3,6), new Date(y+1,3,5,23,59,59)];
}
function entryDate(entry) { return new Date(entry.date + "T12:00:00"); }
function inRange(entry, start, end) { const d=entryDate(entry); return d>=start && d<=end; }
function milesOf(entry) { return state.units === "km" ? entry.distance / 1.609344 : entry.distance; }
function displayDistance(entry) { return state.units === "km" ? entry.distance : entry.distance; }
function toMiles(distance) { return state.units === "km" ? distance / 1.609344 : distance; }

function rateFor(entry, region = state.region) {
  const d = entryDate(entry);
  if (region === "US") return d >= new Date(2026,0,1) ? .725 : .70;
  return d >= new Date(2026,3,6) ? .55 : .45;
}
function allowance(entries, region = state.region) {
  if (region === "US") return entries.reduce((sum,e)=>sum + milesOf(e)*rateFor(e,"US"),0);
  const ordered=[...entries].sort((a,b)=>a.date.localeCompare(b.date)); let total=0, cumulative=0;
  for (const e of ordered) { const miles=milesOf(e); const first=Math.max(0,Math.min(miles,10000-cumulative)); total += first*rateFor(e,"UK") + (miles-first)*.25; cumulative+=miles; }
  return total;
}

function renderAll() {
  $("region").value=state.region; $("units").value=state.units; $("vehicle").value=state.vehicle;
  document.querySelectorAll(".unit-label").forEach(el=>el.textContent=state.units);
  const [start,end]=taxBounds(); $("tax-year-label").textContent = state.region === "UK" ? `${start.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})} to ${end.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}` : String(start.getFullYear());
  renderTotals(); renderLog(); renderBackup();
}
function renderTotals() {
  const now=new Date(), dayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate()), weekStart=new Date(dayStart); weekStart.setDate(dayStart.getDate()-((dayStart.getDay()+6)%7));
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1), [yearStart,yearEnd]=taxBounds(now);
  const sum=(start,end=now)=>state.entries.filter(e=>inRange(e,start,end)).reduce((s,e)=>s+displayDistance(e),0);
  $("total-today").textContent=`${tidy(sum(dayStart))} ${state.units}`; $("total-week").textContent=`${tidy(sum(weekStart))} ${state.units}`;
  $("total-month").textContent=`${tidy(sum(monthStart))} ${state.units}`;
  const yearly=state.entries.filter(e=>inRange(e,yearStart,yearEnd)); $("total-year").textContent=`${tidy(yearly.reduce((s,e)=>s+displayDistance(e),0))} ${state.units}`;
  const value=allowance(yearly); $("deduction-value").textContent = state.region === "US" ? value.toLocaleString("en-US",{style:"currency",currency:"USD"}) : value.toLocaleString("en-GB",{style:"currency",currency:"GBP"});
  if(state.region==="US") { $("rate-line").textContent="IRS business rate: 72.5¢/mile for 2026 entries; 70¢/mile for 2025."; $("rate-source").href="https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents"; }
  else { $("rate-line").textContent="HMRC rate: 55p/mile for the first 10,000 from 6 Apr 2026, then 25p (previously 45p/25p)."; $("rate-source").href="https://www.gov.uk/government/publications/increase-to-approved-mileage-allowance-payments-amaps-and-self-employed-simplified-mileage-rates/increasing-mileage-rates"; }
}
function filteredEntries() { const month=$("month-filter").value; return state.entries.filter(e=>!month||e.date.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date)||b.created.localeCompare(a.created)); }
function renderLog() {
  const rows=filteredEntries(); $("entry-count").textContent=`${rows.length} ${rows.length===1?"entry":"entries"}`; $("empty-log").classList.toggle("hidden",rows.length>0); $("log-body").innerHTML=rows.map(e=>`<tr data-id="${e.id}"><td>${escapeHtml(e.date)}</td><td>${e.start==null?"—":tidy(e.start)}</td><td>${e.end==null?"—":tidy(e.end)}</td><td>${tidy(displayDistance(e))}</td><td>${escapeHtml(e.purpose)}</td><td class="note-cell">${escapeHtml(e.note)}</td><td class="actions"><div class="row-actions"><button data-action="edit">Edit</button><button data-action="delete" class="delete">Delete</button></div></td></tr>`).join("");
}
function addEntry(event) {
  event.preventDefault(); $("entry-error").textContent=""; const date=$("entry-date").value, purpose=$("purpose").value, note=$("note").value.trim(); let start=null,end=null,distance;
  if(mode==="shift") { start=number($("start-odo").value); end=number($("end-odo").value); if(!Number.isFinite(start)||!Number.isFinite(end)||end<start){$("entry-error").textContent="End odometer must be equal to or greater than start.";return;} distance=end-start; state.lastEnd=end; }
  else { distance=number($("trip-miles").value); if(!Number.isFinite(distance)||distance<=0){$("entry-error").textContent="Enter a distance greater than zero.";return;} }
  state.entries.push({id:crypto.randomUUID(),date,start,end,distance,purpose,note,created:new Date().toISOString()}); saveState(); renderAll();
  $("confirmation").textContent=`Added ${tidy(distance)} ${state.units}.`; $("note").value=""; $("end-odo").value=""; $("trip-miles").value=""; if(state.lastEnd!=null) $("start-odo").value=state.lastEnd; analytics("entry_added");
}
function setMode(next) { mode=next; document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode)); document.querySelectorAll(".shift-field").forEach(e=>e.classList.toggle("hidden",mode!=="shift")); document.querySelectorAll(".trip-field").forEach(e=>e.classList.toggle("hidden",mode!=="trip")); $("start-odo").required=mode==="shift"; $("end-odo").required=mode==="shift"; $("trip-miles").required=mode==="trip"; }
function editEntry(id) { const e=state.entries.find(x=>x.id===id); if(!e)return; const date=prompt("Date (YYYY-MM-DD)",e.date); if(date===null)return; const distance=number(prompt(`Distance (${state.units})`,e.distance)); if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(distance)||distance<0){alert("Enter a valid date and distance.");return;} e.date=date;e.distance=distance;e.purpose=prompt("Purpose",e.purpose)??e.purpose;e.note=prompt("Note",e.note)??e.note;saveState();renderAll(); }

function csvEscape(v){const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function exportEntries(){const [s,e]=taxBounds();return state.entries.filter(x=>$("export-period").value==="all"||inRange(x,s,e)).sort((a,b)=>a.date.localeCompare(b.date));}
function csvText(entries){const head=["Date","Vehicle","Start odometer","End odometer","Miles","Purpose","Note","Rate","Value"];const rows=entries.map(e=>{const miles=milesOf(e),rate=rateFor(e);return[e.date,state.vehicle,e.start??"",e.end??"",miles.toFixed(2),e.purpose,e.note,rate.toFixed(3),(miles*rate).toFixed(2)]});return [head,...rows].map(r=>r.map(csvEscape).join(",")).join("\r\n");}
function downloadCSV(){const blob=new Blob([csvText(exportEntries())],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="openmileage.csv";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);analytics("export_csv");}
function parseCSV(text){const rows=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field="";}else if(c==='\n'){row.push(field.replace(/\r$/, ""));rows.push(row);row=[];field="";}else field+=c;}row.push(field);if(row.some(Boolean))rows.push(row);return rows;}
function normalizedHeader(h){return h.toLowerCase().replace(/[^a-z0-9]/g,"");}
function prepareImport(text){const rows=parseCSV(text);if(rows.length<2)return[];const heads=rows[0].map(normalizedHeader);const idx=(...names)=>heads.findIndex(h=>names.some(n=>h.includes(n)));const di=idx("date"),mi=idx("miles","distance","kilometres","kilometers"),si=idx("startodometer","startmileage"),ei=idx("endodometer","endmileage"),pi=idx("purpose","category"),ni=idx("note","description");return rows.slice(1).map(r=>{const start=number(r[si]),end=number(r[ei]);let distance=number(r[mi]);if(!Number.isFinite(distance)&&Number.isFinite(start)&&Number.isFinite(end))distance=end-start;let date=r[di];const parsed=new Date(date);if(!/^\d{4}-\d{2}-\d{2}$/.test(date||"")&&!isNaN(parsed))date=parsed.toLocaleDateString("en-CA");if(!date||!Number.isFinite(distance)||distance<0)return null;return{id:crypto.randomUUID(),date,start:Number.isFinite(start)?start:null,end:Number.isFinite(end)?end:null,distance,purpose:r[pi]||"Other",note:r[ni]||"",created:new Date().toISOString()};}).filter(Boolean);}

async function backup(){const email=$("backup-email").value.trim(),code=$("restore-code").value.trim();if(!email){$("backup-result").textContent="Enter your email.";return;}$("backup-button").disabled=true;try{const payload={email,data:{...state,backup:undefined}};if(code)payload.code=code;const res=await fetch(`${API}/backup`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),out=await res.json();if(!res.ok)throw new Error(out.error||"Backup failed");state.backup={email,code:out.code};saveState();renderBackup();$("backup-result").innerHTML=`<strong>Backup saved.</strong><br><span class="restore-code">${escapeHtml(out.code)}</span><br>Save this code. Use it on any device to restore.`;fetch(`${API}/signup`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,source:"openmileage",meta:JSON.stringify({region:state.region,units:state.units,entries:state.entries.length,yearly_summary:$("yearly-summary").checked})})}).catch(()=>{});analytics("backup");}catch(e){$("backup-result").textContent=`Could not back up: ${e.message}`;}finally{$("backup-button").disabled=false;}}
async function restore(){const email=$("backup-email").value.trim(),code=$("restore-code").value.trim();if(!email||!code){$("backup-result").textContent="Enter your email and restore code.";return;}try{const res=await fetch(`${API}/restore`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,code})}),out=await res.json();if(!res.ok)throw new Error(out.error||"Restore failed");Object.assign(state,out.data,{backup:{email,code}});saveState();renderAll();$("backup-result").textContent=`Restored ${state.entries.length} entries.`;analytics("restore");}catch(e){$("backup-result").textContent=`Could not restore: ${e.message}`;}}
function renderBackup(){if(state.backup?.code){$("backup-email").value=state.backup.email;$("restore-code").value=state.backup.code;$("code-label").classList.remove("hidden");$("restore-button").classList.remove("hidden");$("backup-button").textContent="Update backup";}else{$("backup-button").textContent="Back up";}}
function analytics(name){fetch(`${API}/event`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,path:"/openmileage",ref:""}),keepalive:true}).catch(()=>{});}

$("entry-date").value=todayISO(); if(state.lastEnd!=null)$("start-odo").value=state.lastEnd;
$("entry-form").addEventListener("submit",addEntry);document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("region").addEventListener("change",e=>{state.region=e.target.value;saveState();renderAll();});$("units").addEventListener("change",e=>{state.units=e.target.value;saveState();renderAll();});$("vehicle").addEventListener("change",e=>{state.vehicle=e.target.value.trim()||"My car";saveState();});$("month-filter").addEventListener("change",renderLog);
$("log-body").addEventListener("click",e=>{const button=e.target.closest("button"),row=e.target.closest("tr");if(!button||!row)return;if(button.dataset.action==="delete"&&confirm("Delete this entry?")){state.entries=state.entries.filter(x=>x.id!==row.dataset.id);saveState();renderAll();}if(button.dataset.action==="edit")editEntry(row.dataset.id);});
$("download-csv").addEventListener("click",downloadCSV);$("print-report").addEventListener("click",()=>{analytics("print");window.print();});
$("csv-file").addEventListener("change",async e=>{pendingImport=prepareImport(await e.target.files[0].text());$("import-preview").classList.remove("hidden");$("import-summary").textContent=`Found ${pendingImport.length} valid ${pendingImport.length===1?"entry":"entries"}. Review the count, then import.`;});
$("confirm-import").addEventListener("click",()=>{state.entries.push(...pendingImport);saveState();renderAll();$("import-status").textContent=`Imported ${pendingImport.length} entries.`;$("import-preview").classList.add("hidden");pendingImport=[];analytics("import_csv");});
$("backup-button").addEventListener("click",backup);$("restore-button").addEventListener("click",restore);
if(PRO_URL){$("pro-card").classList.remove("hidden");$("pro-link").href=PRO_URL;$("pro-link").addEventListener("click",()=>analytics("pro_click"));}
const beacon=new Image();beacon.alt="";beacon.width=1;beacon.height=1;beacon.src=`${API}/px.gif?name=view&path=/openmileage&ref=${encodeURIComponent(document.referrer)}`;document.body.appendChild(beacon);
renderAll();
