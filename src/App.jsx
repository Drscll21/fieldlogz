import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, LineChart, Line, Legend
} from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LOG_TYPES = [
  { id: "training",   label: "Training",            icon: "📘", color: "#C9A84C" },
  { id: "praise",     label: "Praise",              icon: "⭐", color: "#e8e8e8" },
  { id: "discipline", label: "Safety & Discipline", icon: "⚠️", color: "#ff6b6b" },
  { id: "other",      label: "Other",               icon: "📝", color: "#aaaaaa" },
];

const SEVERITY_LEVELS = [
  { id: "minor",    label: "Minor",    sub: "Verbal Warning",      color: "#C9A84C" },
  { id: "moderate", label: "Moderate", sub: "Written Warning",     color: "#E8873A" },
  { id: "major",    label: "Major",    sub: "Formal Disciplinary", color: "#ff6b6b" },
];

const DEFAULT_SKILL_AREAS = [
  "Conduit & Cable Management","Switchboard Work","Circuit Testing",
  "WHS / Safety Compliance","Tools & Equipment","Documentation",
  "Communication","Initiative",
];

const DEFAULT_SAFETY_CATS = [
  "Near Miss","PPE Breach","Unsafe Work Practice",
  "Site Hazard","Electrical Incident","Tool/Equipment Issue","Other",
];

const AS3000_COMPETENCIES = [
  "Clause 1 — Scope & General","Clause 2 — General Arrangement",
  "Clause 3 — Selection of Wiring Systems","Clause 4 — Protection",
  "Clause 5 — Earthing","Clause 6 — Switchboards",
  "Clause 7 — Testing & Inspection","Clause 8 — Special Installations",
];

const DEFAULT_GRADES = ["1st Year App","2nd Year App","3rd Year App","4th Year App","A-Grade"];
const SITE_TYPES = ["Commercial","Residential","Industrial","Infrastructure","Other"];

const DEFAULT_WORKERS = [
  { id:"w1", name:"Jordan Mitchell", grade:"2nd Year App", sites:["site1"], apprenticeStart:"2023", competencies:[] },
  { id:"w2", name:"Sam Nguyen",      grade:"3rd Year App", sites:["site2"], apprenticeStart:"2022", competencies:[] },
  { id:"w3", name:"Riley Thompson",  grade:"1st Year App", sites:["site1"], apprenticeStart:"2024", competencies:[] },
  { id:"w4", name:"Ash Kowalski",    grade:"4th Year App", sites:["site3"], apprenticeStart:"2021", competencies:[] },
  { id:"w5", name:"Taylor Brennan",  grade:"A-Grade",      sites:["site3"], apprenticeStart:"2018", competencies:[] },
];

const DEFAULT_SITES = [
  { id:"site1", name:"Parkside Retail",      address:"123 Park St, Parkside VIC 3125",      type:"Commercial"  },
  { id:"site2", name:"Westfield Commercial", address:"45 Marion Rd, Marion VIC 3043",        type:"Commercial"  },
  { id:"site3", name:"CBD Office Tower",     address:"1 King St, Melbourne VIC 3000",        type:"Commercial"  },
  { id:"site4", name:"Residential Estate",   address:"77 Grove Ave, Burwood VIC 3125",       type:"Residential" },
  { id:"site5", name:"Industrial Park",      address:"9 Trade Rd, Bayswater VIC 3153",       type:"Industrial"  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function lsGet(k, fb) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } }
function lsSet(k, v)  { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function uid()        { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmtDate(d)   { if (!d) return ""; return new Date(d).toLocaleDateString("en-AU", { day:"2-digit", month:"short", year:"numeric" }); }
function isoToday()   { return new Date().toISOString().split("T")[0]; }

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
  return `Hi ${worker?.name?.split(" ")[0] ?? ""},\n\nThis message is a formal ${sev?.label?.toLowerCase() ?? "verbal"} warning (${sev?.sub}) following our discussion on ${fmtDate(log.date)}.\n\nMatter: ${log.safetyCategory || log.skillArea || "General"}\nDetails: ${log.notes}\nSite: ${log.siteName || ""}\n\nPlease ensure this issue does not reoccur. If you wish to discuss this matter, please speak with your supervisor directly.\n\nThis record has been logged for your employment file.\n\n— ProGlow Electrics Supervisor`;
}

// ─── PRINT REPORT ────────────────────────────────────────────────────────────

function printReport(title, rows, meta = "") {
  const w = window.open("", "_blank");
  const typeColor = { training:"#7a6020", praise:"#1a5c2e", discipline:"#8b1a1a", other:"#3a3a6a" };
  const typeBg    = { training:"#fef9ec", praise:"#f0fdf4", discipline:"#fff1f1", other:"#f5f3ff" };

  const tableRows = rows.map(r => `
    <tr>
      <td>${fmtDate(r.date)}</td>
      <td>${r.workerName}</td>
      <td>${r.role === "also" ? '<span style="color:#666;font-size:11px">Also Responsible</span>' : '<span style="color:#111;font-size:11px;font-weight:600">Primary</span>'}</td>
      <td>${(r.types||[]).map(t => {
        const lt = LOG_TYPES.find(x=>x.id===t);
        return `<span style="background:${typeBg[t]||"#f5f5f5"};color:${typeColor[t]||"#333"};padding:2px 7px;border-radius:4px;font-size:11px;margin-right:3px;">${lt?.icon||""} ${lt?.label||t}</span>`;
      }).join("")}</td>
      <td>${r.siteName || ""}</td>
      <td>${r.skillArea || r.safetyCategory || ""}</td>
      <td style="text-align:center;font-weight:700">${r.rating}/5</td>
      <td>${r.severity ? `<span style="font-size:11px;padding:2px 6px;background:#fff3cd;border-radius:3px;">${r.severity}</span>` : ""}</td>
      <td>${r.notes}</td>
      <td style="text-align:center">${r.followUp ? "🔔" : ""}</td>
    </tr>
  `).join("");

  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <style>
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;padding:28px;max-width:1100px;margin:0 auto;}
    .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:20px;}
    .logo-wrap{display:flex;align-items:center;gap:14px;}
    .logo-img{height:48px;}
    .company{font-size:11px;color:#555;}
    .report-title{font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:2px;}
    .meta{font-size:11px;color:#666;margin-bottom:18px;line-height:1.8;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;}
    th{background:#111;color:#fff;padding:8px 10px;text-align:left;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;font-size:10px;}
    td{padding:7px 10px;border-bottom:1px solid #e5e5e5;vertical-align:top;}
    tr:nth-child(even) td{background:#fafafa;}
    .footer{margin-top:24px;font-size:10px;color:#999;border-top:1px solid #ddd;padding-top:10px;display:flex;justify-content:space-between;}
    .summary{display:flex;gap:20px;margin-bottom:20px;}
    .stat{background:#f5f5f5;border:1px solid #e0e0e0;border-radius:6px;padding:10px 16px;text-align:center;}
    .stat-n{font-size:22px;font-weight:700;color:#111;}
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
      Generated: ${new Date().toLocaleDateString("en-AU")}<br/>
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
      <th>Date</th><th>Worker</th><th>Role</th><th>Type</th><th>Site</th>
      <th>Skill / Category</th><th>Rating</th><th>Severity</th><th>Notes</th><th>Follow-up</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">
    <span>ProGlow Electrics — Confidential Supervisor Record</span>
    <span>FieldLog · ${new Date().toLocaleDateString("en-AU")}</span>
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
  --s1:    #0d0d0d;
  --s2:    #141414;
  --s3:    #1c1c1c;
  --s4:    #242424;
  --border:#282828;
  --border2:#333333;
  --text:  #f2f2f2;
  --muted: #666666;
  --dim:   #3a3a3a;
  --gold:  #C9A84C;
  --gold2: #e8c96a;
  --white: #f2f2f2;
  --red:   #ff6b6b;
  --green: #6bcf8f;
  --r:12px;
  --fh:'Bebas Neue',sans-serif;
  --fb:'Outfit',sans-serif;
  --fm:'JetBrains Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--fb);font-size:15px;min-height:100vh;}
.app{display:flex;flex-direction:column;min-height:100vh;max-width:540px;margin:0 auto;}

/* ── HEADER ── */
.hdr{
  position:sticky;top:0;z-index:60;
  background:#000;
  border-bottom:2px solid var(--gold);
  overflow:hidden;
}
.hdr-banner{
  position:absolute;inset:0;
  background:url('https://www.proglowelectrics.com.au/wp-content/uploads/2024/07/ProGlow-header-banner-responsive-optimised.jpg') center/cover no-repeat;
  opacity:0.13;
  pointer-events:none;
}
.hdr-inner{
  position:relative;z-index:1;
  padding:0 18px;
  display:flex;align-items:center;justify-content:space-between;
  height:66px;
}
.logo-area{display:flex;align-items:center;gap:12px;}
.logo-img{height:38px;width:auto;object-fit:contain;filter:brightness(0) invert(1);}
.logo-divider{width:1px;height:30px;background:var(--border2);}
.logo-sub{font-family:var(--fm);font-size:9px;letter-spacing:3px;color:var(--muted);text-transform:uppercase;line-height:1.4;}
.logo-sub strong{color:var(--gold);display:block;font-size:11px;letter-spacing:2px;}
.hdr-count{font-family:var(--fm);font-size:10px;color:var(--muted);}

/* ── BOTTOM NAV ── */
.bnav{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:540px;
  background:var(--s1);border-top:1px solid var(--border);
  display:grid;grid-template-columns:repeat(6,1fr);
  padding-bottom:env(safe-area-inset-bottom);z-index:60;
}
.ni{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:9px 4px 7px;cursor:pointer;border:none;background:none;color:var(--muted);font-family:var(--fb);font-size:9px;letter-spacing:0.3px;gap:3px;transition:color 0.15s;}
.ni.active{color:var(--gold);}
.ni-i{font-size:19px;line-height:1;}

/* ── MAIN ── */
.main{flex:1;padding:18px 16px 110px;overflow-y:auto;}

/* ── PAGE TITLES ── */
.ptitle{font-family:var(--fh);font-size:32px;letter-spacing:2px;margin-bottom:0;line-height:1;}
.ptitle span{color:var(--gold);}
.psub{font-size:11px;color:var(--muted);margin-bottom:18px;font-family:var(--fm);letter-spacing:1px;margin-top:3px;}

/* ── CARDS ── */
.card{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px;}
.card.gold-border{border-color:var(--gold);}
.ctitle{font-family:var(--fm);font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:12px;}

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

/* ── TABS ── */
.tabs{display:flex;gap:6px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none;}
.tabs::-webkit-scrollbar{display:none;}
.tab{padding:7px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-family:var(--fm);font-size:10px;letter-spacing:1.5px;text-transform:uppercase;transition:all 0.15s;white-space:nowrap;flex-shrink:0;}
.tab.active{background:var(--gold);border-color:var(--gold);color:#000;}

/* ── FORMS ── */
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

/* ── SEVERITY ── */
.sevrow{display:flex;gap:6px;}
.sevpill{flex:1;padding:10px 4px;border-radius:10px;cursor:pointer;text-align:center;border:1.5px solid var(--border);background:var(--s2);font-size:12px;font-weight:600;color:var(--muted);transition:all 0.15s;}
.sevpill .ss{font-size:9px;font-weight:400;display:block;margin-top:2px;font-family:var(--fm);}
.sevpill.active{border-width:2px;}

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
.btn-s:hover{border-color:var(--gold);color:var(--gold);}
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
.wname{font-family:var(--fh);font-size:18px;letter-spacing:0.5px;}
.wgrade{font-size:12px;color:var(--muted);margin-top:1px;}
.wsites{font-size:11px;color:var(--gold);margin-top:3px;font-family:var(--fm);}
.wmeta{flex:1;min-width:0;}
.wstat{text-align:right;flex-shrink:0;}
.wnum{font-family:var(--fh);font-size:26px;color:var(--gold);}
.wlbl{font-size:9px;color:var(--muted);font-family:var(--fm);}

/* ── SITE CARD ── */
.scrd{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;margin-bottom:10px;}
.scrd-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;}
.sname{font-family:var(--fh);font-size:18px;letter-spacing:0.5px;}
.saddr{font-size:12px;color:var(--muted);margin-top:2px;font-family:var(--fm);}
.stype{font-size:10px;color:var(--gold);font-family:var(--fm);letter-spacing:1px;text-transform:uppercase;margin-top:4px;}

/* ── SITE BARS ── */
.sbrow{display:flex;align-items:center;gap:10px;margin-bottom:9px;}
.sbname{font-size:13px;min-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sbtrack{flex:1;height:6px;background:var(--s3);border-radius:99px;overflow:hidden;}
.sbfill{height:100%;border-radius:99px;background:var(--gold);transition:width 0.4s ease;}
.sbcount{font-family:var(--fm);font-size:11px;color:var(--muted);min-width:22px;text-align:right;}

/* ── MODAL ── */
.moverlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:200;display:flex;align-items:flex-end;justify-content:center;}
.modal{background:var(--s1);border:1px solid var(--border);border-top:2px solid var(--gold);border-radius:20px 20px 0 0;padding:22px 18px 44px;width:100%;max-width:540px;max-height:92vh;overflow-y:auto;}
.mhandle{width:38px;height:3px;background:var(--border2);border-radius:99px;margin:0 auto 18px;}
.mtitle{font-family:var(--fh);font-size:24px;letter-spacing:1.5px;margin-bottom:14px;}
.sms-pre{background:var(--s2);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:13px;line-height:1.7;white-space:pre-wrap;font-family:var(--fb);color:var(--text);margin-bottom:14px;}
.mactions{display:flex;gap:10px;}

/* ── REPORT BUILDER ── */
.rf-section{background:var(--s1);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:12px;}
.rf-title{font-family:var(--fm);font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;}
.filter-chips{display:flex;flex-wrap:wrap;gap:6px;}
.fchip{padding:7px 12px;border-radius:8px;border:1px solid var(--border);background:var(--s2);color:var(--muted);cursor:pointer;font-family:var(--fm);font-size:11px;letter-spacing:0.5px;transition:all 0.15s;}
.fchip.on{background:var(--gold);border-color:var(--gold);color:#000;}
.results-count{font-family:var(--fh);font-size:36px;color:var(--gold);line-height:1;}
.result-sub{font-family:var(--fm);font-size:10px;color:var(--muted);letter-spacing:1px;margin-top:2px;}

/* ── PROFILE ── */
.phdr{display:flex;align-items:center;gap:16px;margin-bottom:18px;}
.pav{width:62px;height:62px;border-radius:50%;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:28px;border:2px solid var(--gold);flex-shrink:0;}
.pname{font-family:var(--fh);font-size:24px;letter-spacing:0.5px;}
.pgrade{font-size:12px;color:var(--muted);margin-top:2px;}

/* ── COMP TAGS ── */
.ctag{display:inline-flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:7px 10px;font-size:12px;cursor:pointer;transition:all 0.15s;margin:3px;}
.ctag.on{background:#C9A84C15;border-color:#C9A84C50;color:var(--gold);}

/* ── REPRIMAND ── */
.ritem{background:#ff6b6b0a;border:1px solid #ff6b6b25;border-radius:10px;padding:12px 14px;margin-bottom:8px;}

/* ── SETTINGS ── */
.set-item{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.set-tag{background:var(--s2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--text);flex:1;}

/* ── SITE MULTISELECT ── */
.ms-wrap{position:relative;}
.ms-trigger{width:100%;background:var(--s2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:var(--fb);font-size:14px;padding:10px 13px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:border 0.15s;user-select:none;}
.ms-trigger:hover,.ms-trigger.open{border-color:var(--gold);}
.ms-trigger-left{display:flex;align-items:center;gap:8px;flex:1;min-width:0;overflow:hidden;}
.ms-tags{display:flex;flex-wrap:nowrap;gap:5px;overflow:hidden;flex:1;min-width:0;}
.ms-tag{display:inline-flex;align-items:center;gap:4px;background:var(--gold);color:#000;border-radius:5px;padding:2px 7px;font-size:11px;font-weight:600;font-family:var(--fm);white-space:nowrap;flex-shrink:0;}
.ms-tag button{background:none;border:none;cursor:pointer;color:#000;font-size:13px;line-height:1;padding:0;margin-left:1px;opacity:0.7;}
.ms-tag button:hover{opacity:1;}
.ms-overflow{font-size:11px;color:var(--gold);font-family:var(--fm);white-space:nowrap;flex-shrink:0;}
.ms-placeholder{color:var(--muted);font-size:14px;}
.ms-arrow{font-size:12px;color:var(--muted);flex-shrink:0;transition:transform 0.15s;}
.ms-arrow.open{transform:rotate(180deg);}
.ms-dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;background:var(--s1);border:1px solid var(--gold);border-radius:10px;z-index:100;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.6);}
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
@media(max-width:380px){.srow{grid-template-columns:repeat(2,1fr);}}
`;

// ─── SELECT WITH OTHER ────────────────────────────────────────────────────────

function SelectWithOther({ value, onChange, options, placeholder = "Select…" }) {
  const isCustom = value && !options.includes(value);
  const [showCustom, setShowCustom] = useState(isCustom);
  const [custom, setCustom] = useState(isCustom ? value : "");

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
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");

  const filtered = sites.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  }

  function clear(e) { e.stopPropagation(); onChange([]); }

  // Visible tags — show up to 2 then overflow count
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
                    {s.name}
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
          {/* Click-outside overlay */}
          <div style={{ position:"fixed", inset:0, zIndex:99 }} onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="ms-dropdown">
            <input
              className="ms-search"
              placeholder="🔍  Search sites…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
            <div className="ms-list">
              {filtered.length === 0
                ? <div style={{ padding:"14px", color:"var(--muted)", fontSize:13, textAlign:"center" }}>No sites found</div>
                : filtered.map(s => (
                  <div
                    key={s.id}
                    className={`ms-item${selected.includes(s.id) ? " checked" : ""}`}
                    onClick={e => { e.stopPropagation(); toggle(s.id); }}
                  >
                    <div className={`ms-check${selected.includes(s.id) ? " on" : ""}`}>
                      {selected.includes(s.id) && <span style={{ color:"#000", fontWeight:700, fontSize:11 }}>✓</span>}
                    </div>
                    <div>
                      <div className="ms-item-name">{s.name}</div>
                      <div className="ms-item-addr">📍 {s.address}</div>
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="ms-footer">
              <span className="ms-count">{selected.length} SELECTED OF {sites.length}</span>
              {selected.length > 0 && (
                <button className="ms-clear" onClick={clear}>Clear All</button>
              )}
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
  const [workers, setWorkers]   = useState(() => lsGet("pg_workers", DEFAULT_WORKERS));
  const [sites,   setSites]     = useState(() => lsGet("pg_sites",   DEFAULT_SITES));
  const [logs,    setLogs]      = useState(() => lsGet("pg_logs",    []));
  const [profileId, setProfileId] = useState(null);
  const [toast,   setToast]     = useState(null);
  const [smsModal, setSmsModal] = useState(null);

  const [skillAreas,  setSkillAreas]  = useState(() => lsGet("pg_skills",   DEFAULT_SKILL_AREAS));
  const [grades,      setGrades]      = useState(() => lsGet("pg_grades",   DEFAULT_GRADES));
  const [safeCats,    setSafeCats]    = useState(() => lsGet("pg_safecat",  DEFAULT_SAFETY_CATS));

  useEffect(() => { lsSet("pg_workers", workers); }, [workers]);
  useEffect(() => { lsSet("pg_sites",   sites);   }, [sites]);
  useEffect(() => { lsSet("pg_logs",    logs);     }, [logs]);
  useEffect(() => { lsSet("pg_skills",  skillAreas);  }, [skillAreas]);
  useEffect(() => { lsSet("pg_grades",  grades);      }, [grades]);
  useEffect(() => { lsSet("pg_safecat", safeCats);    }, [safeCats]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2500); }
  function openProfile(id) { setProfileId(id); setView("profile"); }
  function sName(id) { return sites.find(s => s.id === id)?.name || id || "—"; }
  function wName(id) { return workers.find(w => w.id === id)?.name || "—"; }
  function wLogs(id) { return logs.filter(l => l.workerId === id || (l.alsoResponsible || []).includes(id)); }
  function primaryLogs(id) { return logs.filter(l => l.workerId === id); }

  // ── LOG FORM ──────────────────────────────────────────────────────────────

  const blankForm = {
    workerId: "", alsoResponsible: [], siteId: "", date: isoToday(),
    types: [], severity: "minor", safetyCategory: "", skillArea: "",
    rating: 3, notes: "", followUp: false, photo: null,
  };
  const [form, setForm] = useState(blankForm);
  const sf = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function toggleType(id) {
    setForm(f => ({ ...f, types: f.types.includes(id) ? f.types.filter(t => t !== id) : [...f.types, id] }));
  }
  function toggleAlso(id) {
    setForm(f => ({
      ...f,
      alsoResponsible: f.alsoResponsible.includes(id)
        ? f.alsoResponsible.filter(x => x !== id)
        : [...f.alsoResponsible, id]
    }));
  }

  const isDisc  = form.types.includes("discipline");
  const isTrain = form.types.includes("training") || form.types.includes("praise");
  const isValid = form.workerId && form.siteId && form.types.length > 0 && form.notes.trim();

  function submitLog() {
    const incidentId = uid();
    const site = sites.find(s => s.id === form.siteId);
    // Primary log
    const primaryLog = { id: incidentId, incidentId, role: "primary", siteName: site?.name, siteAddress: site?.address, ...form };
    const newLogs = [primaryLog];

    // Also-responsible linked logs
    form.alsoResponsible.forEach(wId => {
      newLogs.push({
        id: uid(), incidentId, role: "also",
        workerId: wId, linkedPrimaryId: form.workerId,
        alsoResponsible: [],
        siteName: site?.name, siteAddress: site?.address,
        siteId: form.siteId, date: form.date,
        types: form.types, severity: form.severity,
        safetyCategory: form.safetyCategory, skillArea: form.skillArea,
        rating: form.rating, notes: form.notes, followUp: false, photo: null,
      });
    });

    setLogs(p => [...newLogs, ...p]);
    setForm(blankForm);
    showToast("✓ Entry saved");
    if (isDisc) {
      const worker = workers.find(w => w.id === form.workerId);
      setSmsModal({ worker, log: { ...primaryLog, siteName: site?.name } });
    }
  }

  function handlePhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => sf("photo", ev.target.result);
    r.readAsDataURL(file);
  }

  // ── DASHBOARD DATA ────────────────────────────────────────────────────────

  const [dashPeriod, setDashPeriod] = useState("week");
  const isCur = dashPeriod === "week" ? isThisWeek  : isThisMonth;
  const isPrv = dashPeriod === "week" ? isLastWeek  : isLastMonth;
  const curLogs = useMemo(() => logs.filter(l => isCur(l.date)), [logs, isCur]);
  const prvLogs = useMemo(() => logs.filter(l => isPrv(l.date)), [logs, isPrv]);

  const typeCounts = useMemo(() => LOG_TYPES.map(t => ({
    ...t,
    cur: curLogs.filter(l => (l.types || []).includes(t.id)).length,
    prv: prvLogs.filter(l => (l.types || []).includes(t.id)).length,
  })), [curLogs, prvLogs]);

  const siteCounts = useMemo(() => {
    const map = {};
    logs.forEach(l => { const n = sName(l.siteId); map[n] = (map[n] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([s, c]) => ({ s, c }));
  }, [logs, sites]);

  const employeeActivity = useMemo(() => workers.map(w => {
    const wl = primaryLogs(w.id);
    return {
      name: w.name.split(" ")[0],
      training:   wl.filter(l => (l.types||[]).includes("training")).length,
      praise:     wl.filter(l => (l.types||[]).includes("praise")).length,
      discipline: wl.filter(l => (l.types||[]).includes("discipline")).length,
      other:      wl.filter(l => (l.types||[]).includes("other")).length,
    };
  }), [workers, logs]);

  const maxSite = siteCounts[0]?.c || 1;
  const followUps = useMemo(() => logs.filter(l => l.followUp && l.role !== "also"), [logs]);

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
        <div className="ptitle">DASH<span>BOARD</span></div>
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

        {followUps.length > 0 && (
          <div className="card" style={{ borderColor: "#C9A84C40", background: "#C9A84C08" }}>
            <div className="ctitle" style={{ color: "var(--gold)" }}>🔔 Follow-ups Required ({followUps.length})</div>
            {followUps.slice(0, 3).map(l => (
              <div key={l.id} style={{ fontSize: 13, marginBottom: 5 }}>
                <strong>{wName(l.workerId)?.split(" ")[0]}</strong> — {l.skillArea || l.safetyCategory || "General"}
                <span style={{ color: "var(--muted)", marginLeft: 6 }}>{fmtDate(l.date)}</span>
              </div>
            ))}
            {followUps.length > 3 && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>+{followUps.length - 3} more</div>}
          </div>
        )}

        <div className="card">
          <div className="ctitle">Activity by Site</div>
          {siteCounts.length === 0
            ? <div className="empty"><div className="empty-i">📍</div>No site data yet</div>
            : siteCounts.map(({ s, c }) => (
              <div className="sbrow" key={s}>
                <div className="sbname">{s}</div>
                <div className="sbtrack"><div className="sbfill" style={{ width: `${(c / maxSite) * 100}%` }} /></div>
                <div className="sbcount">{c}</div>
              </div>
            ))}
        </div>

        <div className="card">
          <div className="ctitle">Activity by Employee</div>
          {employeeActivity.every(e => e.training + e.praise + e.discipline + e.other === 0)
            ? <div className="empty"><div className="empty-i">👷</div>No entries yet</div>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={employeeActivity} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "var(--muted)" }} />
                  <Bar dataKey="training"   fill="#C9A84C" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="praise"     fill="#6bcf8f" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="discipline" fill="#ff6b6b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="other"      fill="#888888" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        <div className="card">
          <div className="ctitle">Recent Entries</div>
          {logs.length === 0
            ? <div className="empty"><div className="empty-i">📋</div>No entries yet — tap Log to get started</div>
            : logs.filter(l => l.role !== "also").slice(0, 5).map(l => (
              <div className="li" key={l.id}>
                <div className="lih">
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(l.types || []).map(t => <TypeBadge key={t} type={t} />)}
                    {(l.types || []).includes("discipline") && <SevBadge severity={l.severity} />}
                  </div>
                  <div className="lir">{l.rating}/5</div>
                </div>
                <div className="lin">{l.notes}</div>
                <div className="lim">
                  <span>{wName(l.workerId)}</span>
                  <span>{sName(l.siteId)}</span>
                  <span>{fmtDate(l.date)}</span>
                  {l.followUp && <span className="fuf">🔔 Follow-up</span>}
                  {(l.alsoResponsible || []).length > 0 && (
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
            <select className="fs" value={form.workerId} onChange={e => { sf("workerId", e.target.value); sf("alsoResponsible", []); }}>
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
              {sites.map(s => <option key={s.id} value={s.id}>{s.name} — {s.address}</option>)}
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

          {/* Safety & Discipline fields */}
          {isDisc && (
            <>
              <div className="fg">
                <label className="fl">Severity</label>
                <div className="sevrow">
                  {SEVERITY_LEVELS.map(s => (
                    <div key={s.id}
                      className={`sevpill${form.severity === s.id ? " active" : ""}`}
                      style={form.severity === s.id ? { borderColor: s.color, color: s.color, background: s.color + "12" } : {}}
                      onClick={() => sf("severity", s.id)}>
                      {s.label}<span className="ss">{s.sub}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="fg">
                <label className="fl">Safety / Discipline Category</label>
                <SelectWithOther value={form.safetyCategory} onChange={v => sf("safetyCategory", v)} options={safeCats} placeholder="Select category…" />
              </div>
            </>
          )}

          {/* Skill area for training/praise */}
          {isTrain && (
            <div className="fg">
              <label className="fl">Skill Area</label>
              <SelectWithOther value={form.skillArea} onChange={v => sf("skillArea", v)} options={skillAreas} placeholder="Select skill area…" />
            </div>
          )}

          {/* Rating */}
          <div className="fg">
            <label className="fl">Performance Rating</label>
            <div className="rrow">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} className={`rbtn${form.rating === n ? " active" : ""}`} onClick={() => sf("rating", n)}>{n}</button>
              ))}
              <span className="rlbl">{["", "Poor", "Below Avg", "Average", "Good", "Excellent"][form.rating]}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="fg">
            <label className="fl">Notes</label>
            <textarea className="fta"
              placeholder={isDisc ? "Describe the incident clearly — used for formal notice…" : "What was covered, observed or discussed…"}
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
    const [af, setAf] = useState({ name: "", grade: grades[0], siteId: sites[0]?.id || "", apprenticeStart: String(new Date().getFullYear()) });

    function addWorker() {
      if (!af.name.trim()) return;
      setWorkers(p => [...p, { id: uid(), ...af, sites: [af.siteId], competencies: [] }]);
      setShowAdd(false); showToast("✓ Worker added");
    }

    return (
      <div>
        <div className="ptitle">TEAM <span>ROSTER</span></div>
        <div className="psub">{workers.length} WORKERS ACTIVE</div>
        <button className="btn-s btn-full" style={{ marginBottom: 14, padding: 12 }} onClick={() => setShowAdd(true)}>＋ Add Worker</button>

        {workers.map(w => {
          const wl = primaryLogs(w.id);
          const reps = wl.filter(l => (l.types || []).includes("discipline"));
          return (
            <div className="wcard" key={w.id} onClick={() => openProfile(w.id)}>
              <div className="wav">👷</div>
              <div className="wmeta">
                <div className="wname">{w.name}</div>
                <div className="wgrade">{w.grade}</div>
                <div className="wsites">{(w.sites || []).map(id => sName(id)).join(" · ")}</div>
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
              <div className="fg">
                <label className="fl">Primary Site</label>
                <select className="fs" value={af.siteId} onChange={e => setAf(f => ({ ...f, siteId: e.target.value }))}>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="fg"><label className="fl">Apprenticeship Start Year</label><input className="fi" type="number" value={af.apprenticeStart} onChange={e => setAf(f => ({ ...f, apprenticeStart: e.target.value }))} /></div>
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
    const [showAdd, setShowAdd] = useState(false);
    const [editId, setEditId]   = useState(null);
    const [af, setAf] = useState({ name: "", address: "", type: "Commercial" });

    function openAdd()    { setAf({ name: "", address: "", type: "Commercial" }); setEditId(null); setShowAdd(true); }
    function openEdit(s)  { setAf({ name: s.name, address: s.address, type: s.type }); setEditId(s.id); setShowAdd(true); }
    function save() {
      if (!af.name.trim()) return;
      if (editId) { setSites(p => p.map(s => s.id === editId ? { ...s, ...af } : s)); showToast("✓ Site updated"); }
      else         { setSites(p => [...p, { id: uid(), ...af }]); showToast("✓ Site added"); }
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
          const cnt = logs.filter(l => l.siteId === s.id && l.role !== "also").length;
          return (
            <div className="scrd" key={s.id}>
              <div className="scrd-top">
                <div>
                  <div className="sname">{s.name}</div>
                  <div className="saddr">📍 {s.address}</div>
                  <div className="stype">{s.type}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--fh)", fontSize: 22, color: "var(--gold)" }}>{cnt}</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 9, color: "var(--muted)" }}>logs</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
              <div className="fg"><label className="fl">Site Name</label><input className="fi" placeholder="e.g. Westside Shopping Centre" value={af.name} onChange={e => setAf(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="fg"><label className="fl">Address</label><input className="fi" placeholder="e.g. 123 Main St, Melbourne VIC 3000" value={af.address} onChange={e => setAf(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="fg">
                <label className="fl">Site Type</label>
                <select className="fs" value={af.type} onChange={e => setAf(f => ({ ...f, type: e.target.value }))}>
                  {SITE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
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
      workers: [],
      types: [],
      sites: [],
      skillArea: "",
      severity: "",
      dateFrom: "",
      dateTo: "",
      role: "all", // all | primary | also
      followUpOnly: false,
    });
    const [previewMode, setPreviewMode] = useState(false);

    function toggleArr(key, val) {
      setFilters(f => ({ ...f, [key]: f[key].includes(val) ? f[key].filter(x => x !== val) : [...f[key], val] }));
    }

    const filtered = useMemo(() => {
      return logs.filter(l => {
        if (filters.workers.length   && !filters.workers.includes(l.workerId)) return false;
        if (filters.types.length     && !filters.types.some(t => (l.types||[]).includes(t))) return false;
        if (filters.sites.length     && !filters.sites.includes(l.siteId)) return false;
        if (filters.skillArea        && l.skillArea !== filters.skillArea && l.safetyCategory !== filters.skillArea) return false;
        if (filters.severity         && l.severity !== filters.severity) return false;
        if (filters.dateFrom         && l.date < filters.dateFrom) return false;
        if (filters.dateTo           && l.date > filters.dateTo) return false;
        if (filters.role === "primary" && l.role === "also") return false;
        if (filters.role === "also"    && l.role !== "also") return false;
        if (filters.followUpOnly     && !l.followUp) return false;
        return true;
      });
    }, [logs, filters]);

    const reportRows = useMemo(() => filtered.map(l => ({
      ...l,
      workerName: wName(l.workerId),
      siteName:   sName(l.siteId),
    })), [filtered]);

    const activeFilterCount = [
      filters.workers.length > 0, filters.types.length > 0, filters.sites.length > 0,
      !!filters.skillArea, !!filters.severity, !!filters.dateFrom || !!filters.dateTo,
      filters.role !== "all", filters.followUpOnly,
    ].filter(Boolean).length;

    function buildMetaString() {
      const parts = [];
      if (filters.workers.length)  parts.push(`Workers: ${filters.workers.map(wName).join(", ")}`);
      if (filters.types.length)    parts.push(`Types: ${filters.types.map(t => LOG_TYPES.find(x=>x.id===t)?.label).join(", ")}`);
      if (filters.sites.length)    parts.push(`Sites: ${filters.sites.map(sName).join(", ")}`);
      if (filters.skillArea)       parts.push(`Skill: ${filters.skillArea}`);
      if (filters.severity)        parts.push(`Severity: ${filters.severity}`);
      if (filters.dateFrom)        parts.push(`From: ${fmtDate(filters.dateFrom)}`);
      if (filters.dateTo)          parts.push(`To: ${fmtDate(filters.dateTo)}`);
      if (filters.role !== "all")  parts.push(`Role: ${filters.role === "primary" ? "Primary Only" : "Also Responsible Only"}`);
      if (filters.followUpOnly)    parts.push("Follow-ups only");
      return parts.length ? parts.join(" · ") : "All records";
    }

    function copyText() {
      const lines = reportRows.map(r =>
        `${fmtDate(r.date)} | ${r.workerName} | ${r.role==="also"?"Also Responsible":"Primary"} | ${(r.types||[]).join("+")} | ${r.siteName} | ${r.skillArea||r.safetyCategory||""} | Rating:${r.rating}/5 | ${r.notes}`
      ).join("\n");
      const header = `ProGlow Electrics — Field Log Report\n${buildMetaString()}\n${reportRows.length} records\n${"─".repeat(80)}\n`;
      navigator.clipboard.writeText(header + lines).then(() => showToast("✓ Copied to clipboard"));
    }

    return (
      <div>
        <div className="ptitle">CUSTOM <span>REPORTS</span></div>
        <div className="psub">FILTER · PREVIEW · EXPORT</div>

        {/* Results counter */}
        <div className="card gold-border" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="results-count">{filtered.length}</div>
            <div className="result-sub">RECORDS MATCH{activeFilterCount > 0 ? ` · ${activeFilterCount} FILTER${activeFilterCount>1?"S":""} ACTIVE` : " · ALL RECORDS"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
            <button className="btn-g" onClick={() => { setPreviewMode(true); }}>👁 Preview</button>
            {filtered.length > 0 && (
              <>
                <button className="btn-s" onClick={() => printReport("Field Log Report", reportRows, buildMetaString())}>🖨 Print / PDF</button>
                <button className="btn-s" onClick={copyText}>📋 Copy Text</button>
              </>
            )}
          </div>
        </div>

        {/* Filter: Workers */}
        <div className="rf-section">
          <div className="rf-title">Filter by Worker</div>
          <div className="filter-chips">
            {workers.map(w => (
              <div key={w.id} className={`fchip${filters.workers.includes(w.id) ? " on" : ""}`}
                onClick={() => toggleArr("workers", w.id)}>
                👷 {w.name.split(" ")[0]}
              </div>
            ))}
          </div>
        </div>

        {/* Filter: Role */}
        <div className="rf-section">
          <div className="rf-title">Filter by Role in Incident</div>
          <div className="filter-chips">
            {[["all","All Roles"],["primary","Primary Responsible"],["also","Also Responsible / On-Site"]].map(([val, label]) => (
              <div key={val} className={`fchip${filters.role === val ? " on" : ""}`}
                onClick={() => setFilters(f => ({ ...f, role: val }))}>
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
              <div key={t.id} className={`fchip${filters.types.includes(t.id) ? " on" : ""}`}
                onClick={() => toggleArr("types", t.id)}>
                {t.icon} {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Filter: Severity */}
        <div className="rf-section">
          <div className="rf-title">Filter by Severity (Discipline)</div>
          <div className="filter-chips">
            <div className={`fchip${filters.severity === "" ? " on" : ""}`} onClick={() => setFilters(f => ({ ...f, severity: "" }))}>Any</div>
            {SEVERITY_LEVELS.map(s => (
              <div key={s.id} className={`fchip${filters.severity === s.id ? " on" : ""}`}
                onClick={() => setFilters(f => ({ ...f, severity: s.id }))}>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Filter: Sites */}
        <div className="rf-section">
          <div className="rf-title">Filter by Site</div>
          <SiteMultiSelect
            selected={filters.sites}
            onChange={val => setFilters(f => ({ ...f, sites: val }))}
            sites={sites}
          />
        </div>

        {/* Filter: Skill Area */}
        <div className="rf-section">
          <div className="rf-title">Filter by Skill Area</div>
          <div className="filter-chips">
            <div className={`fchip${!filters.skillArea ? " on" : ""}`} onClick={() => setFilters(f => ({ ...f, skillArea: "" }))}>Any</div>
            {skillAreas.map(s => (
              <div key={s} className={`fchip${filters.skillArea === s ? " on" : ""}`}
                onClick={() => setFilters(f => ({ ...f, skillArea: s }))}>
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Filter: Date Range */}
        <div className="rf-section">
          <div className="rf-title">Date Range</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label className="fl">From</label><input type="date" className="fi" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} /></div>
            <div><label className="fl">To</label><input type="date" className="fi" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} /></div>
          </div>
        </div>

        {/* Filter: Follow-up only */}
        <div className="rf-section">
          <div className="rf-title">Other Filters</div>
          <label className="cbrow" onClick={() => setFilters(f => ({ ...f, followUpOnly: !f.followUpOnly }))}>
            <div className={`cbbox${filters.followUpOnly ? " on" : ""}`}>{filters.followUpOnly && <span style={{ color: "#000", fontWeight: 700, fontSize: 13 }}>✓</span>}</div>
            <span className="cblbl">🔔 Follow-up flagged entries only</span>
          </label>
        </div>

        {/* Reset */}
        {activeFilterCount > 0 && (
          <button className="btn-d btn-full" style={{ padding: 12 }}
            onClick={() => setFilters({ workers:[], types:[], sites:[], skillArea:"", severity:"", dateFrom:"", dateTo:"", role:"all", followUpOnly:false })}>
            Reset All Filters
          </button>
        )}

        {/* Preview Modal */}
        {previewMode && (
          <div className="moverlay" onClick={() => setPreviewMode(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="mhandle" />
              <div className="mtitle">REPORT PREVIEW</div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--fm)", marginBottom: 14 }}>{buildMetaString()}</div>
              {filtered.length === 0
                ? <div className="empty"><div className="empty-i">🔍</div>No records match these filters</div>
                : filtered.slice(0, 20).map(l => (
                  <div className="li" key={l.id} style={l.role === "also" ? { borderLeft: "3px solid var(--gold)" } : {}}>
                    <div className="lih">
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {(l.types || []).map(t => <TypeBadge key={t} type={t} />)}
                        {l.role === "also" && <span className="also-linked">Also Responsible</span>}
                      </div>
                      <div className="lir">{l.rating}/5</div>
                    </div>
                    <div className="lin">{l.notes}</div>
                    <div className="lim">
                      <span>{wName(l.workerId)}</span>
                      <span>{sName(l.siteId)}</span>
                      <span>{fmtDate(l.date)}</span>
                      {l.followUp && <span className="fuf">🔔</span>}
                    </div>
                  </div>
                ))
              }
              {filtered.length > 20 && <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, marginTop: 8 }}>Showing 20 of {filtered.length} — export for full results</div>}
              <div className="mactions" style={{ marginTop: 14 }}>
                <button className="btn-s" onClick={() => setPreviewMode(false)}>Close</button>
                <button className="btn-p" style={{ flex: 1 }} onClick={() => { printReport("Field Log Report", reportRows, buildMetaString()); }}>🖨 PRINT / PDF</button>
              </div>
              <button className="btn-s btn-full" style={{ marginTop: 8 }} onClick={copyText}>📋 Copy to Clipboard</button>
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
    const wl   = primaryLogs(worker.id);
    const also = logs.filter(l => l.role === "also" && l.workerId === worker.id);
    const reps = wl.filter(l => (l.types || []).includes("discipline"));
    const trains = wl.filter(l => (l.types || []).includes("training"));
    const avg  = wl.length ? (wl.reduce((a, b) => a + b.rating, 0) / wl.length).toFixed(1) : "—";
    const [tab, setTab] = useState("overview");

    const radar = DEFAULT_SKILL_AREAS.map(skill => {
      const rel = wl.filter(l => l.skillArea === skill);
      return { skill: skill.split(" ")[0], value: rel.length ? parseFloat((rel.reduce((a, b) => a + b.rating, 0) / rel.length).toFixed(1)) : 0 };
    });
    const trend = [...wl].reverse().slice(-10).map((l, i) => ({ i: i + 1, r: l.rating }));

    function toggleComp(c) {
      setWorkers(p => p.map(w => w.id === worker.id ? { ...w, competencies: w.competencies.includes(c) ? w.competencies.filter(x => x !== c) : [...w.competencies, c] } : w));
    }

    return (
      <div>
        <button className="btn-s" style={{ marginBottom: 14 }} onClick={() => setView("team")}>← Back</button>
        <div className="phdr">
          <div className="pav">👷</div>
          <div>
            <div className="pname">{worker.name}</div>
            <div className="pgrade">{worker.grade} · Since {worker.apprenticeStart}</div>
            <div style={{ fontSize: 11, color: "var(--gold)", marginTop: 3, fontFamily: "var(--fm)" }}>{(worker.sites || []).map(id => sName(id)).join(" · ")}</div>
          </div>
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
                        {(l.types || []).map(t => <TypeBadge key={t} type={t} />)}
                        {(l.types || []).includes("discipline") && <SevBadge severity={l.severity} />}
                      </div>
                      <div className="lir">{l.rating}/5</div>
                    </div>
                    <div className="lin">{l.notes}</div>
                    <div className="lim">
                      <span>{l.skillArea || l.safetyCategory || ""}</span>
                      <span>{sName(l.siteId)}</span>
                      <span>{fmtDate(l.date)}</span>
                      {l.followUp && <span className="fuf">🔔</span>}
                      {(l.alsoResponsible || []).length > 0 && (
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
                  <div style={{ fontSize: 14, marginBottom: 6 }}>{l.notes}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--fm)" }}>{l.safetyCategory} · {sName(l.siteId)}</div>
                  <button className="btn-s" style={{ marginTop: 10, fontSize: 10 }}
                    onClick={() => setSmsModal({ worker, log: { ...l, siteName: sName(l.siteId) } })}>
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
              : also.map(l => {
                const primaryW = workers.find(w => w.id === l.linkedPrimaryId);
                return (
                  <div className="li linked" key={l.id}>
                    <div className="lih">
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {(l.types || []).map(t => <TypeBadge key={t} type={t} />)}
                        <span className="also-linked">Also Responsible</span>
                      </div>
                      <div className="lir">{l.rating}/5</div>
                    </div>
                    <div className="lin">{l.notes}</div>
                    <div style={{ fontSize: 11, color: "var(--gold)", fontFamily: "var(--fm)", marginBottom: 4 }}>
                      Primary: {primaryW?.name || "—"}
                    </div>
                    <div className="lim"><span>{sName(l.siteId)}</span><span>{fmtDate(l.date)}</span></div>
                  </div>
                );
              })}
          </div>
        )}

        {tab === "competencies" && (
          <div className="card">
            <div className="ctitle">AS/NZS 3000 Competencies</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Tap to mark as completed</div>
            <div style={{ display: "flex", flexWrap: "wrap" }}>
              {AS3000_COMPETENCIES.map(c => (
                <div key={c} className={`ctag${(worker.competencies || []).includes(c) ? " on" : ""}`} onClick={() => toggleComp(c)}>
                  {(worker.competencies || []).includes(c) ? "✓" : "○"} {c}
                </div>
              ))}
            </div>
            <hr className="divider" />
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{(worker.competencies || []).length} / {AS3000_COMPETENCIES.length} completed</div>
          </div>
        )}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════════════════════════

  function Settings() {
    function ListManager({ title, items, setItems }) {
      const [newItem, setNewItem] = useState("");
      return (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="ctitle">{title}</div>
          {items.map((item, i) => (
            <div className="set-item" key={i}>
              <span className="set-tag">{item}</span>
              <button className="btn-d" style={{ padding: "6px 10px", fontSize: 9 }}
                onClick={() => setItems(p => p.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input className="fi" placeholder="Add new item…" value={newItem} onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newItem.trim()) { setItems(p => [...p, newItem.trim()]); setNewItem(""); } }} />
            <button className="btn-g" style={{ flexShrink: 0 }}
              onClick={() => { if (newItem.trim()) { setItems(p => [...p, newItem.trim()]); setNewItem(""); } }}>Add</button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="ptitle">SET<span>TINGS</span></div>
        <div className="psub">MANAGE CUSTOM LIST ITEMS</div>
        <ListManager title="Skill Areas" items={skillAreas} setItems={setSkillAreas} />
        <ListManager title="Safety / Discipline Categories" items={safeCats} setItems={setSafeCats} />
        <ListManager title="Worker Grades" items={grades} setItems={setGrades} />

        <div className="card" style={{ borderColor: "var(--red)" }}>
          <div className="ctitle" style={{ color: "var(--red)" }}>Danger Zone</div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>Permanently delete all log data. Workers and sites are kept.</div>
          <button className="btn-d" onClick={() => { if (window.confirm("Delete ALL log entries? This cannot be undone.")) { setLogs([]); showToast("All logs cleared"); } }}>
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

  const navItems = [
    { id: "dashboard", label: "Home",    icon: "📊" },
    { id: "log",       label: "Log",     icon: "✏️" },
    { id: "team",      label: "Team",    icon: "👷" },
    { id: "sites",     label: "Sites",   icon: "📍" },
    { id: "reports",   label: "Reports", icon: "📄" },
    { id: "settings",  label: "Config",  icon: "⚙️" },
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
          <div className="hdr-banner" />
          <div className="hdr-inner">
            <div className="logo-area">
              <img
                src="https://www.proglowelectrics.com.au/wp-content/uploads/2024/03/Mask-group.png"
                className="logo-img"
                alt="ProGlow Electrics"
                onError={e => { e.target.style.display = "none"; }}
              />
              <div className="logo-divider" />
              <div className="logo-sub">
                <strong>FieldLog</strong>
                Supervisor Portal
              </div>
            </div>
            <div className="hdr-count">{logs.filter(l=>l.role!=="also").length} entries</div>
          </div>
        </div>

        {/* Content */}
        <div className="main">{viewMap[view] || <Dashboard />}</div>

        {/* Bottom Nav */}
        <nav className="bnav">
          {navItems.map(n => (
            <button key={n.id}
              className={`ni${(view === n.id || (n.id === "team" && view === "profile")) ? " active" : ""}`}
              onClick={() => setView(n.id)}>
              <span className="ni-i">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>

        <SMSModal />
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}