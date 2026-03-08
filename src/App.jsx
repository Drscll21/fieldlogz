import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, LineChart, Line, Legend,
  PieChart, Pie, Cell
} from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LOG_TYPES =[
  { id: "training",   label: "Training",            icon: "📘", color: "#C9A84C" },
  { id: "praise",     label: "Praise",              icon: "⭐", color: "#FFFFFF" },
  { id: "discipline", label: "Safety & Discipline", icon: "⚠️", color: "#ff4d4d" },
  { id: "other",      label: "Other",               icon: "📝", color: "#aaaaaa" },
];

const SEVERITY_LEVELS =[
  { id: "minor",    label: "Minor",    color: "#C9A84C" },
  { id: "moderate", label: "Moderate", color: "#E8873A" },
  { id: "severe",   label: "Severe",   color: "#ff4d4d" },
];

const DEFAULT_SKILL_AREAS =[
  "Conduit & Cable Management","Switchboard Work","Circuit Testing",
  "WHS / Safety Compliance","Tools & Equipment","Documentation",
  "Communication","Initiative",
];

const DEFAULT_SAFETY_CATS =[
  "Near Miss","PPE Breach","Unsafe Work Practice",
  "Site Hazard","Electrical Incident","Tool/Equipment Issue","Other",
];

const AS3000_COMPETENCIES =[
  "Clause 1 — Scope & General","Clause 2 — General Arrangement",
  "Clause 3 — Selection of Wiring Systems","Clause 4 — Protection",
  "Clause 5 — Earthing","Clause 6 — Switchboards",
  "Clause 7 — Testing & Inspection","Clause 8 — Special Installations",
];

const DEFAULT_GRADES =["1st Year App","2nd Year App","3rd Year App","4th Year App","A-Grade"];

const DEFAULT_BUILDERS =["Lendlease", "Multiplex", "Hutchinson Builders", "CPB Contractors", "John Holland", "Probuild"];
const DEFAULT_SUPERVISORS =["Jordan Mitchell", "Sarah Connor", "Alex Vance", "TBD"];

const DEFAULT_WORKERS =[
  { id:"w1", name:"Jordan Mitchell", grade:"2nd Year App", competencies:[] },
  { id:"w2", name:"Sam Nguyen",      grade:"3rd Year App", competencies:[] },
  { id:"w3", name:"Riley Thompson",  grade:"1st Year App", competencies:[] },
  { id:"w4", name:"Ash Kowalski",    grade:"4th Year App", competencies:[] },
  { id:"w5", name:"Taylor Brennan",  grade:"A-Grade",      competencies:[] },
];

const DEFAULT_SITES =[
  { id:"site1", address:"123 Park St, Parkside VIC 3125", builders:["Lendlease"], supervisor:"Alex Vance" },
  { id:"site2", address:"45 Marion Rd, Marion VIC 3043", builders:["Multiplex"], supervisor:"Sarah Connor" },
  { id:"site3", address:"1 King St, Melbourne VIC 3000", builders:["Hutchinson Builders"], supervisor:"Jordan Mitchell" },
  { id:"site4", address:"77 Grove Ave, Burwood VIC 3125", builders:[], supervisor:"TBD" },
  { id:"site5", address:"9 Trade Rd, Bayswater VIC 3153", builders:["CPB Contractors"], supervisor:"Alex Vance" },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function lsGet(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } }
function lsSet(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function uid()        { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function fmtDate(d) { 
  if (!d) return ""; 
  try {
    return new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
  } catch { return d; }
}

function isoToday() { return new Date().toISOString().split("T")[0]; }
function isoSixMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().split("T")[0];
}

function startOfWeek(d = new Date()) {
  const dt = new Date(d), day = dt.getDay();
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
  dt.setHours(0,0,0,0); return dt;
}
const isThisWeek  = ds => { const d=new Date(ds),sw=startOfWeek(),ew=new Date(sw); ew.setDate(sw.getDate()+7); return d>=sw&&d<ew; };
const isLastWeek  = ds => { const d=new Date(ds),sw=startOfWeek(),lw=new Date(sw); lw.setDate(sw.getDate()-7); return d>=lw&&d<sw; };
const isThisMonth = ds => { const d=new Date(ds),n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); };
const isLastMonth = ds => { const d=new Date(ds),n=new Date(),lm=new Date(n.getFullYear(),n.getMonth()-1,1); return d.getMonth()===lm.getMonth()&&d.getFullYear()===lm.getFullYear(); };

function generateSMS(worker, log) {
  const sev = SEVERITY_LEVELS.find(s => s.id === log.severity);
  return `Hi ${worker?.name ?? ""},\n\nThis message is a formal ${sev?.label?.toLowerCase() ?? "verbal"} warning following our discussion on ${fmtDate(log.date)}.\n\nMatter: ${log.safetyCategory || log.skillArea || "General"}\nDetails: ${log.safetyComment || log.notes}\nSite: ${log.siteAddress || ""}\n\nPlease ensure this issue does not reoccur. If you wish to discuss this matter, please speak with your supervisor directly.\n\nThis record has been logged for your employment file.\n\n— ProGlow Electrics Supervisor`;
}

// ─── PRINT REPORT (PDF GEN) ──────────────────────────────────────────────────

function printReport(title, rows, meta = "") {
  const w = window.open("", "_blank");
  const typeColor = { training:"#7a6020", praise:"#1a5c2e", discipline:"#8b1a1a", other:"#3a3a6a" };
  const typeBg    = { training:"#fef9ec", praise:"#f0fdf4", discipline:"#fff1f1", other:"#f5f3ff" };

  const tableRows = rows.map(r => `
    <tr>
      <td>${fmtDate(r.date)}</td>
      <td>
        <div style="font-weight:700;margin-bottom:4px;font-size:11px;">${r.siteAddress}</div>
        ${r.builders?.length ? `<div style="color:#555;font-size:10px">Bldr: ${r.builders.join(", ")}</div>` : ''}
        ${r.supervisor ? `<div style="color:#555;font-size:10px">Sup: ${r.supervisor}</div>` : ''}
      </td>
      <td><span style="font-weight:700;color:#111;font-size:11px;">${r.workerName}</span></td>
      <td>${r.alsoNames?.length ? r.alsoNames.map(n=>`<div style="margin-bottom:2px">${n}</div>`).join("") : '<span style="color:#999">—</span>'}</td>
      <td>${(r.types||[]).map(t => {
        const lt = LOG_TYPES.find(x=>x.id===t);
        return `<span style="background:${typeBg[t]||"#f5f5f5"};color:${typeColor[t]||"#333"};padding:2px 7px;border-radius:4px;font-size:11px;margin-bottom:3px;display:inline-block;">${lt?.icon||""} ${lt?.label||t}</span><br/>`;
      }).join("")}</td>
      <td>
        ${r.severity && (r.types||[]).includes('discipline') ? `<span style="font-size:10px;padding:2px 5px;background:#fff3cd;border-radius:3px;margin-bottom:4px;display:inline-block;">Sev: ${r.severity}</span><br/>` : ""}
        ${r.skillArea || r.safetyCategory || ""}
      </td>
      <td style="text-align:center;font-weight:700">${r.rating}/5</td>
      <td>
        ${r.trainingComment ? `<div style="margin-bottom:6px"><strong>Training:</strong> ${r.trainingComment}</div>` : ''}
        ${r.praiseComment ? `<div style="margin-bottom:6px"><strong>Praise:</strong> ${r.praiseComment}</div>` : ''}
        ${r.safetyComment ? `<div style="margin-bottom:6px"><strong>Safety:</strong> ${r.safetyComment}</div>` : ''}
        ${r.notes ? `<div style="margin-bottom:6px"><strong>General:</strong> ${r.notes}</div>` : ''}
        ${r.photo ? `<div style="margin-top:6px;"><img src="${r.photo}" style="max-height:120px; border-radius:4px; border:1px solid #ccc;" /></div>` : ''}
      </td>
    </tr>
  `).join("");

  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap');
    body{font-family:'Outfit',Arial,sans-serif;font-size:12px;color:#111;padding:28px;max-width:1100px;margin:0 auto;}
    .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:20px;}
    .logo-wrap{display:flex;align-items:center;gap:14px;}
    .logo-img{height:48px;filter:grayscale(100%) contrast(1000%);}
    .company{font-size:11px;color:#555;}
    .report-title{font-family:'Bebas Neue',sans-serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#000;}
    .meta{font-size:11px;color:#666;margin-bottom:18px;line-height:1.8;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;}
    th{background:#000;color:#fff;padding:8px 10px;text-align:left;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-size:10px;font-family:'Bebas Neue',sans-serif;letter-spacing:1px;}
    td{padding:7px 10px;border-bottom:1px solid #e5e5e5;vertical-align:top;}
    tr:nth-child(even) td{background:#fafafa;}
    .footer{margin-top:24px;font-size:10px;color:#999;border-top:1px solid #ddd;padding-top:10px;display:flex;justify-content:space-between;}
    .summary{display:flex;gap:20px;margin-bottom:20px;}
    .stat{background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:10px 16px;text-align:center;}
    .stat-n{font-size:22px;font-weight:700;color:#111;font-family:'Bebas Neue',sans-serif;}
    .stat-l{font-size:10px;color:#777;text-transform:uppercase;letter-spacing:1px;}
    @media print{button{display:none;} body{padding:16px;}}
  </style></head><body>
  <div class="header">
    <div class="logo-wrap">
      <img src="https://www.proglowelectrics.com.au/wp-content/uploads/2024/03/Mask-group.png" class="logo-img" onerror="this.style.display='none'"/>
      <div>
        <div class="report-title">${title}</div>
        <div class="company">ProGlow Electrics · Supervisor Field Log</div>
      </div>
    </div>
    <div style="text-align:right;font-size:11px;color:#555;">
      Generated: ${fmtDate(new Date())}<br/>
      ${rows.length} record${rows.length !== 1 ? "s" : ""}
    </div>
  </div>
  <div class="meta">${meta}</div>
  <div class="summary">
    ${LOG_TYPES.map(t => {
      const c = rows.filter(r=>(r.types||[]).includes(t.id)).length;
      return `<div class="stat"><div class="stat-n">${c}</div><div class="stat-l">${t.icon} ${t.label}</div></div>`;
    }).join("")}
    <div class="stat"><div class="stat-n">${rows.filter(r=>r.followUp).length}</div><div class="stat-l">🔔 Follow-ups</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Date</th><th>Job Address</th><th>Primary Responsible</th><th>Also On-Site</th>
      <th>Type</th><th>Cat/Skill</th><th>Team<br/>Rtg</th><th>Details & Observations</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">
    <span>ProGlow Electrics — Confidential Supervisor Record</span>
    <span>FieldLog · ${fmtDate(new Date())}</span>
  </div>
  <script>window.onload=()=>window.print();<\/script>
  </body></html>`);
  w.document.close();
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-tap-highlight-color:transparent;}
:root{
  --bg:    #000000;
  --s1:    #0a0a0a;
  --s2:    #141414;
  --s3:    #1f1f1f;
  --border:#2a2a2a;
  --border2:#3d3d3d;
  --text:  #ffffff;
  --muted: #999999;
  --gold:  #C9A84C;
  --gold2: #e8c96a;
  --red:   #ff4d4d;
  --green: #6bcf8f;
  --r:12px;
  --fh:'Bebas Neue',sans-serif;
  --fb:'Outfit',sans-serif;
  --fm:'JetBrains Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--fb);font-size:15px;min-height:100vh;}
.app{display:flex;flex-direction:column;min-height:100vh;max-width:540px;margin:0 auto;}

/* ── HEADER ── */
.hdr{position:sticky;top:0;z-index:60;background:#000;border-bottom:2px solid var(--gold);overflow:hidden;}
.hdr-inner{position:relative;z-index:1;padding:0 16px;display:flex;align-items:center;justify-content:space-between;height:66px;}
.logo-area{display:flex;align-items:center;gap:12px;}
.logo-img{height:32px;width:auto;object-fit:contain;filter:brightness(0) invert(1);}
.hdr-count{font-family:var(--fm);font-size:11px;color:var(--muted); letter-spacing:1px; text-transform:uppercase;}

/* ── BOTTOM NAV ── */
.bnav{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:540px;
  background:var(--s1);border-top:1px solid var(--border);
  display:flex; padding-bottom:env(safe-area-inset-bottom);z-index:60;
  height: 66px;
}
.ni{
  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  cursor:pointer;border:none;background:none;color:var(--muted);
  font-family:var(--fb);font-size:9px;letter-spacing:0.3px;gap:3px;
  transition:color 0.15s, background 0.15s; height:100%; padding:0 4px;
}
.ni.active{color:var(--text);}
.ni-i{font-size:20px;line-height:1;}
.ni-main{
  background:var(--gold);color:#000;font-family:var(--fh);font-size:12px;letter-spacing:1px;
  border-right: 1.5px solid #000; border-left: 1.5px solid #000;
}
.ni-main .ni-i {color:#000; margin-bottom: 2px;}
.ni-main.active, .ni-main:hover {background:var(--gold2); color:#000;}

/* ── MAIN ── */
.main{flex:1;padding:18px 16px 110px;overflow-y:auto;}

/* ── PAGE TITLES ── */
.ptitle{font-family:var(--fh);font-size:36px;letter-spacing:2px;margin-bottom:0;line-height:1;}
.ptitle span{color:var(--gold);}
.psub{font-size:11px;color:var(--muted);margin-bottom:18px;font-family:var(--fm);letter-spacing:1px;margin-top:4px;}

/* ── CARDS ── */
.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px;}
.card.gold-border{border-color:var(--gold);}
.ctitle{font-family:var(--fm);font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:12px;}

/* ── STAT ROW ── */
.srow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}
.sbox{background:var(--s1);border:1px solid var(--border);border-radius:10px;padding:12px 6px;text-align:center;}
.snum{font-family:var(--fh);font-size:30px;line-height:1;}
.slbl{font-size:9px;color:var(--muted);margin-top:3px;letter-spacing:0.5px;font-family:var(--fm);}
.sdelta{font-family:var(--fm);font-size:10px;margin-top:2px;}

/* ── TOGGLE ── */
.trow{display:flex;background:var(--s2);border-radius:10px;padding:3px;gap:3px;margin-bottom:14px;}
.tbtn{flex:1;padding:8px;border-radius:8px;border:none;cursor:pointer;background:transparent;color:var(--muted);font-family:var(--fm);font-size:10px;letter-spacing:1px;text-transform:uppercase;transition:all 0.15s;}
.tbtn.active{background:var(--s1);color:var(--gold);box-shadow:0 1px 6px rgba(0,0,0,0.6);}

/* ── ACCORDION / FORMS ── */
.fg{margin-bottom:14px;}
.fl{display:block;font-family:var(--fm);font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:7px;}
.fi,.fs,.fta{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--fb);font-size:15px;padding:11px 13px;outline:none;transition:border 0.15s;-webkit-appearance:none;appearance:none;}
.fi:focus,.fs:focus,.fta:focus{border-color:var(--gold);}
.fta{resize:vertical;min-height:90px;line-height:1.5;}
.fs option{background:var(--s2);}

/* ── TYPE GRID ── */
.type-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.tpill{padding:11px 10px;border-radius:10px;cursor:pointer;border:1.5px solid var(--border);background:var(--s2);color:var(--muted);font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;transition:all 0.15s;position:relative;}
.tpill.active{background:var(--s3);}
.tck{position:absolute;top:6px;right:8px;width:16px;height:16px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-size:9px;color:#000;font-weight:700;}

/* ── INTERACTION GROUPS (LOG ENTRY) ── */
.ig{padding:14px;border-radius:10px;margin-bottom:14px;background:var(--s1);border:1px solid var(--border);}
.ig-disc{border-color:rgba(255,77,77,0.3);background:linear-gradient(180deg, rgba(255,77,77,0.05) 0%, transparent 100%);}
.ig-train{border-color:rgba(201,168,76,0.3);background:linear-gradient(180deg, rgba(201,168,76,0.05) 0%, transparent 100%);}
.ig-praise{border-color:rgba(255,255,255,0.2);background:linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);}
.ig-title{font-family:var(--fh);font-size:20px;letter-spacing:1px;margin-bottom:12px;display:flex;align-items:center;gap:6px;}

/* ── SEVERITY ── */
.sevrow{display:flex;gap:6px;}
.sevpill{flex:1;padding:10px 4px;border-radius:10px;cursor:pointer;text-align:center;border:1.5px solid var(--border);background:var(--s2);font-size:12px;font-weight:600;color:var(--muted);transition:all 0.15s;}
.sevpill.active{border-width:2px;color:#fff;}

/* ── RATING ── */
.rrow{display:flex;gap:7px;align-items:center;}
.rbtn{width:42px;height:42px;border-radius:10px;border:1.5px solid var(--border);background:var(--s2);color:var(--muted);cursor:pointer;font-weight:700;font-size:16px;transition:all 0.15s;font-family:var(--fh);}
.rbtn.active{background:var(--gold);border-color:var(--gold);color:#000;}
.rlbl{font-size:11px;color:var(--muted);margin-left:4px;font-family:var(--fm);}

/* ── CHECKBOX ── */
.cbrow{display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 0;}
.cbbox{width:22px;height:22px;border-radius:6px;border:1.5px solid var(--border);background:var(--s2);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;}
.cbbox.on{background:var(--gold);border-color:var(--gold);}
.cblbl{font-size:14px;color:var(--text);}

/* ── ALSO RESPONSIBLE ── */
.also-section{background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-top:8px;}
.also-title{font-family:var(--fm);font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;}
.also-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
.also-chip{display:flex;align-items:center;gap:6px;background:var(--s3);border:1px solid var(--border2);border-radius:20px;padding:5px 10px;font-size:12px;}
.also-chip button{background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;line-height:1;padding:0;}
.also-linked{display:inline-flex;align-items:center;gap:4px;background:#C9A84C18;color:var(--gold);border:1px solid #C9A84C30;border-radius:6px;padding:2px 7px;font-size:10px;font-family:var(--fm);}

/* ── BUTTONS ── */
.btn-p{width:100%;padding:14px;border-radius:12px;border:2px solid var(--gold);cursor:pointer;background:var(--gold);color:#000;font-family:var(--fh);font-size:20px;letter-spacing:2px;transition:all 0.15s;margin-top:4px;}
.btn-p:disabled{opacity:0.3;cursor:not-allowed;}
.btn-p:hover:not(:disabled){background:var(--gold2);border-color:var(--gold2);}
.btn-s{padding:9px 16px;border-radius:9px;border:1px solid var(--border2);background:transparent;color:var(--muted);cursor:pointer;font-family:var(--fm);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;transition:all 0.15s;}
.btn-s:hover{border-color:var(--text);color:var(--text);}
.btn-d{padding:9px 16px;border-radius:9px;border:1px solid var(--red);background:transparent;color:var(--red);cursor:pointer;font-family:var(--fm);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;}
.btn-g{padding:9px 16px;border-radius:9px;border:1px solid var(--green);background:transparent;color:var(--green);cursor:pointer;font-family:var(--fm);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;}
.btn-full{display:block;width:100%;}

/* ── BADGE ── */
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:5px;padding:3px 8px;font-size:10px;font-family:var(--fm);letter-spacing:0.3px;}

/* ── LOG ITEM ── */
.li{background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;}
.li.linked{border-left:3px solid var(--gold);}
.lih{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;gap:8px;}
.lin{font-size:14px;color:var(--text);line-height:1.5;margin-bottom:5px;}
.lim{font-size:11px;color:var(--muted);font-family:var(--fm);display:flex;flex-wrap:wrap;gap:7px;align-items:center;}
.lir{font-family:var(--fh);font-size:20px;color:var(--gold);flex-shrink:0;}
.fuf{display:inline-flex;align-items:center;gap:3px;background:#C9A84C18;color:var(--gold);border:1px solid #C9A84C30;border-radius:5px;padding:2px 7px;font-size:10px;font-family:var(--fm);}

/* ── WORKER CARD ── */
.wcard{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:10px;cursor:pointer;transition:border-color 0.15s;display:flex;align-items:center;gap:14px;}
.wcard:active,.wcard:hover{border-color:var(--gold);}
.wav{width:46px;height:46px;border-radius:50%;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;border:1.5px solid var(--border2);}
.wname{font-family:var(--fh);font-size:20px;letter-spacing:0.5px;}
.wgrade{font-size:12px;color:var(--muted);margin-top:1px;}
.wmeta{flex:1;min-width:0;}
.wstat{text-align:right;flex-shrink:0;}
.wnum{font-family:var(--fh);font-size:26px;color:var(--gold);}
.wlbl{font-size:9px;color:var(--muted);font-family:var(--fm);}

/* ── SITE CARD ── */
.scrd{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:10px;}
.scrd-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;}
.sname{font-family:var(--fh);font-size:20px;letter-spacing:0.5px;}
.saddr{font-size:12px;color:var(--gold);margin-top:2px;font-family:var(--fm);}
.stype{font-size:10px;color:var(--muted);font-family:var(--fm);letter-spacing:1px;text-transform:uppercase;margin-top:4px;}

/* ── MODAL ── */
.moverlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:200;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:var(--s1);border:1px solid var(--border);border-top:2px solid var(--gold);border-radius:20px 20px 0 0;padding:22px 18px 44px;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;}
.mhandle{width:38px;height:3px;background:var(--border2);border-radius:99px;margin:0 auto 18px;}
.mtitle{font-family:var(--fh);font-size:26px;letter-spacing:1.5px;margin-bottom:14px;}
.sms-pre{background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;line-height:1.7;white-space:pre-wrap;font-family:var(--fb);color:var(--text);margin-bottom:14px;}
.mactions{display:flex;gap:10px;}

/* ── REPORT BUILDER ── */
.rf-section{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px;}
.rf-title{font-family:var(--fm);font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;}
.filter-chips{display:flex;flex-wrap:wrap;gap:6px;}
.fchip{padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--s2);color:var(--muted);cursor:pointer;font-family:var(--fm);font-size:11px;letter-spacing:0.5px;transition:all 0.15s;}
.fchip.on{background:var(--text);border-color:var(--text);color:#000;font-weight:600;}
.results-count{font-family:var(--fh);font-size:40px;color:var(--gold);line-height:1;}
.result-sub{font-family:var(--fm);font-size:10px;color:var(--muted);letter-spacing:1px;margin-top:2px;}

/* ── PROFILE ── */
.phdr{display:flex;align-items:center;gap:16px;margin-bottom:18px;}
.pav{width:62px;height:62px;border-radius:50%;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:28px;border:2px solid var(--gold);flex-shrink:0;}
.pname{font-family:var(--fh);font-size:28px;letter-spacing:1px;}
.pgrade{font-size:12px;color:var(--muted);margin-top:2px;}

/* ── COMP TAGS ── */
.ctag{display:inline-flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;transition:all 0.15s;margin:3px;}
.ctag.on{background:#C9A84C15;border-color:#C9A84C50;color:var(--gold);}

/* ── REPRIMAND ── */
.ritem{background:#ff4d4d0a;border:1px solid #ff4d4d25;border-radius:10px;padding:12px 14px;margin-bottom:8px;}

/* ── SETTINGS ── */
.set-item{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.set-tag{background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--text);flex:1;}

/* ── MULTISELECT DROPDOWN ── */
.ms-wrap{position:relative;}
.ms-trigger{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--fb);font-size:14px;padding:10px 13px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:border 0.15s;user-select:none;}
.ms-trigger:hover,.ms-trigger.open{border-color:var(--gold);}
.ms-trigger-left{display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:hidden;}
.ms-tags{display:flex;flex-wrap:nowrap;gap:5px;overflow:hidden;flex:1;min-width:0;}
.ms-tag{display:inline-flex;align-items:center;gap:4px;background:var(--text);color:#000;border-radius:5px;padding:2px 7px;font-size:11px;font-weight:600;font-family:var(--fm);white-space:nowrap;flex-shrink:0;}
.ms-tag button{background:none;border:none;cursor:pointer;color:#000;font-size:13px;line-height:1;padding:0;margin-left:1px;opacity:0.7;}
.ms-tag button:hover{opacity:1;}
.ms-overflow{font-size:11px;color:var(--gold);font-family:var(--fm);white-space:nowrap;flex-shrink:0;}
.ms-placeholder{color:var(--muted);font-size:14px;}
.ms-arrow{font-size:12px;color:var(--muted);flex-shrink:0;transition:transform 0.15s;}
.ms-arrow.open{transform:rotate(180deg);}
.ms-dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--s1);border:1px solid var(--gold);border-radius:10px;z-index:100;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.8);}
.ms-search{width:100%;background:var(--s2);border:none;border-bottom:1px solid var(--border);color:var(--text);font-family:var(--fb);font-size:14px;padding:10px 13px;outline:none;}
.ms-search::placeholder{color:var(--muted);}
.ms-list{max-height:220px;overflow-y:auto;padding:4px 0;}
.ms-list::-webkit-scrollbar{width:3px;}
.ms-list::-webkit-scrollbar-thumb{background:var(--border2);border-radius:99px;}
.ms-item{display:flex;align-items:center;gap:10px;padding:10px 13px;cursor:pointer;font-size:14px;transition:background 0.1s;}
.ms-item:hover{background:var(--s2);}
.ms-item.checked{background:var(--s3);}
.ms-check{width:18px;height:18px;border-radius:4px;border:1.5px solid var(--border2);background:var(--s2);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.1s;}
.ms-check.on{background:var(--gold);border-color:var(--gold);}
.ms-item-name{flex:1;}
.ms-item-addr{font-size:11px;color:var(--muted);font-family:var(--fm);margin-top:1px;}
.ms-footer{padding:8px 13px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;}
.ms-count{font-family:var(--fm);font-size:10px;color:var(--muted);letter-spacing:1px;}
.ms-clear{font-family:var(--fm);font-size:10px;color:var(--red);cursor:pointer;background:none;border:none;letter-spacing:1px;text-transform:uppercase;}

/* ── EMPTY ── */
.empty{text-align:center;padding:36px 16px;color:var(--muted);font-size:14px;}
.empty-i{font-size:34px;margin-bottom:8px;}

/* ── OTHER INLINE ── */
.other-row{display:flex;gap:8px;margin-top:8px;}

/* ── TOAST ── */
.toast{position:fixed;top:72px;left:50%;transform:translateX(-50%);background:var(--gold);color:#000;border-radius:10px;padding:11px 22px;font-weight:700;font-size:14px;z-index:999;box-shadow:0 4px 20px rgba(201,168,76,0.4);animation:td 0.2s ease;white-space:nowrap;font-family:var(--fh);letter-spacing:1px;}
@keyframes td{from{opacity:0;transform:translateX(-50%) translateY(-8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}

.divider{border:none;border-top:1px solid var(--border);margin:14px 0;}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:99px;}
`;

// ─── SELECT WITH OTHER ────────────────────────────────────────────────────────

function SelectWithOther({ value, onChange, options, placeholder = "Select…" }) {
  const isCustom = value && !options.includes(value);
  const[showCustom, setShowCustom] = useState(isCustom);
  const[custom, setCustom] = useState(isCustom ? value : "");

  function handleSel(e) {
    if (e.target.value === "__other__") { setShowCustom(true); onChange(""); }
    else { setShowCustom(false); onChange(e.target.value); }
  }

  return (
    <div>
      <select className="fs" value={showCustom ? "__other__" : (value || "")} onChange={handleSel}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o}>{o}</option>)}
        <option value="__other__">Other (specify)…</option>
      </select>
      {showCustom && (
        <div className="other-row">
          <input className="fi" placeholder="Type custom value…" value={custom}
            onChange={e => { setCustom(e.target.value); onChange(e.target.value); }} />
        </div>
      )}
    </div>
  );
}

// ─── SITE MULTI-SELECT DROPDOWN ──────────────────────────────────────────────

function SiteMultiSelect({ selected, onChange, sites }) {
  const[open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");

  const filtered = sites.filter(s =>
    (s.address||"").toLowerCase().includes(search.toLowerCase()) ||
    (s.builders||[]).some(b => b.toLowerCase().includes(search.toLowerCase()))
  );

  function toggle(id) { onChange(selected.includes(id) ? selected.filter(x => x !== id) :[...selected, id]); }
  function clear(e) { e.stopPropagation(); onChange([]); }

  const selectedSites = sites.filter(s => selected.includes(s.id));
  const visibleTags   = selectedSites.slice(0, 2);
  const overflow      = selectedSites.length - 2;

  return (
    <div className="ms-wrap">
      <div className={`ms-trigger${open ? " open" : ""}`} onClick={() => setOpen(o => !o)}>
        <div className="ms-trigger-left">
          {selected.length === 0
            ? <span className="ms-placeholder">All sites (no filter)</span>
            : (
              <div className="ms-tags">
                {visibleTags.map(s => (
                  <span key={s.id} className="ms-tag">
                    {s.address.split(",")[0]}
                    <button onClick={e => { e.stopPropagation(); toggle(s.id); }}>×</button>
                  </span>
                ))}
                {overflow > 0 && <span className="ms-overflow">+{overflow} more</span>}
              </div>
            )
          }
        </div>
        <span className={`ms-arrow${open ? " open" : ""}`}>▼</span>
      </div>

      {open && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:99 }} onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="ms-dropdown">
            <input className="ms-search" placeholder="🔍  Search site addresses…" value={search} onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus />
            <div className="ms-list">
              {filtered.length === 0
                ? <div style={{ padding:"14px", color:"var(--muted)", fontSize:13, textAlign:"center" }}>No sites found</div>
                : filtered.map(s => (
                  <div key={s.id} className={`ms-item${selected.includes(s.id) ? " checked" : ""}`} onClick={e => { e.stopPropagation(); toggle(s.id); }}>
                    <div className={`ms-check${selected.includes(s.id) ? " on" : ""}`}>
                      {selected.includes(s.id) && <span style={{ color:"#000", fontWeight:700, fontSize:11 }}>✓</span>}
                    </div>
                    <div>
                      <div className="ms-item-name">{s.address}</div>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="ms-footer">
              <span className="ms-count">{selected.length} SELECTED OF {sites.length}</span>
              {selected.length > 0 && <button className="ms-clear" onClick={clear}>Clear All</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── STRING MULTI-SELECT DROPDOWN ─────────────────────────────────────────────

function StringMultiSelect({ selected =[], onChange, options =[], placeholder = "Select…" }) {
  const [open, setOpen] = useState(false);
  function toggle(val) { onChange(selected.includes(val) ? selected.filter(x => x !== val) :[...selected, val]); }
  function clear(e) { e.stopPropagation(); onChange([]); }

  return (
    <div className="ms-wrap">
      <div className={`ms-trigger${open ? " open" : ""}`} onClick={() => setOpen(o => !o)}>
        <div className="ms-trigger-left">
          {selected.length === 0
            ? <span className="ms-placeholder">{placeholder}</span>
            : (
              <div className="ms-tags">
                {selected.slice(0, 2).map(s => (
                  <span key={s} className="ms-tag">
                    {s}
                    <button onClick={e => { e.stopPropagation(); toggle(s); }}>×</button>
                  </span>
                ))}
                {selected.length > 2 && <span className="ms-overflow">+{selected.length - 2} more</span>}
              </div>
            )
          }
        </div>
        <span className={`ms-arrow${open ? " open" : ""}`}>▼</span>
      </div>

      {open && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:99 }} onClick={() => setOpen(false)} />
          <div className="ms-dropdown">
            <div className="ms-list">
              {options.length === 0 && <div style={{ padding:"14px", color:"var(--muted)", fontSize:13, textAlign:"center" }}>No options available</div>}
              {options.map(o => (
                <div key={o} className={`ms-item${selected.includes(o) ? " checked" : ""}`} onClick={e => { e.stopPropagation(); toggle(o); }}>
                  <div className={`ms-check${selected.includes(o) ? " on" : ""}`}>
                    {selected.includes(o) && <span style={{ color:"#000", fontWeight:700, fontSize:11 }}>✓</span>}
                  </div>
                  <div className="ms-item-name">{o}</div>
                </div>
              ))}
            </div>
            <div className="ms-footer">
              <span className="ms-count">{selected.length} SELECTED</span>
              {selected.length > 0 && <button className="ms-clear" onClick={clear}>Clear All</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TypeBadge({ type }) {
  const t = LOG_TYPES.find(x => x.id === type);
  if (!t) return null;
  return <span className="badge" style={{ background: t.color + "18", color: t.color, border: `1px solid ${t.color}35` }}>{t.icon} {t.label}</span>;
}

function SevBadge({ severity }) {
  const s = SEVERITY_LEVELS.find(x => x.id === severity);
  if (!s) return null;
  return <span className="badge" style={{ background: s.color + "18", color: s.color, border: `1px solid ${s.color}35` }}>{s.label}</span>;
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]         = useState("dashboard");
  const[workers, setWorkers]   = useState(() => lsGet("pg_workers", DEFAULT_WORKERS));
  const [sites, setSites]       = useState(() => {
    const s = lsGet("pg_sites", DEFAULT_SITES);
    return s.map(x => ({ ...x, address: x.address || x.name, builders: x.builders ||[], supervisor: x.supervisor || "" }));
  });
  const[logs, setLogs]         = useState(() => {
    const l = lsGet("pg_logs",[]);
    return l.filter(x => x.role !== "also");
  });
  const[profileId, setProfileId] = useState(null);
  const[toast,   setToast]     = useState(null);
  const [smsModal, setSmsModal] = useState(null);

  const[skillAreas,  setSkillAreas]  = useState(() => lsGet("pg_skills",   DEFAULT_SKILL_AREAS));
  const [grades,      setGrades]      = useState(() => lsGet("pg_grades",   DEFAULT_GRADES));
  const[safeCats,    setSafeCats]    = useState(() => lsGet("pg_safecat",  DEFAULT_SAFETY_CATS));
  const[builders,    setBuilders]    = useState(() => lsGet("pg_builders", DEFAULT_BUILDERS));
  const[supervisors, setSupervisors] = useState(() => lsGet("pg_supervisors", DEFAULT_SUPERVISORS));

  useEffect(() => { lsSet("pg_workers", workers); }, [workers]);
  useEffect(() => { lsSet("pg_sites",   sites);   },[sites]);
  useEffect(() => { lsSet("pg_logs",    logs);     }, [logs]);
  useEffect(() => { lsSet("pg_skills",  skillAreas);  }, [skillAreas]);
  useEffect(() => { lsSet("pg_grades",  grades);      }, [grades]);
  useEffect(() => { lsSet("pg_safecat", safeCats);    }, [safeCats]);
  useEffect(() => { lsSet("pg_builders", builders);   }, [builders]);
  useEffect(() => { lsSet("pg_supervisors", supervisors); }, [supervisors]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }
  function openProfile(id) { setProfileId(id); setView("profile"); }
  
  function sName(id)      { return sites.find(s => s.id === id)?.address || id || "—"; }
  function sNameShort(id) { const s = sites.find(x => x.id === id); return s ? s.address.split(",")[0] : (id || "—"); }
  function wName(id)      { return workers.find(w => w.id === id)?.name || "—"; }
  
  function primaryLogs(id){ return logs.filter(l => l.workerId === id); }
  function alsoLogs(id)   { return logs.filter(l => (l.alsoResponsible ||[]).includes(id)); }

  // ── LOG FORM ──────────────────────────────────────────────────────────────

  const blankForm = {
    workerId: "", alsoResponsible:[], siteId: "", date: isoToday(),
    types:[], severity: "minor", safetyCategory: "", skillArea: "",
    trainingComment: "", praiseComment: "", safetyComment: "",
    rating: 3, notes: "", followUp: false, photo: null,
  };
  const [form, setForm] = useState(blankForm);
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function toggleType(id) {
    setForm(f => ({ ...f, types: f.types.includes(id) ? f.types.filter(t => t !== id) :[...f.types, id] }));
  }
  function toggleAlso(id) {
    setForm(f => ({
      ...f,
      alsoResponsible: f.alsoResponsible.includes(id) ? f.alsoResponsible.filter(x => x !== id) : [...f.alsoResponsible, id]
    }));
  }

  const isDisc   = form.types.includes("discipline");
  const isTrain  = form.types.includes("training");
  const isPraise = form.types.includes("praise");
  
  const isValid = form.workerId && form.siteId && form.types.length > 0 && form.notes.trim();

  function submitLog() {
    const site = sites.find(s => s.id === form.siteId);
    const primaryLog = { 
      id: uid(), 
      siteAddress: site?.address, 
      builders: site?.builders ||[],
      supervisor: site?.supervisor || "",
      ...form 
    };

    setLogs(p => [primaryLog, ...p]);
    setForm(blankForm);
    showToast("✓ Entry saved");
    if (isDisc) {
      const worker = workers.find(w => w.id === form.workerId);
      setSmsModal({ worker, log: primaryLog });
    } else {
      setView("dashboard");
    }
  }

  function handlePhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => sf("photo", ev.target.result);
    r.readAsDataURL(file);
  }

  // ── DASHBOARD DATA ────────────────────────────────────────────────────────

  const[dashPeriod, setDashPeriod] = useState("week");
  const isCur = dashPeriod === "week" ? isThisWeek  : isThisMonth;
  const isPrv = dashPeriod === "week" ? isLastWeek  : isLastMonth;
  const curLogs = useMemo(() => logs.filter(l => isCur(l.date)),[logs, isCur]);
  const prvLogs = useMemo(() => logs.filter(l => isPrv(l.date)), [logs, isPrv]);

  const typeCounts = useMemo(() => LOG_TYPES.map(t => ({
    ...t,
    cur: curLogs.filter(l => (l.types ||[]).includes(t.id)).length,
    prv: prvLogs.filter(l => (l.types ||[]).includes(t.id)).length,
  })),[curLogs, prvLogs]);

  const pieData = typeCounts.filter(t => t.cur > 0).map(t => ({ name: t.label, value: t.cur, color: t.color }));

  const sevData = SEVERITY_LEVELS.map(s => ({
    name: s.label,
    count: curLogs.filter(l => (l.types||[]).includes('discipline') && l.severity === s.id).length,
    color: s.color
  }));

  const siteCounts = useMemo(() => {
    const map = {};
    logs.forEach(l => { const n = sNameShort(l.siteId); map[n] = (map[n] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([s, c]) => ({ s, c }));
  }, [logs, sites]);

  const employeeActivity = useMemo(() => workers.map(w => {
    const wl = primaryLogs(w.id);
    return {
      name: w.name, 
      training:   wl.filter(l => (l.types||[]).includes("training")).length,
      praise:     wl.filter(l => (l.types||[]).includes("praise")).length,
      discipline: wl.filter(l => (l.types||[]).includes("discipline")).length,
      other:      wl.filter(l => (l.types||[]).includes("other")).length,
    };
  }),[workers, logs]);

  const maxSite = siteCounts[0]?.c || 1;
  const followUps = useMemo(() => logs.filter(l => l.followUp), [logs]);

  // ════════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════════════════════════

  function Dashboard() {
    function delta(c, p) {
      if (c === p) return <span style={{ color: "var(--muted)" }}>—</span>;
      if (c > p)   return <span style={{ color: "var(--green)" }}>↑{c - p}</span>;
      return           <span style={{ color: "var(--red)" }}>↓{p - c}</span>;
    }
    return (
      <div>
        <div className="ptitle">STAT<span>ISTICS</span></div>
        <div className="psub">⚡ PROGLOW FIELD ACTIVITY</div>

        <div className="trow">
          <button className={`tbtn${dashPeriod === "week"  ? " active" : ""}`} onClick={() => setDashPeriod("week")}>This Week</button>
          <button className={`tbtn${dashPeriod === "month" ? " active" : ""}`} onClick={() => setDashPeriod("month")}>This Month</button>
        </div>

        <div className="srow">
          {typeCounts.map(t => (
            <div className="sbox" key={t.id}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
              <div className="snum" style={{ color: t.color }}>{t.cur}</div>
              <div className="sdelta">{delta(t.cur, t.prv)}</div>
              <div className="slbl">{t.label.split(" ")[0]}</div>
            </div>
          ))}
        </div>

        {pieData.length > 0 && (
          <div className="card">
            <div className="ctitle">Interactions Breakdown</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} stroke="var(--s1)">
                  {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10, color: "var(--muted)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {sevData.some(s => s.count > 0) && (
          <div className="card">
            <div className="ctitle">Discipline Severities</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={sevData} margin={{ top: 10, right: 10, bottom: 0, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} allowDecimals={false} />
                <Tooltip cursor={{fill: 'var(--s2)'}} contentStyle={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {sevData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card">
          <div className="ctitle">Activity by Employee</div>
          {employeeActivity.every(e => e.training + e.praise + e.discipline + e.other === 0)
            ? <div className="empty"><div className="empty-i">👷</div>No entries yet</div>
            : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={employeeActivity} margin={{ top: 4, right: 4, bottom: 40, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 10 }} angle={-35} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend verticalAlign="top" wrapperStyle={{ fontSize: 10, color: "var(--muted)", paddingBottom: 10 }} />
                  <Bar dataKey="training"   fill="#C9A84C" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="praise"     fill="#ffffff" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="discipline" fill="#ff4d4d" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="other"      fill="#888888" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {followUps.length > 0 && (
          <div className="card" style={{ borderColor: "#C9A84C40", background: "#C9A84C08" }}>
            <div className="ctitle" style={{ color: "var(--gold)" }}>🔔 Follow-ups Required ({followUps.length})</div>
            {followUps.slice(0, 3).map(l => (
              <div key={l.id} style={{ fontSize: 13, marginBottom: 5 }}>
                <strong>{wName(l.workerId)}</strong> — {l.skillArea || l.safetyCategory || "General"}
                <span style={{ color: "var(--muted)", marginLeft: 6 }}>{fmtDate(l.date)}</span>
              </div>
            ))}
            {followUps.length > 3 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>+{followUps.length - 3} more</div>}
          </div>
        )}

        <div className="card">
          <div className="ctitle">Recent Entries</div>
          {logs.length === 0
            ? <div className="empty"><div className="empty-i">📋</div>No entries yet — tap Log to get started</div>
            : logs.slice(0, 5).map(l => (
              <div className="li" key={l.id}>
                <div className="lih">
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(l.types ||[]).map(t => <TypeBadge key={t} type={t} />)}
                    {(l.types ||[]).includes("discipline") && <SevBadge severity={l.severity} />}
                  </div>
                  <div className="lir">{l.rating}/5</div>
                </div>
                <div className="lin">{l.notes}</div>
                <div className="lim">
                  <span style={{color:"var(--gold)"}}>{wName(l.workerId)}</span>
                  <span>{sNameShort(l.siteId)}</span>
                  <span>{fmtDate(l.date)}</span>
                  {l.followUp && <span className="fuf">🔔</span>}
                  {(l.alsoResponsible ||[]).length > 0 && (
                    <span className="also-linked">+{l.alsoResponsible.length} also present</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LOG ENTRY
  // ════════════════════════════════════════════════════════════════════════════

  function LogEntry() {
    const availableAlso = workers.filter(w => w.id !== form.workerId);
    return (
      <div>
        <div className="ptitle">LOG <span>ENTRY</span></div>
        <div className="psub">RECORD INTERACTION OR OBSERVATION</div>
        <div className="card">

          {/* 1 — Worker */}
          <div className="fg">
            <label className="fl">1. Primary Responsible Worker</label>
            <select className="fs" value={form.workerId} onChange={e => { sf("workerId", e.target.value); sf("alsoResponsible",[]); }}>
              <option value="">Select worker…</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name} — {w.grade}</option>)}
            </select>

            {/* Also Responsible */}
            {form.workerId && (
              <div className="also-section">
                <div className="also-title">Also Responsible / On-Site</div>
                {form.alsoResponsible.length > 0 && (
                  <div className="also-chips">
                    {form.alsoResponsible.map(id => (
                      <div className="also-chip" key={id}>
                        <span>👷 {wName(id)}</span>
                        <button onClick={() => toggleAlso(id)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <select className="fs" value="" onChange={e => { if (e.target.value) toggleAlso(e.target.value); }}>
                  <option value="">Add person also on-site…</option>
                  {availableAlso.filter(w => !form.alsoResponsible.includes(w.id)).map(w => (
                    <option key={w.id} value={w.id}>{w.name} — {w.grade}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 2 — Site */}
          <div className="fg">
            <label className="fl">2. Site / Address</label>
            <select className="fs" value={form.siteId} onChange={e => sf("siteId", e.target.value)}>
              <option value="">Select site…</option>
              {sites.map(s => <option key={s.id} value={s.id}>{sNameShort(s.id)} — {s.address}</option>)}
            </select>
          </div>

          {/* 3 — Date */}
          <div className="fg">
            <label className="fl">3. Date</label>
            <input type="date" className="fi" value={form.date} onChange={e => sf("date", e.target.value)} />
          </div>

          {/* 4 — Types */}
          <div className="fg">
            <label className="fl">4. Interaction Type (select all that apply)</label>
            <div className="type-grid">
              {LOG_TYPES.map(t => (
                <div key={t.id}
                  className={`tpill${form.types.includes(t.id) ? " active" : ""}`}
                  style={form.types.includes(t.id) ? { borderColor: t.color, color: t.color } : {}}
                  onClick={() => toggleType(t.id)}>
                  <span style={{ fontSize: 20 }}>{t.icon}</span>{t.label}
                  {form.types.includes(t.id) && <span className="tck">✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Contextual Separated Detail Groups */}
          {isDisc && (
            <div className="ig ig-disc">
              <div className="ig-title" style={{color:"var(--red)"}}>⚠️ Safety & Discipline Details</div>
              <div className="fg">
                <label className="fl">Severity</label>
                <div className="sevrow">
                  {SEVERITY_LEVELS.map(s => (
                    <div key={s.id}
                      className={`sevpill${form.severity === s.id ? " active" : ""}`}
                      style={form.severity === s.id ? { borderColor: s.color, background: s.color } : {}}
                      onClick={() => sf("severity", s.id)}>
                      {s.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="fg">
                <label className="fl">Safety / Discipline Category</label>
                <SelectWithOther value={form.safetyCategory} onChange={v => sf("safetyCategory", v)} options={safeCats} placeholder="Select category…" />
              </div>
              <div className="fg" style={{marginBottom:0}}>
                <label className="fl">Safety / Discipline Comments</label>
                <textarea className="fta" placeholder="Specific details regarding this incident..." value={form.safetyComment} onChange={e => sf("safetyComment", e.target.value)} />
              </div>
            </div>
          )}

          {isTrain && (
             <div className="ig ig-train">
              <div className="ig-title" style={{color:"var(--gold)"}}>📘 Training Details</div>
              <div className="fg">
                <label className="fl">Skill Area</label>
                <SelectWithOther value={form.skillArea} onChange={v => sf("skillArea", v)} options={skillAreas} placeholder="Select skill area…" />
              </div>
              <div className="fg" style={{marginBottom:0}}>
                <label className="fl">Training Comments</label>
                <textarea className="fta" placeholder="What was covered or demonstrated..." value={form.trainingComment} onChange={e => sf("trainingComment", e.target.value)} />
              </div>
            </div>
          )}

          {isPraise && (
             <div className="ig ig-praise">
              <div className="ig-title" style={{color:"#fff"}}>⭐ Praise Details</div>
              <div className="fg" style={{marginBottom:0}}>
                <label className="fl">Praise Comments</label>
                <textarea className="fta" placeholder="What was done well..." value={form.praiseComment} onChange={e => sf("praiseComment", e.target.value)} />
              </div>
            </div>
          )}

          {/* Rating (Always visible) */}
          <div className="fg">
            <label className="fl" style={{fontSize: 14, color: "var(--gold)", letterSpacing:"1px"}}>Team Rating</label>
            <div style={{fontSize: 11, color: "var(--muted)", marginBottom: 10}}>Based on how well the team is working together, everyone has a task and a plan for the day, etc.</div>
            <div className="rrow">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className={`rbtn${form.rating === n ? " active" : ""}`} onClick={() => sf("rating", n)}>{n}</button>
              ))}
              <span className="rlbl">{["", "Poor", "Below Avg", "Average", "Good", "Excellent"][form.rating]}</span>
            </div>
          </div>

          {/* Notes (Always visible) */}
          <div className="fg">
            <label className="fl">General Notes & Observations</label>
            <textarea className="fta"
              placeholder="General context, overall day progress..."
              value={form.notes} onChange={e => sf("notes", e.target.value)} />
          </div>

          {/* Photo */}
          <div className="fg">
            <label className="fl">Photo / Attachment</label>
            <label style={{ display: "block", border: "1.5px dashed var(--border2)", borderRadius: 10, padding: 16, textAlign: "center", cursor: "pointer", background: "var(--s2)", color: "var(--muted)", fontSize: 13 }}>
              {form.photo
                ? <img src={form.photo} alt="att" style={{ width: "100%", borderRadius: 8, maxHeight: 180, objectFit: "cover" }} />
                : <><div style={{ fontSize: 26, marginBottom: 4 }}>📎</div>Tap to attach a photo</>}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
            </label>
          </div>

          {/* Follow-up */}
          <label className="cbrow" onClick={() => sf("followUp", !form.followUp)}>
            <div className={`cbbox${form.followUp ? " on" : ""}`}>{form.followUp && <span style={{ color: "#000", fontWeight: 700, fontSize: 13 }}>✓</span>}</div>
            <span className="cblbl">🔔 Flag for follow-up</span>
          </label>

          <hr className="divider" />
          <button className="btn-p" disabled={!isValid} onClick={submitLog}>
            SAVE ENTRY{isDisc ? " & GENERATE NOTICE" : ""}
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEAM
  // ════════════════════════════════════════════════════════════════════════════

  function Team() {
    const [showAdd, setShowAdd] = useState(false);
    const[af, setAf] = useState({ name: "", grade: grades[0] });

    function addWorker() {
      if (!af.name.trim()) return;
      setWorkers(p =>[...p, { id: uid(), ...af, competencies:[] }]);
      setShowAdd(false); showToast("✓ Worker added");
      setAf({ name: "", grade: grades[0] });
    }

    return (
      <div>
        <div className="ptitle">TEAM <span>ROSTER</span></div>
        <div className="psub">{workers.length} WORKERS ACTIVE</div>
        <button className="btn-s btn-full" style={{ marginBottom: 14, padding: 12 }} onClick={() => setShowAdd(true)}>＋ Add Worker</button>

        {workers.map(w => {
          const wl = primaryLogs(w.id);
          const reps = wl.filter(l => (l.types ||[]).includes("discipline"));
          return (
            <div className="wcard" key={w.id} onClick={() => openProfile(w.id)}>
              <div className="wav">👷</div>
              <div className="wmeta">
                <div className="wname">{w.name}</div>
                <div className="wgrade">{w.grade}</div>
                {reps.length > 0 && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 3 }}>⚠️ {reps.length} discipline log{reps.length > 1 ? "s" : ""}</div>}
              </div>
              <div className="wstat">
                <div className="wnum">{wl.length}</div>
                <div className="wlbl">logs</div>
              </div>
            </div>
          );
        })}

        {showAdd && (
          <div className="moverlay" onClick={() => setShowAdd(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="mhandle" />
              <div className="mtitle">ADD WORKER</div>
              <div className="fg"><label className="fl">Full Name</label><input className="fi" placeholder="e.g. Alex Johnson" value={af.name} onChange={e => setAf(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="fg">
                <label className="fl">Grade</label>
                <select className="fs" value={af.grade} onChange={e => setAf(f => ({ ...f, grade: e.target.value }))}>
                  {grades.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="mactions">
                <button className="btn-s" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn-p" style={{ flex: 1 }} onClick={addWorker}>ADD WORKER</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SITES
  // ════════════════════════════════════════════════════════════════════════════

  function SitesView() {
    const[showAdd, setShowAdd] = useState(false);
    const [editId, setEditId]   = useState(null);
    const[af, setAf] = useState({ address: "", builders:[], supervisor: "" });

    function openAdd()    { setAf({ address: "", builders:[], supervisor: "" }); setEditId(null); setShowAdd(true); }
    function openEdit(s)  { setAf({ address: s.address, builders: s.builders ||[], supervisor: s.supervisor || "" }); setEditId(s.id); setShowAdd(true); }
    
    function save() {
      if (!af.address.trim()) return;
      if (editId) { setSites(p => p.map(s => s.id === editId ? { ...s, ...af } : s)); showToast("✓ Site updated"); }
      else        { setSites(p =>[...p, { id: uid(), ...af }]); showToast("✓ Site added"); }
      setShowAdd(false);
    }
    
    function deleteSite(id) {
      if (!window.confirm("Delete this site?")) return;
      setSites(p => p.filter(s => s.id !== id)); showToast("Site deleted");
    }

    return (
      <div>
        <div className="ptitle">JOB <span>SITES</span></div>
        <div className="psub">{sites.length} SITES REGISTERED</div>
        <button className="btn-s btn-full" style={{ marginBottom: 14, padding: 12 }} onClick={openAdd}>＋ Add Site</button>

        {sites.map(s => {
          const cnt = logs.filter(l => l.siteId === s.id).length;
          return (
            <div className="scrd" key={s.id}>
              <div className="scrd-top">
                <div style={{ paddingRight: 10 }}>
                  <div className="sname">{s.address}</div>
                  <div className="saddr">Builders: {(s.builders||[]).join(", ") || "None"}</div>
                  <div className="stype">Supervisor: {s.supervisor || "Unassigned"}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--fh)", fontSize: 22, color: "var(--gold)" }}>{cnt}</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--muted)" }}>logs</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn-s" onClick={() => openEdit(s)}>Edit</button>
                <button className="btn-d" onClick={() => deleteSite(s.id)}>Delete</button>
              </div>
            </div>
          );
        })}

        {showAdd && (
          <div className="moverlay" onClick={() => setShowAdd(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="mhandle" />
              <div className="mtitle">{editId ? "EDIT SITE" : "ADD SITE"}</div>
              <div className="fg">
                <label className="fl">Job Address (Primary Reference)</label>
                <input className="fi" placeholder="e.g. 123 Main St, Melbourne VIC 3000" value={af.address} onChange={e => setAf(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">Builder(s)</label>
                <StringMultiSelect selected={af.builders} onChange={v => setAf(f => ({ ...f, builders: v }))} options={builders} placeholder="Select Builder(s)..." />
              </div>
              <div className="fg">
                <label className="fl">Supervisor</label>
                <SelectWithOther value={af.supervisor} onChange={v => setAf(f => ({ ...f, supervisor: v }))} options={supervisors} placeholder="Select Supervisor..." />
              </div>
              <div className="mactions">
                <button className="btn-s" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn-p" style={{ flex: 1 }} onClick={save}>SAVE SITE</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REPORTS
  // ════════════════════════════════════════════════════════════════════════════

  function Reports() {
    const [filters, setFilters] = useState({
      workers:[],
      types: [],
      sites:[],
      skillArea: "",
      severity: "",
      dateFrom: isoSixMonthsAgo(),
      dateTo: isoToday(),
      role: "all", 
      followUpOnly: false,
    });
    const[previewMode, setPreviewMode] = useState(false);

    function toggleArr(key, val) {
      setFilters(f => ({ ...f,[key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] }));
    }

    const filtered = useMemo(() => {
      return logs.filter(l => {
        const isPrim = filters.workers.includes(l.workerId);
        const isAlso = (l.alsoResponsible||[]).some(w => filters.workers.includes(w));

        if (filters.workers.length > 0) {
          if (filters.role === "primary" && !isPrim) return false;
          if (filters.role === "also" && !isAlso) return false;
          if (filters.role === "all" && !isPrim && !isAlso) return false;
        } else {
          if (filters.role === "also" && !(l.alsoResponsible?.length > 0)) return false;
        }

        if (filters.types.length     && !filters.types.some(t => (l.types||[]).includes(t))) return false;
        if (filters.sites.length     && !filters.sites.includes(l.siteId)) return false;
        if (filters.skillArea        && l.skillArea !== filters.skillArea && l.safetyCategory !== filters.skillArea) return false;
        if (filters.severity         && l.severity !== filters.severity) return false;
        if (filters.dateFrom         && l.date < filters.dateFrom) return false;
        if (filters.dateTo           && l.date > filters.dateTo) return false;
        if (filters.followUpOnly     && !l.followUp) return false;
        return true;
      });
    }, [logs, filters]);

    const reportRows = useMemo(() => filtered.map(l => {
      const site = sites.find(s => s.id === l.siteId);
      return {
        ...l,
        workerName: wName(l.workerId),
        alsoNames: (l.alsoResponsible ||[]).map(id => wName(id)),
        siteAddress: sName(l.siteId),
        builders: site?.builders ||[],
        supervisor: site?.supervisor || ""
      }
    }),[filtered, sites, workers]);

    const activeFilterCount =[
      filters.workers.length > 0, filters.types.length > 0, filters.sites.length > 0,
      !!filters.skillArea, !!filters.severity, 
      (filters.dateFrom !== isoSixMonthsAgo() || filters.dateTo !== isoToday()),
      filters.role !== "all", filters.followUpOnly,
    ].filter(Boolean).length;

    function buildMetaString() {
      const parts =[];
      if (filters.workers.length)  parts.push(`Workers: ${filters.workers.map(wName).join(", ")}`);
      if (filters.types.length)    parts.push(`Types: ${filters.types.map(t => LOG_TYPES.find(x=>x.id===t)?.label).join(", ")}`);
      if (filters.sites.length)    parts.push(`Sites: ${filters.sites.map(sNameShort).join(", ")}`);
      if (filters.skillArea)       parts.push(`Skill/Cat: ${filters.skillArea}`);
      if (filters.severity)        parts.push(`Severity: ${filters.severity}`);
      if (filters.dateFrom)        parts.push(`From: ${fmtDate(filters.dateFrom)}`);
      if (filters.dateTo)          parts.push(`To: ${fmtDate(filters.dateTo)}`);
      if (filters.role !== "all")  parts.push(`Role: ${filters.role === "primary" ? "Primary Only" : "Also Responsible Only"}`);
      if (filters.followUpOnly)    parts.push("Follow-ups only");
      return parts.length ? parts.join(" · ") : "All records";
    }

    return (
      <div>
        <div className="ptitle">CUSTOM <span>REPORTS</span></div>
        <div className="psub">FILTER · PREVIEW · EXPORT</div>

        {/* Results counter */}
        <div className="card gold-border" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="results-count">{filtered.length}</div>
            <div className="result-sub">RECORDS MATCH{activeFilterCount > 0 ? ` · ${activeFilterCount} FILTER${activeFilterCount>1?"S":""} ACTIVE` : " · DEFAULT RANGE"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
            <button className="btn-g" onClick={() => { setPreviewMode(true); }}>👁 Preview</button>
            {filtered.length > 0 && (
              <button className="btn-s" style={{color:"var(--text)", borderColor:"var(--text)"}} onClick={() => printReport("Field Log Report", reportRows, buildMetaString())}>
                🖨 Print / Save as PDF
              </button>
            )}
          </div>
        </div>

        {/* Filter: Workers */}
        <div className="rf-section">
          <div className="rf-title">Filter by Worker</div>
          <div className="filter-chips">
            {workers.map(w => (
              <div key={w.id} className={`fchip${filters.workers.includes(w.id) ? " on" : ""}`} onClick={() => toggleArr("workers", w.id)}>
                👷 {w.name}
              </div>
            ))}
          </div>
        </div>

        {/* Filter: Role */}
        <div className="rf-section">
          <div className="rf-title">Filter by Role in Incident</div>
          <div className="filter-chips">
            {[["all","Any Role"],["primary","Primary Responsible Only"],["also","Also Responsible / On-Site Only"]].map(([val, label]) => (
              <div key={val} className={`fchip${filters.role === val ? " on" : ""}`} onClick={() => setFilters(f => ({ ...f, role: val }))}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Filter: Types */}
        <div className="rf-section">
          <div className="rf-title">Filter by Interaction Type</div>
          <div className="filter-chips">
            {LOG_TYPES.map(t => (
              <div key={t.id} className={`fchip${filters.types.includes(t.id) ? " on" : ""}`} onClick={() => toggleArr("types", t.id)}>
                {t.icon} {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Filter: Sites */}
        <div className="rf-section">
          <div className="rf-title">Filter by Site</div>
          <SiteMultiSelect selected={filters.sites} onChange={val => setFilters(f => ({ ...f, sites: val }))} sites={sites} />
        </div>

        {/* Filter: Date Range */}
        <div className="rf-section">
          <div className="rf-title">Date Range</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="fl">From</label><input type="date" className="fi" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} /></div>
            <div><label className="fl">To</label><input type="date" className="fi" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} /></div>
          </div>
        </div>

        {/* Filter: Skill Area */}
        <div className="rf-section">
          <div className="rf-title">Filter by Skill Area</div>
          <div className="filter-chips">
            <div className={`fchip${!filters.skillArea ? " on" : ""}`} onClick={() => setFilters(f => ({ ...f, skillArea: "" }))}>Any</div>
            {skillAreas.map(s => (
              <div key={s} className={`fchip${filters.skillArea === s ? " on" : ""}`} onClick={() => setFilters(f => ({ ...f, skillArea: s }))}>
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Reset */}
        {activeFilterCount > 0 && (
          <button className="btn-d btn-full" style={{ padding: 12, marginTop: 16 }} onClick={() => setFilters({ workers:[], types:[], sites:[], skillArea:"", severity:"", dateFrom:isoSixMonthsAgo(), dateTo:isoToday(), role:"all", followUpOnly:false })}>
            Reset All Filters
          </button>
        )}

        {/* Browser Document Preview Modal */}
        {previewMode && (
          <div className="moverlay" onClick={() => setPreviewMode(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: 700}}>
              <div className="mhandle" />
              <div className="mtitle" style={{marginBottom:4}}>REPORT PREVIEW</div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--fm)", marginBottom: 18, lineHeight:1.5 }}>{buildMetaString()}</div>
              
              <div style={{background:"#fff", color:"#000", padding:16, borderRadius:8, fontFamily:"var(--fb)"}}>
                <div style={{borderBottom:"2px solid #000", paddingBottom:10, marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div>
                    <div style={{fontFamily:"var(--fh)", fontSize:20}}>FIELD LOG REPORT</div>
                    <div style={{fontSize:10, color:"#666"}}>{filtered.length} Records Documented</div>
                  </div>
                  <div style={{fontSize:10, textAlign:"right"}}>
                    ProGlow Electrics<br/>Generated: {fmtDate(new Date())}
                  </div>
                </div>

                {filtered.length === 0
                  ? <div className="empty" style={{color:"#555"}}><div className="empty-i">🔍</div>No records match these filters</div>
                  : filtered.slice(0, 15).map(l => {
                      return (
                        <div key={l.id} style={{borderBottom:"1px solid #eee", paddingBottom:12, marginBottom:12}}>
                          <div style={{display:"flex", justifyContent:"space-between", marginBottom:4}}>
                            <div style={{fontSize:11, fontWeight:700}}>{fmtDate(l.date)} — {sNameShort(l.siteId)}</div>
                            <div style={{fontSize:10}}>{(l.types||[]).map(t => LOG_TYPES.find(x=>x.id===t)?.label).join(", ")}</div>
                          </div>
                          <div style={{fontSize:12, marginBottom:6}}>
                            <span style={{fontWeight:600}}>{wName(l.workerId)}</span> 
                            {(l.alsoResponsible||[]).length > 0 && <span style={{color:"#555"}}> (Also: {(l.alsoResponsible||[]).map(wName).join(", ")})</span>}
                          </div>
                          <div style={{fontSize:11, color:"#333", lineHeight:1.4}}>
                            {l.trainingComment && <div style={{marginBottom:4}}><strong>Training:</strong> {l.trainingComment}</div>}
                            {l.praiseComment && <div style={{marginBottom:4}}><strong>Praise:</strong> {l.praiseComment}</div>}
                            {l.safetyComment && <div style={{marginBottom:4}}><strong>Safety:</strong> {l.safetyComment}</div>}
                            {l.notes && <div><strong>General:</strong> {l.notes}</div>}
                          </div>
                          {l.photo && <img src={l.photo} style={{maxHeight: 100, borderRadius: 4, marginTop: 8, border: "1px solid #ccc"}}/>}
                          <div style={{fontSize:10, color:"#666", marginTop:4}}>
                            Team Rating: {l.rating}/5 | {l.skillArea || l.safetyCategory || "General"}
                          </div>
                        </div>
                      )
                    })
                }
                {filtered.length > 15 && <div style={{ textAlign: "center", color: "#666", fontSize: 11, marginTop: 8, fontStyle:"italic" }}>Showing 15 of {filtered.length} — print for full results</div>}
              </div>

              <div className="mactions" style={{ marginTop: 24 }}>
                <button className="btn-s" onClick={() => setPreviewMode(false)}>Close Preview</button>
                <button className="btn-p" style={{ flex: 1, background:"#fff" }} onClick={() => { printReport("Field Log Report", reportRows, buildMetaString()); }}>🖨 PRINT / SAVE AS PDF</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PROFILE
  // ════════════════════════════════════════════════════════════════════════════

  function Profile() {
    const worker = workers.find(w => w.id === profileId);
    if (!worker) return null;
    
    const[tab, setTab] = useState("overview");
    const[showEdit, setShowEdit] = useState(false);
    const[editWf, setEditWf] = useState({});

    const wl     = primaryLogs(worker.id);
    const also   = alsoLogs(worker.id);
    const reps   = wl.filter(l => (l.types ||[]).includes("discipline"));
    const avg    = wl.length ? (wl.reduce((a, b) => a + b.rating, 0) / wl.length).toFixed(1) : "—";

    const radar = DEFAULT_SKILL_AREAS.map(skill => {
      const rel = wl.filter(l => l.skillArea === skill);
      return { skill: skill.split(" ")[0], value: rel.length ? parseFloat((rel.reduce((a, b) => a + b.rating, 0) / rel.length).toFixed(1)) : 0 };
    });
    const trend = [...wl].reverse().slice(-10).map((l, i) => ({ i: i + 1, r: l.rating }));

    function toggleComp(c) {
      setWorkers(p => p.map(w => w.id === worker.id ? { ...w, competencies: w.competencies.includes(c) ? w.competencies.filter(x => x !== c) : [...w.competencies, c] } : w));
    }

    function openEditWorker() {
      setEditWf({ name: worker.name, grade: worker.grade });
      setShowEdit(true);
    }
    
    function saveEditWorker() {
      if (!editWf.name.trim()) return;
      setWorkers(p => p.map(w => w.id === worker.id ? { ...w, name: editWf.name, grade: editWf.grade } : w));
      setShowEdit(false);
      showToast("✓ Profile updated");
    }

    function deleteWorker() {
      if (!window.confirm(`Delete profile for ${worker.name}?\nTheir existing logs will remain, but their name may not fully display.`)) return;
      setWorkers(p => p.filter(w => w.id !== worker.id));
      setView("team");
      showToast("Profile deleted");
    }

    return (
      <div>
        <button className="btn-s" style={{ marginBottom: 14 }} onClick={() => setView("team")}>← Back</button>
        
        <div className="phdr">
          <div className="pav">👷</div>
          <div style={{ flex: 1 }}>
            <div className="pname">{worker.name}</div>
            <div className="pgrade">{worker.grade}</div>
          </div>
        </div>

        {/* Profile Action Buttons */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button className="btn-s" style={{ flex: 1 }} onClick={openEditWorker}>✏️ Edit Profile</button>
          <button className="btn-d" style={{ padding: "9px 12px" }} onClick={deleteWorker}>🗑 Delete</button>
        </div>

        <div className="srow">
          <div className="sbox"><div className="snum" style={{ color: "var(--gold)" }}>{wl.length}</div><div className="slbl">Primary</div></div>
          <div className="sbox"><div className="snum" style={{ color: "#888" }}>{also.length}</div><div className="slbl">Also On-Site</div></div>
          <div className="sbox"><div className="snum" style={{ color: "var(--red)" }}>{reps.length}</div><div className="slbl">Discipline</div></div>
          <div className="sbox"><div className="snum" style={{ color: "var(--green)" }}>{avg}</div><div className="slbl">Avg Rtg</div></div>
        </div>

        <div className="tabs">
          {["overview", "discipline", "also-present", "competencies"].map(t => (
            <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t === "also-present" ? "Also On-Site" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            {wl.length > 2 && (
              <>
                <div className="card">
                  <div className="ctitle">Skill Profile</div>
                  <ResponsiveContainer width="100%" height={190}>
                    <RadarChart data={radar}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="skill" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                      <Radar dataKey="value" stroke="var(--gold)" fill="var(--gold)" fillOpacity={0.15} />
                      <Tooltip contentStyle={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <div className="ctitle">Rating Trend</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="i" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                      <YAxis domain={[1, 5]} tick={{ fill: "var(--muted)", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Line type="monotone" dataKey="r" stroke="var(--gold)" strokeWidth={2} dot={{ fill: "var(--gold)", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
            <div className="card">
              <div className="ctitle">Full Log History (Primary)</div>
              {wl.length === 0
                ? <div className="empty"><div className="empty-i">📋</div>No entries yet</div>
                : wl.map(l => (
                  <div className="li" key={l.id}>
                    <div className="lih">
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {(l.types ||[]).map(t => <TypeBadge key={t} type={t} />)}
                        {(l.types ||[]).includes("discipline") && <SevBadge severity={l.severity} />}
                      </div>
                      <div className="lir">{l.rating}/5</div>
                    </div>
                    {l.trainingComment && <div style={{fontSize:12, marginBottom:4, color:"#ccc"}}><strong>Train:</strong> {l.trainingComment}</div>}
                    {l.praiseComment && <div style={{fontSize:12, marginBottom:4, color:"#ccc"}}><strong>Praise:</strong> {l.praiseComment}</div>}
                    {l.safetyComment && <div style={{fontSize:12, marginBottom:4, color:"#ccc"}}><strong>Safety:</strong> {l.safetyComment}</div>}
                    {l.notes && <div className="lin">{l.notes}</div>}
                    <div className="lim" style={{marginTop:8}}>
                      <span>{l.skillArea || l.safetyCategory || ""}</span>
                      <span>{sNameShort(l.siteId)}</span>
                      <span>{fmtDate(l.date)}</span>
                      {l.followUp && <span className="fuf">🔔</span>}
                      {(l.alsoResponsible ||[]).length > 0 && (
                        <span className="also-linked">+{l.alsoResponsible.length} also on-site</span>
                      )}
                    </div>
                    {l.photo && <img src={l.photo} alt="att" style={{ width: "100%", borderRadius: 8, marginTop: 8, maxHeight: 160, objectFit: "cover" }} />}
                  </div>
                ))}
            </div>
          </>
        )}

        {tab === "discipline" && (
          <div className="card">
            <div className="ctitle">Discipline / Safety History</div>
            {reps.length === 0
              ? <div className="empty"><div className="empty-i">✅</div>No discipline records</div>
              : reps.map(l => (
                <div className="ritem" key={l.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <SevBadge severity={l.severity} />
                    <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--fm)" }}>{fmtDate(l.date)}</span>
                  </div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>{l.safetyComment || l.notes}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--fm)" }}>{l.safetyCategory} · {sNameShort(l.siteId)}</div>
                  <button className="btn-s" style={{ marginTop: 10, fontSize: 10 }}
                    onClick={() => setSmsModal({ worker, log: { ...l, siteAddress: sName(l.siteId) } })}>
                    📤 View / Resend Notice
                  </button>
                </div>
              ))}
          </div>
        )}

        {tab === "also-present" && (
          <div className="card">
            <div className="ctitle">Incidents Where Also On-Site</div>
            {also.length === 0
              ? <div className="empty"><div className="empty-i">👥</div>No linked incidents</div>
              : also.map(l => (
                <div className="li linked" key={l.id}>
                  <div className="lih">
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {(l.types ||[]).map(t => <TypeBadge key={t} type={t} />)}
                      <span className="also-linked">Also Responsible</span>
                    </div>
                    <div className="lir">{l.rating}/5</div>
                  </div>
                  <div className="lin">{l.notes}</div>
                  <div style={{ fontSize: 11, color: "var(--gold)", fontFamily: "var(--fm)", marginBottom: 4 }}>
                    Primary: {wName(l.workerId)}
                  </div>
                  <div className="lim"><span>{sNameShort(l.siteId)}</span><span>{fmtDate(l.date)}</span></div>
                </div>
              ))}
          </div>
        )}

        {tab === "competencies" && (
          <div className="card">
            <div className="ctitle">AS/NZS 3000 Competencies</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Tap to mark as completed</div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {AS3000_COMPETENCIES.map(c => (
                <div key={c} className={`ctag${(worker.competencies ||[]).includes(c) ? " on" : ""}`} onClick={() => toggleComp(c)}>
                  {(worker.competencies ||[]).includes(c) ? "✓" : "○"} {c}
                </div>
              ))}
            </div>
            <hr className="divider" />
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{(worker.competencies ||[]).length} / {AS3000_COMPETENCIES.length} completed</div>
          </div>
        )}

        {/* Edit Worker Modal */}
        {showEdit && (
          <div className="moverlay" onClick={() => setShowEdit(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="mhandle" />
              <div className="mtitle">EDIT WORKER</div>
              <div className="fg"><label className="fl">Full Name</label><input className="fi" value={editWf.name} onChange={e => setEditWf(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="fg">
                <label className="fl">Grade</label>
                <select className="fs" value={editWf.grade} onChange={e => setEditWf(f => ({ ...f, grade: e.target.value }))}>
                  {grades.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="mactions">
                <button className="btn-s" onClick={() => setShowEdit(false)}>Cancel</button>
                <button className="btn-p" style={{ flex: 1 }} onClick={saveEditWorker}>SAVE CHANGES</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════════════════════════

  function Settings() {
    const[expanded, setExpanded] = useState(null);

    function AccordionSection({ id, title, children }) {
      const isOpen = expanded === id;
      return (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 12, border: isOpen ? '1px solid var(--gold)' : '1px solid var(--border)' }}>
          <div 
            onClick={() => setExpanded(isOpen ? null : id)}
            style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isOpen ? 'var(--s2)' : 'transparent' }}
          >
            <div className="ctitle" style={{ marginBottom: 0, color: isOpen ? 'var(--gold)' : 'var(--muted)' }}>{title}</div>
            <div style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</div>
          </div>
          {isOpen && <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>{children}</div>}
        </div>
      )
    }

    function ListManager({ items, setItems }) {
      const[newItem, setNewItem] = useState("");
      return (
        <div>
          {items.map((item, i) => (
            <div className="set-item" key={i}>
              <span className="set-tag">{item}</span>
              <button className="btn-d" style={{ padding: "6px 10px", fontSize: 9 }} onClick={() => setItems(p => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input className="fi" placeholder="Add new item…" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newItem.trim()) { setItems(p =>[...p, newItem.trim()]); setNewItem(""); } }} />
            <button className="btn-g" style={{ flexShrink: 0 }} onClick={() => { if (newItem.trim()) { setItems(p =>[...p, newItem.trim()]); setNewItem(""); } }}>Add</button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="ptitle">SET<span>TINGS</span></div>
        <div className="psub">CONFIG & SYSTEM DATA</div>

        <AccordionSection id="skills" title="Skill Areas (Training)">
          <ListManager items={skillAreas} setItems={setSkillAreas} />
        </AccordionSection>

        <AccordionSection id="cats" title="Safety / Discipline Categories">
          <ListManager items={safeCats} setItems={setSafeCats} />
        </AccordionSection>

        <AccordionSection id="grades" title="Worker Grades">
          <ListManager items={grades} setItems={setGrades} />
        </AccordionSection>

        <AccordionSection id="builds" title="Builders">
          <ListManager items={builders} setItems={setBuilders} />
        </AccordionSection>

        <AccordionSection id="supers" title="Supervisors">
          <ListManager items={supervisors} setItems={setSupervisors} />
        </AccordionSection>

        <div className="card" style={{ borderColor: "var(--red)", marginTop: 24 }}>
          <div className="ctitle" style={{ color: "var(--red)" }}>Danger Zone</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>Permanently delete all log data. Workers and sites are kept.</div>
          <button className="btn-d" style={{width:"100%", padding:14, fontSize:14}} onClick={() => { if (window.confirm("Delete ALL log entries? This cannot be undone.")) { setLogs([]); showToast("All logs cleared"); } }}>
            Delete All Log Entries
          </button>
        </div>
      </div>
    );
  }

  // ── SMS MODAL ────────────────────────────────────────────────────────────────

  function SMSModal() {
    if (!smsModal) return null;
    const { worker, log } = smsModal;
    const text = generateSMS(worker, log);
    function copy() { navigator.clipboard.writeText(text).then(() => { showToast("✓ Copied"); setSmsModal(null); }); }
    return (
      <div className="moverlay" onClick={() => setSmsModal(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="mhandle" />
          <div className="mtitle">📤 WORKER NOTICE</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12, fontFamily: "var(--fm)" }}>
            For: <strong style={{ color: "var(--text)" }}>{worker?.name}</strong> · Review and send via SMS or messaging app
          </div>
          <div className="sms-pre">{text}</div>
          <div className="mactions">
            <button className="btn-s" onClick={() => setSmsModal(null)}>Close</button>
            <button className="btn-p" style={{ flex: 1 }} onClick={copy}>📋 COPY TO CLIPBOARD</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── NAV & RENDER ────────────────────────────────────────────────────────────

  const navItems =[
    { id: "log",       label: "SUBMIT REPORT", icon: "📝", isMain: true },
    { id: "dashboard", label: "Statistics",    icon: "📊" },
    { id: "team",      label: "Team",          icon: "👷" },
    { id: "sites",     label: "Sites",         icon: "📍" },
    { id: "reports",   label: "Reports",       icon: "📄" },
    { id: "settings",  label: "Config",        icon: "⚙️" },
  ];

  const viewMap = {
    dashboard: <Dashboard />,
    log:       <LogEntry />,
    team:      <Team />,
    sites:     <SitesView />,
    reports:   <Reports />,
    settings:  <Settings />,
    profile:   <Profile />,
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        {/* Header */}
        <div className="hdr">
          <div className="hdr-inner">
            <div className="logo-area">
              <img
                src="https://www.proglowelectrics.com.au/wp-content/uploads/2024/03/Mask-group.png"
                className="logo-img"
                alt="ProGlow Electrics"
                onError={e => { e.target.style.display = "none"; }}
              />
            </div>
            <div className="hdr-count">{logs.length} entries</div>
          </div>
        </div>

        {/* Content */}
        <div className="main">{viewMap[view] || <Dashboard />}</div>

        {/* Bottom Nav */}
        <nav className="bnav">
          {navItems.map(n => {
            if (n.isMain) {
              return (
                <button 
                  key={n.id} 
                  className={`ni ni-main ${view === n.id ? "active" : ""}`} 
                  onClick={() => setView(n.id)}
                >
                  <span className="ni-i">{n.icon}</span>
                  <span style={{lineHeight: 1.1, textAlign: 'center'}}>SUBMIT<br/>REPORT</span>
                </button>
              )
            }
            return (
              <button key={n.id}
                className={`ni${(view === n.id || (n.id === "team" && view === "profile")) ? " active" : ""}`}
                onClick={() => setView(n.id)}>
                <span className="ni-i">{n.icon}</span>{n.label}
              </button>
            );
          })}
        </nav>

        <SMSModal />
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}