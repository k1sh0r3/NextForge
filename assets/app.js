/* NextForge — resume builder & ATS tailoring. All client-side. */
(function () {
"use strict";

/* ---------------- utils ---------------- */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.add("hidden"), 3200);
}
function debounce(fn, ms) {
  let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}
function setPath(obj, path, val) {
  const ks = path.split("."); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}
const titleCase = s => s.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());

/* ---------------- skill dictionary ---------------- */
const SKILLS = ("python java javascript typescript react angular vue node.js express sql postgresql mysql " +
"mongodb redis java spring spring boot c# .net asp.net c++ go golang rust php ruby rails swift kotlin " +
"dart flutter html css sass tailwind bootstrap graphql rest api microservices docker kubernetes aws " +
"azure gcp terraform jenkins git github gitlab ci/cd linux bash powershell jira confluence agile scrum " +
"kanban machine learning deep learning tensorflow pytorch scikit-learn pandas numpy nlp computer vision " +
"data analysis data engineering etl spark hadoop airflow dbt tableau power bi excel statistics a/b testing " +
"figma sketch adobe xd ui ux design product management roadmapping stakeholder management user research " +
"seo sem google analytics salesforce hubspot digital marketing content marketing copywriting " +
"project management pmp risk management budgeting forecasting financial modeling accounting quickbooks " +
"customer success technical support troubleshooting networking tcp/ip cybersecurity penetration testing " +
"siem soc incident response cloud security devops sre monitoring prometheus grafana " +
"leadership mentoring communication collaboration problem solving critical thinking time management " +
"adaptability attention to detail").split(" ");

const STOPWORDS = new Set(("the,a,an,and,or,for,with,will,our,you,your,we,they,their,have,has,had,are,is,was,were,be,been,being,from,that,this,these,those,as,at,by,on,in,of,to,into,per,via,using,use,used,including,include,across,within,between,through,during,under,over,about,into,up,out,all,any,each,other,more,most,such,than,then,there,here,where,when,what,which,who,whom,whose,can,could,should,would,may,might,must,shall,do,does,did,done,not,no,yes,if,else,also,just,only,very,well,new,join,help,drive,lead,ensure,deliver,build,develop,design,create,maintain,support,work,team,teams,role,candidate,ideal,looking,seeking,joining,apply,etc,including,plus,years,year,experience,experienced,strong,ability,skills,skill,knowledge,understanding,passion,opportunity,business,company,products,services,customers,clients,world,diverse,inclusive,equal,etc").split(","));

/* ---------------- state ---------------- */
function blankResume() {
  return { name: "", email: "", phone: "", location: "", links: "",
           summary: "", experience: [], education: [], skills: [], extra: [] };
}
const state = {
  resume: blankResume(), jd: "", company: "",
  keywords: [], template: "modern", lastScore: null,
};

const LS_KEY = "nextforge-state-v1";
function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      resume: state.resume, jd: $("jd-input").value,
      company: $("company-input").value, template: state.template,
    }));
  } catch (e) { /* storage full / private mode — non-fatal */ }
}
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (!d) return false;
    state.resume = Object.assign(blankResume(), d.resume);
    $("jd-input").value = d.jd || "";
    $("company-input").value = d.company || "";
    state.template = d.template || "modern";
    $("template-select").value = state.template;
    return true;
  } catch (e) { return false; }
}
const persistSoon = debounce(persist, 800);

function sampleResume() {
  return {
    name: "Alex Morgan", email: "alex.morgan@email.com", phone: "(555) 123-4567",
    location: "Austin, TX", links: "linkedin.com/in/alexmorgan · github.com/alexmorgan",
    summary: "Software engineer with 4 years of experience building scalable web applications. Passionate about clean code, system design, and mentoring junior developers.",
    experience: [
      { title: "Software Engineer", company: "TechCorp", dates: "2022 – Present",
        bullets: [
          "Built REST APIs serving 2M+ requests per day using Node.js and PostgreSQL.",
          "Reduced page load time by 40% by optimizing React rendering and caching.",
          "Mentored 3 junior engineers through code reviews and pair programming.",
        ] },
      { title: "Junior Developer", company: "StartupXYZ", dates: "2020 – 2022",
        bullets: [
          "Shipped 15+ features for a SaaS dashboard used by 10k customers.",
          "Wrote automated tests raising coverage from 45% to 80%.",
        ] },
    ],
    education: [{ degree: "B.S. Computer Science", school: "University of Texas", dates: "2016 – 2020" }],
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "PostgreSQL", "Docker", "AWS", "Git"],
  };
}

function resumePlainText() {
  const r = state.resume, parts = [r.name, r.summary, r.skills.join(" ")];
  for (const e of r.experience) parts.push(e.title, e.company, e.bullets.join(" "));
  for (const e of r.education) parts.push(e.degree, e.school);
  for (const b of (r.extra || [])) parts.push(b.heading, b.text);
  return parts.join(" ");
}
function hasResume() {
  const r = state.resume;
  return r.name || r.experience.length || r.skills.length || (r.extra && r.extra.length);
}

/* ---------------- resume parsing ---------------- */
const DATE_RE = /((?:19|20)\d{2})\s*[–—\-to]+\s*((?:19|20)\d{2}|present|current|now)/i;
const SEC_NAMES = [
  ["summary", /^(professional\s+)?summary|^(career\s+)?objective|^profile/i],
  ["experience", /^(work\s+|professional\s+)?experience|^employment(\s+history)?|^work\s+history/i],
  ["education", /^education/i],
  ["skills", /^(technical\s+)?skills|^technologies|^core\s+competencies/i],
  ["projects", /^projects/i],
  // recognized but kept as free-form "extra" blocks so nothing is ever dropped
  ["certifications", /^certifications?|^licenses?/i],
  ["publications", /^publications?/i],
  ["awards", /^awards?(?!-winning)/i],
];

function detectSection(line) {
  const t = line.replace(/[:\s]+$/, "").trim();
  if (t.length > 40) return null;
  for (const [name, re] of SEC_NAMES) if (re.test(t)) return name;
  return null;
}

function parseResumeText(text) {
  const r = blankResume();
  const lines = text.split(/\r?\n/).map(l => l.trim());
  const nonEmpty = lines.filter(l => l.length);

  // --- contact block: first ~8 lines ---
  const head = nonEmpty.slice(0, 8).join("\n");
  const emailM = head.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (emailM) r.email = emailM[0];
  const phoneM = head.match(/(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  if (phoneM) r.phone = phoneM[0];
  if (nonEmpty.length) r.name = nonEmpty[0].slice(0, 60);
  const linkM = head.match(/(linkedin\.com\/\S+|github\.com\/\S+)/gi);
  if (linkM) r.links = [...new Set(linkM)].join(" · ");

  // --- split into sections (accumulate: multi-page resumes often repeat headers) ---
  const sections = {}; let cur = null, curLines = [];
  const saveSec = () => { if (cur) sections[cur] = (sections[cur] || []).concat(curLines); };
  for (const line of lines) {
    const sec = line ? detectSection(line) : null;
    if (sec) { saveSec(); cur = sec; curLines = []; }
    else if (cur && line) curLines.push(line);
  }
  saveSec();

  if (sections.summary) r.summary = sections.summary.join(" ").slice(0, 600);

  if (sections.experience) r.experience = parseExperience(sections.experience);
  if (sections.education) r.education = parseEducation(sections.education);
  if (sections.skills) {
    const raw = sections.skills.join("\n").split(/[,•\n|/·]/).map(s => s.trim())
      .filter(s => s && s.length > 1 && s.length < 45);
    r.skills = [...new Set(raw)].slice(0, 40);
  }

  // --- catch-all: never silently drop resume content ---
  // Any detected section we don't structure (projects, certifications, …)
  // is kept as an editable free-form block, as is any non-contact text
  // before the first header (e.g. an objective paragraph with no header).
  const HANDLED = new Set(["summary", "experience", "education", "skills"]);
  r.extra = [];
  for (const name of Object.keys(sections)) {
    if (!HANDLED.has(name) && sections[name].length)
      r.extra.push({ heading: name, text: sections[name].join("\n").slice(0, 4000) });
  }
  const secIdx = lines.findIndex(l => l && detectSection(l));
  const preLines = lines.slice(0, secIdx === -1 ? lines.length : secIdx)
    .map(l => l.trim()).filter(Boolean);
  const isContact = (l, i) => i === 0 || /[\w.+-]+@[\w-]+\.[\w.]+/.test(l) ||
    /\(?\+?\d[\d\s().-]{7,}\d/.test(l) || /linkedin\.com|github\.com|https?:\/\//i.test(l);
  const preText = preLines.filter((l, i) => !isContact(l, i)).join("\n").slice(0, 4000);
  if (preText.trim()) r.extra.unshift({ heading: "", text: preText });
  return r;
}

function parseExperience(lines) {
  const entries = []; let cur = [];
  const isBullet = l => /^[•\-\*▪‣◦]/.test(l);
  const gHasDate = g => g.some(l => DATE_RE.test(l));
  const gHasBullet = g => g.some(isBullet);
  for (const line of lines) {
    const startNew = cur.length && !isBullet(line) &&
      ((gHasBullet(cur) && gHasDate(cur)) ||            // title line after a complete entry
       (DATE_RE.test(line) && gHasDate(cur) && !gHasBullet(cur))); // date line, previous entry had no bullets
    if (startNew) { entries.push(cur); cur = [line]; }
    else cur.push(line);
  }
  if (cur.length) entries.push(cur);
  return entries.map(g => {
    const bullets = [];
    let title = "", company = "", dates = "";
    for (const line of g) {
      const dm = line.match(DATE_RE);
      if (/^[•\-\*▪‣◦]/.test(line)) { bullets.push(line.replace(/^[•\-\*▪‣◦]\s*/, "")); continue; }
      if (dm && !dates) {
        dates = dm[0];
        const rest = line.replace(dm[0], "").replace(/^[|,–—\-\s]+|[|,–—\-\s]+$/g, "").trim();
        if (rest && !company) company = rest;
        continue;
      }
      if (!title) title = line;
      else if (!company && line.length < 80) company = line;
      else bullets.push(line);
    }
    return { title: title.slice(0, 90), company: company.slice(0, 90),
             dates: dates.slice(0, 40), bullets: bullets.slice(0, 12) };
  }).filter(e => e.title || e.bullets.length).slice(0, 10);
}

function parseEducation(lines) {
  const out = []; let cur = { degree: "", school: "", dates: "" };
  const flush = () => {
    if (cur.degree || cur.school) out.push(cur);
    cur = { degree: "", school: "", dates: "" };
  };
  for (const line of lines) {
    if (!line) { flush(); continue; }
    const dm = line.match(DATE_RE);
    if (dm && (cur.degree || cur.school)) { cur.dates = dm[0]; flush(); continue; }
    if (/bachelor|master|\bb\.?s\.?\b|\bm\.?s\.?\b|ph\.?d|associate|mba/i.test(line) && !cur.degree) cur.degree = line;
    else if (!cur.school) cur.school = line;
    else { flush(); cur.school = line; }
  }
  flush();
  return out.slice(0, 5);
}

async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return readPdf(file);
  if (name.endsWith(".docx")) {
    if (typeof mammoth === "undefined") throw new Error("docx-lib-missing");
    const buf = await file.arrayBuffer();
    const res = await mammoth.extractRawText({ arrayBuffer: buf });
    return res.value;
  }
  if (name.endsWith(".txt") || !name.includes(".")) return await file.text();
  throw new Error("unsupported-type");
}

async function readPdf(file) {
  if (typeof pdfjsLib === "undefined") throw new Error("pdf-lib-missing");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    window.__pdfWorkerSrc || "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let lastY = null;
    for (const it of tc.items) {
      if (lastY !== null && Math.abs(it.transform[5] - lastY) > 4) text += "\n";
      text += it.str + " ";
      lastY = it.transform[5];
    }
    text += "\n";
  }
  return text;
}

/* ---------------- rendering the editable resume ---------------- */
const doc = $("resume-doc");

function ed(path, text, ph, tag) {
  const t = tag || "div";
  return `<${t} contenteditable="true" spellcheck="false" data-path="${path}" data-ph="${esc(ph || "click to edit")}">${esc(text)}</${t}>`;
}

function renderDoc() {
  const r = state.resume;
  doc.className = "tpl-" + state.template;

  let h = ed("name", r.name, "Your Name", "h1");
  const contact = [r.email, r.phone, r.location, r.links].filter(Boolean).join(" · ");
  h += `<div class="r-contact">${ed("contactLine", contact, "email · phone · location · links")}</div>`;
  // contact line is a composite; parse it back on edit
  h += `<h2 class="rsec">Summary</h2>` + ed("summary", r.summary, "2–3 line professional summary");

  h += `<h2 class="rsec">Experience</h2><div id="exp-list">`;
  r.experience.forEach((e, i) => {
    h += `<div class="r-entry" data-exp="${i}">
      <button class="entry-x" data-del-exp="${i}" title="Remove entry">×</button>
      <div class="r-entry-head">${ed(`experience.${i}.title`, e.title, "Job title")}
        <span>${ed(`experience.${i}.dates`, e.dates, "dates")}</span></div>
      <div class="r-entry-sub">${ed(`experience.${i}.company`, e.company, "Company")}</div>
      <ul class="r-bullets">` +
      e.bullets.map((b, j) => `<li contenteditable="true" spellcheck="false" data-path="experience.${i}.bullets.${j}" data-ph="achievement bullet">${esc(b)}</li>`).join("") +
      `</ul><button class="add-bullet" data-add-bullet="${i}">+ bullet</button></div>`;
  });
  h += `</div>`;

  h += `<h2 class="rsec">Education</h2><div id="edu-list">`;
  r.education.forEach((e, i) => {
    h += `<div class="r-entry" data-edu="${i}">
      <button class="entry-x" data-del-edu="${i}" title="Remove entry">×</button>
      <div class="r-entry-head">${ed(`education.${i}.degree`, e.degree, "Degree")}
        <span>${ed(`education.${i}.dates`, e.dates, "dates")}</span></div>
      <div class="r-entry-sub">${ed(`education.${i}.school`, e.school, "School")}</div></div>`;
  });
  h += `</div>`;

  h += `<h2 class="rsec">Skills</h2><div class="r-skills" id="skills-list">` +
    r.skills.map((s, i) =>
      `<span class="skill-chip">${esc(s)}<button data-del-skill="${i}" title="Remove">×</button></span>`
    ).join("") +
    `<span class="skill-add"><input id="skill-input" placeholder="+ add skill" maxlength="40"><button id="skill-add-btn">Add</button></span></div>`;

  // free-form blocks: everything the parser couldn't structure (projects,
  // certifications, header-less resumes…) — kept verbatim, fully editable
  (r.extra || []).forEach((b, i) => {
    const label = b.heading ? b.heading.charAt(0).toUpperCase() + b.heading.slice(1) : "Additional content";
    h += `<h2 class="rsec">${esc(label)}</h2><div class="r-entry" data-extra="${i}">` +
      `<button class="entry-x" data-del-extra="${i}" title="Remove section">×</button>` +
      `<div class="r-extra" contenteditable="true" spellcheck="false" data-path="extra.${i}.text" data-ph="click to edit">${esc(b.text).replace(/\n/g, "<br>")}</div></div>`;
  });

  doc.innerHTML = h;
}

// composite contact line -> parse back into fields
function parseContactLine(line) {
  const r = state.resume;
  const emailM = line.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const phoneM = line.match(/(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  r.email = emailM ? emailM[0] : "";
  r.phone = phoneM ? phoneM[0] : "";
  let rest = line;
  if (emailM) rest = rest.replace(emailM[0], "");
  if (phoneM) rest = rest.replace(phoneM[0], "");
  const parts = rest.split("·").map(s => s.trim()).filter(Boolean);
  const linkIdx = parts.findIndex(p => /linkedin|github|\.com|\.io|\.dev/i.test(p));
  r.links = linkIdx >= 0 ? parts.splice(linkIdx, 1)[0] : "";
  r.location = parts.join(" · ");
}

doc.addEventListener("input", e => {
  const el = e.target.closest("[data-path]");
  if (!el) return;
  const path = el.dataset.path, val = el.innerText.replace(/\n+$/, "");
  if (path === "contactLine") parseContactLine(val);
  else setPath(state.resume, path, val);
  persistSoon();
  updateScoreSoon();
});

// structural edits (re-render)
doc.addEventListener("click", e => {
  const t = e.target;
  const delExp = t.dataset.delExp, delEdu = t.dataset.delEdu, delSk = t.dataset.delSkill, delEx = t.dataset.delExtra;
  const addB = t.dataset.addBullet;
  if (delExp !== undefined) { state.resume.experience.splice(+delExp, 1); renderDoc(); persist(); updateScore(); }
  else if (delEdu !== undefined) { state.resume.education.splice(+delEdu, 1); renderDoc(); persist(); updateScore(); }
  else if (delSk !== undefined) { state.resume.skills.splice(+delSk, 1); renderDoc(); persist(); updateScore(); }
  else if (delEx !== undefined) { (state.resume.extra || []).splice(+delEx, 1); renderDoc(); persist(); updateScore(); }
  else if (addB !== undefined) { state.resume.experience[+addB].bullets.push(""); renderDoc(); persist(); }
  else if (t.id === "skill-add-btn") addSkillFromInput();
});
doc.addEventListener("keydown", e => {
  if (e.target.id === "skill-input" && e.key === "Enter") { e.preventDefault(); addSkillFromInput(); }
});
function addSkillFromInput() {
  const inp = $("skill-input");
  const v = (inp.value || "").trim();
  if (!v) return;
  if (!state.resume.skills.some(s => s.toLowerCase() === v.toLowerCase())) {
    state.resume.skills.push(v);
    renderDoc(); persist(); updateScore();
    toast(`Added “${v}” to skills.`);
  } else toast("Skill already listed.");
}

/* ---------------- job-description analysis ---------------- */
function analyzeJD(jd) {
  const out = [];
  // 1. known skills
  for (const s of SKILLS) {
    const m = jd.match(new RegExp("\\b" + escapeRegExp(s) + "\\b", "gi"));
    if (m) out.push({ term: s, count: m.length, type: "skill" });
  }
  const seen = new Set(out.map(o => o.term.toLowerCase()));
  // 2. capitalized multi-word phrases (Product Manager, Machine Learning)
  const phrases = {};
  for (const m of jd.match(/\b([A-Z][A-Za-z0-9+#.]{2,}(?:\s+[A-Z][A-Za-z0-9+#.]{2,}){1,2})\b/g) || []) {
    const key = m.toLowerCase();
    if (seen.has(key) || STOPWORDS.has(key.split(" ")[0])) continue;
    phrases[key] = phrases[key] || { term: titleCase(m), count: 0, type: "phrase" };
    phrases[key].count++;
  }
  // 3. frequent meaningful single words
  const freq = {};
  for (const w of jd.toLowerCase().match(/\b[a-z][a-z0-9+#.\-]{3,}\b/g) || []) {
    if (STOPWORDS.has(w) || seen.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  const cands = Object.values(phrases).concat(
    Object.entries(freq).filter(([, c]) => c >= 2)
      .map(([w, c]) => ({ term: w, count: c, type: "keyword" }))
  );
  cands.sort((a, b) => b.count - a.count);
  return out.concat(cands).slice(0, 40);
}

/* ---------------- ATS scoring ---------------- */
function computeScore() {
  const r = state.resume;
  const text = resumePlainText().toLowerCase();
  const factors = [];

  if (state.keywords.length) {
    const matched = state.keywords.filter(k => text.includes(k.term.toLowerCase())).length;
    factors.push({ label: "Keyword match", w: 45, v: matched / state.keywords.length, detail: `${matched}/${state.keywords.length}` });
  }
  const secs = [r.summary.trim() ? 1 : 0, r.experience.length ? 1 : 0,
                r.education.length ? 1 : 0, r.skills.length >= 3 ? 1 : 0];
  factors.push({ label: "Sections", w: 15, v: secs.reduce((a, b) => a + b, 0) / 4 });
  factors.push({ label: "Contact info", w: 10, v: ((r.email ? 1 : 0) + (r.phone ? 1 : 0)) / 2 });
  const bullets = r.experience.flatMap(e => e.bullets).filter(b => b.trim());
  const quant = bullets.length ? bullets.filter(b => /\d/.test(b)).length / bullets.length : 0;
  factors.push({ label: "Quantified bullets", w: 15, v: quant, detail: `${Math.round(quant * 100)}%` });
  factors.push({ label: "Skills depth", w: 10, v: Math.min(r.skills.length / 8, 1), detail: `${r.skills.length}` });
  const words = text.split(/\s+/).filter(Boolean).length;
  const lenV = words < 200 ? words / 200 : words <= 900 ? 1 : Math.max(0, 1 - (words - 900) / 900);
  factors.push({ label: "Length", w: 5, v: lenV, detail: `${words} words` });

  const wSum = factors.reduce((a, f) => a + f.w, 0);
  const total = Math.round(factors.reduce((a, f) => a + f.v * f.w, 0) / wSum * 100);
  return { total: hasResume() ? total : 0, factors };
}

const updateScoreSoon = debounce(updateScore, 700);
function updateScore() {
  const { total, factors } = computeScore();
  state.lastScore = total;
  $("score-num").textContent = hasResume() ? total : "–";
  const ring = $("ring-fg"), C = 326.7;
  ring.style.strokeDashoffset = C * (1 - total / 100);
  ring.style.stroke = total >= 80 ? "var(--green)" : total >= 60 ? "var(--amber)" : "var(--red)";
  $("score-breakdown").innerHTML = factors.map(f =>
    `<li><div class="blabel"><span>${esc(f.label)}</span><span>${f.detail || Math.round(f.v * 100) + "%"}</span></div>
     <div class="bar"><i style="width:${Math.round(f.v * 100)}%"></i></div></li>`
  ).join("") +
  (state.keywords.length ? "" : `<li class="hint">Paste a job description and run the update to unlock keyword scoring.</li>`);
}

/* ---------------- tailor: the main event ---------------- */
// display a keyword using the casing actually used in the JD ("CI/CD", not "Ci/cd")
function displayTerm(k) {
  const m = (state.jd || "").match(new RegExp("\\b" + escapeRegExp(k.term) + "\\b", "i"));
  return m ? m[0] : titleCase(k.term);
}

function renderChips(missing) {
  const box = $("missing-chips");
  if (!missing.length) {
    box.innerHTML = `<span class="hint" style="color:var(--green)">✓ No missing keywords — great match!</span>`;
    return;
  }
  box.innerHTML = "";
  for (const k of missing.slice(0, 30)) {
    const c = document.createElement("button");
    c.className = "chip";
    c.innerHTML = `${esc(k.term)} <small>×${k.count}</small>`;
    c.title = "Add to skills";
    c.onclick = () => {
      const disp = displayTerm(k);
      if (!state.resume.skills.some(s => s.toLowerCase() === disp.toLowerCase())) {
        state.resume.skills.push(disp);
        c.classList.add("added"); c.innerHTML = `✓ ${esc(k.term)}`;
        renderDoc(); persist(); updateScore();
      }
    };
    box.appendChild(c);
  }
}

function tailor() {
  const jd = $("jd-input").value.trim();
  if (!jd) return toast("Paste a job description first.");
  if (!hasResume()) return toast("Upload or paste your resume first.");
  const before = computeScore().total;

  state.keywords = analyzeJD(jd);
  state.company = $("company-input").value.trim();
  state.jd = jd;

  const text = resumePlainText().toLowerCase();
  const missing = state.keywords.filter(k => !text.includes(k.term.toLowerCase()));

  let added = 0;
  for (const k of missing) {
    if (added >= 12 || k.type !== "skill") continue;
    const disp = displayTerm(k);
    if (!state.resume.skills.some(s => s.toLowerCase() === disp.toLowerCase())) {
      state.resume.skills.push(disp); added++;
    }
  }
  const stillMissing = state.keywords.filter(k =>
    !resumePlainText().toLowerCase().includes(k.term.toLowerCase()));

  renderDoc(); renderChips(stillMissing); updateScore(); persist();
  const after = computeScore().total;
  const co = state.company ? ` for ${state.company}` : "";
  toast(`Added ${added} missing skills${co}. ATS score ${before} → ${after}.`);
}

/* ---------------- PDF export (real selectable text) ---------------- */
window.addEventListener("beforeprint", () => {
  const root = $("print-root");
  root.innerHTML = "";
  const clone = doc.cloneNode(true);
  clone.querySelectorAll(".entry-x, .add-bullet, .skill-add").forEach(b => b.remove());
  clone.querySelectorAll("[contenteditable]").forEach(el => el.removeAttribute("contenteditable"));
  root.appendChild(clone);
});

/* ---------------- optional AI polish (bring your own key) ---------------- */
const AI_PRESETS = {
  openai: { endpoint: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  gemini: { endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-3.8-flash" },
  groq:   { endpoint: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
};

async function aiChat(prompt, step) {
  const key = $("ai-key").value.trim() || localStorage.getItem("nextforge-ai-key") || "";
  if (!key) throw new Error("No API key found — paste your key in the AI polish box (step 3).");
  localStorage.setItem("nextforge-ai-key", key);
  $("ai-key").value = "";
  const endpoint = $("ai-endpoint").value.trim() || AI_PRESETS.openai.endpoint;
  localStorage.setItem("nextforge-ai-endpoint", endpoint);
  let model = $("ai-model").value.trim() || "gpt-4o-mini";
  if (model === "gemini-2.5-flash") {
    // Google retired gemini-2.5-flash for new API keys — remap to its successor
    // and update the visible field so the user sees the change.
    model = "gemini-3.8-flash";
    $("ai-model").value = model;
  }
  const body = JSON.stringify({ model, temperature: 0.4,
    messages: [{ role: "user", content: prompt }] });
  // The provider can be briefly overloaded (503) or rate-limited (429) —
  // retry those with backoff instead of failing the step outright.
  let lastErr = new Error("request failed");
  for (let attempt = 1; attempt <= 3; attempt++) {
    let res = null;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body,
      });
    } catch (e) { lastErr = e; }
    if (res && res.ok) {
      const data = await res.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : "";
      return (content || "").trim();
    }
    if (res) {
      let detail = "";
      try { detail = (await res.text()).slice(0, 300); } catch (e) { /* ignore */ }
      try {
        const j = JSON.parse(detail);
        detail = (j.error && j.error.message) || j.message || detail;
      } catch (e) { /* not JSON, keep raw */ }
      lastErr = new Error("API error " + res.status + (detail ? ": " + detail : ""));
      if (res.status !== 503 && res.status !== 429) throw lastErr;
    }
    if (attempt < 3) {
      if (step) aiStatus(step + ": model is busy, retrying…");
      await new Promise(r => setTimeout(r, attempt * 4000));
    }
  }
  throw lastErr;
}

const jdContext = () => $("jd-input").value.trim().slice(0, 3000);
const aiStatus = msg => { $("ai-status").textContent = msg; };
// collects per-step failure reasons so the final "Done with issues" line
// shows WHY each step failed instead of the details being overwritten
const aiStepErrors = []; // {step, reason} — kept separate so identical reasons dedupe
function aiFail(step, err) {
  const reason = (err && err.message) || "unknown error";
  aiStepErrors.push({ step, reason });
  aiStatus(step + " failed: " + reason);
  return false;
}

async function aiRewriteSummary() {
  aiStatus("Rewriting summary…");
  const prompt =
    `Rewrite this professional summary for a resume so it targets the job description below. ` +
    `Keep it to 2-3 lines, no first-person pronouns, lead with the strongest matching qualifications. ` +
    `Return ONLY the rewritten summary, no quotes, no extra text.\n\n` +
    `CURRENT SUMMARY:\n${state.resume.summary || "(none)"}\n\n` +
    `JOB DESCRIPTION:\n${jdContext()}`;
  try {
    const out = await aiChat(prompt, "Summary");
    if (out == null) return false;
    state.resume.summary = out.replace(/^["'“”]+|["'“”]+$/g, "").slice(0, 600);
    renderDoc(); persist(); updateScore();
    aiStatus("Summary rewritten — review it on the right.");
    return true;
  } catch (err) { return aiFail("Summary", err); }
}

async function aiRewriteBullets() {
  if (!state.resume.experience.length) {
    aiStepErrors.push({ step: "Bullets", reason: "no experience entries to polish." });
    toast("No experience entries to polish.");
    return false;
  }
  const jd = jdContext();
  let ok = true;
  for (let i = 0; i < state.resume.experience.length; i++) {
    const e = state.resume.experience[i];
    if (!e.bullets.filter(b => b.trim()).length) continue;
    aiStatus(`Rewriting bullets ${i + 1}/${state.resume.experience.length}…`);
    const prompt =
      `Rewrite these resume bullets for a ${e.title} to be concise, start with strong action verbs, ` +
      `include metrics where plausible, and align with this job description. ` +
      `Return ONLY the rewritten bullets, one per line, no numbering, no extra text.\n\n` +
      `BULLETS:\n${e.bullets.join("\n")}\n\nJOB DESCRIPTION:\n${jd}`;
    try {
      const out = await aiChat(prompt, "Bullets");
      if (out == null) return false;
      const lines = out.split("\n")
        .map(l => l.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
      if (lines.length) { e.bullets = lines; renderDoc(); }
    } catch (err) { aiFail("Bullets", err); ok = false; break; }
  }
  if (ok) aiStatus("Bullets rewritten — review them before exporting.");
  persist(); updateScore();
  return ok;
}

async function aiOptimizeSkills() {
  aiStatus("Optimizing skills…");
  const prompt =
    `Given this candidate's current skills and the job description, produce an optimized skills list: ` +
    `keep the candidate's real skills that are most relevant to the job first, then add closely-related ` +
    `skills from the job description the candidate likely has. Do not invent senior-level expertise the ` +
    `candidate lacks. Return ONLY a comma-separated list, max 20 skills, no extra text.\n\n` +
    `CURRENT SKILLS:\n${state.resume.skills.join(", ")}\n\n` +
    `JOB DESCRIPTION:\n${jdContext()}`;
  try {
    const out = await aiChat(prompt, "Skills");
    if (out == null) return false;
    const seen = new Set(), skills = [];
    for (const raw of out.split(/[\n,]+/)) {
      const s = raw.replace(/^[-•*\d.)\s]+/, "").trim();
      if (!s || s.length < 2 || s.length > 45) continue;
      const k = s.toLowerCase();
      if (!seen.has(k)) { seen.add(k); skills.push(s); }
      if (skills.length >= 20) break;
    }
    if (skills.length) {
      state.resume.skills = skills;
      renderDoc(); persist(); updateScore();
      aiStatus(`Skills optimized (${skills.length}).`);
      return true;
    }
    aiStepErrors.push({ step: "Skills", reason: "the AI returned no usable list." });
    aiStatus("Skills: no usable list returned.");
    return false;
  } catch (err) { return aiFail("Skills", err); }
}

async function aiTailorAll() {
  if (!$("jd-input").value.trim()) return toast("Paste a job description first.");
  if (!hasResume()) return toast("Load a resume first.");
  aiStatus("AI tailoring full resume…");
  aiStepErrors.length = 0;
  const results = [];
  results.push(["summary", await aiRewriteSummary()]);
  results.push(["bullets", await aiRewriteBullets()]);
  results.push(["skills", await aiOptimizeSkills()]);
  const failed = results.filter(([, ok]) => !ok).map(([n]) => n);
  const reasons = [...new Set(aiStepErrors.map(e => e.reason))];
  const detail = reasons.length <= 1
    ? (reasons[0] || "")
    : aiStepErrors.map(e => e.step + ": " + e.reason).join(" ");
  aiStatus(failed.length
    ? `Done with issues: ${failed.join(", ")} failed.${detail ? " " + detail : ""}`
    : "Full AI tailor complete — review everything on the right.");
  toast(failed.length ? "Some steps failed — see status." : "Resume tailored. Review before exporting.");
}

/* ---------------- wiring ---------------- */
let pendingFile = null;
$("file-input").addEventListener("change", e => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  pendingFile = f;
  $("btn-load-resume").disabled = false;
  $("resume-status").textContent = `Selected “${f.name}” — click “Load resume” to parse it into the right pane.`;
});
$("btn-load-resume").addEventListener("click", async () => {
  const f = pendingFile;
  if (!f) return toast("Choose a file with “Upload resume” first.");
  const btn = $("btn-load-resume");
  const status = $("resume-status");
  const revealPaste = () => { $("paste-area").classList.remove("hidden"); $("btn-paste-parse").classList.remove("hidden"); };
  btn.disabled = true;
  status.textContent = "Parsing " + f.name + "…";
  try {
    if (window.__libsReady) {
      status.textContent = "Loading document reader…";
      // don't let a stalled CDN hang the button forever
      const timeout = new Promise(res => setTimeout(() => res("timeout"), 15000));
      const libs = await Promise.race([window.__libsReady, timeout]);
      if (libs === "timeout") throw new Error("reader-timeout");
    }
    const text = await readFile(f);
    if (!text || text.trim().length < 50) {
      // e.g. scanned/image PDF: don't wipe the current resume, offer paste instead
      status.textContent = "No readable text found in this file (it may be a scanned image). Paste the text below instead.";
      revealPaste(); $("paste-area").focus();
    } else {
      state.resume = parseResumeText(text);
      renderDoc(); updateScore(); persist();
      status.textContent = `Loaded “${f.name}” into the right pane. Click any text there to fix parsing mistakes.`;
      pendingFile = null;
    }
  } catch (err) {
    const msg = (err && err.message) || "";
    status.textContent =
      msg === "pdf-lib-missing" ? "PDF reader failed to load — check your connection and reload the page." :
      msg === "reader-timeout" ? "The document reader is taking too long to load — your network or ad-blocker may be blocking script CDNs. Reload and retry." :
      msg === "docx-lib-missing" ? "Word reader failed to load — check your connection and reload the page." :
      msg === "unsupported-type" ? "That file type isn't supported — use PDF, DOCX, or TXT." :
      `Couldn't parse that file${err && err.name ? " (" + err.name + ")" : ""} — try pasting the text instead.`;
    if (msg !== "pdf-lib-missing" && msg !== "docx-lib-missing") revealPaste();
  }
  btn.disabled = !pendingFile; // failed loads keep the file so you can retry
});

$("btn-paste-parse").addEventListener("click", () => {
  const t = $("paste-area").value.trim();
  if (!t) return toast("Paste your resume text first.");
  state.resume = parseResumeText(t);
  renderDoc(); updateScore(); persist();
  $("resume-status").textContent = "Resume parsed from text. Edit anything on the right.";
});

$("template-select").addEventListener("change", e => {
  state.template = e.target.value; renderDoc(); persist();
});
$("btn-tailor").addEventListener("click", tailor);
$("btn-pdf").addEventListener("click", () => {
  if (!hasResume()) return toast("Load a resume first.");
  window.print();
});
$("btn-save").addEventListener("click", () => { persist(); toast("Saved to this browser."); });
$("btn-sample").addEventListener("click", () => {
  state.resume = sampleResume();
  renderDoc(); updateScore(); persist();
  $("resume-status").textContent = "Sample resume loaded — try pasting a job description.";
});
$("btn-add-exp").addEventListener("click", () => {
  state.resume.experience.push({ title: "", company: "", dates: "", bullets: [""] });
  renderDoc(); persist(); updateScore();
});
$("btn-add-edu").addEventListener("click", () => {
  state.resume.education.push({ degree: "", school: "", dates: "" });
  renderDoc(); persist(); updateScore();
});
$("btn-add-skill").addEventListener("click", () => {
  const v = prompt("New skill:");
  if (v && v.trim()) {
    state.resume.skills.push(v.trim());
    renderDoc(); persist(); updateScore();
  }
});
$("btn-ai-all").addEventListener("click", aiTailorAll);
$("btn-ai-summary").addEventListener("click", aiRewriteSummary);
$("btn-ai-bullets").addEventListener("click", aiRewriteBullets);
$("btn-ai-skills").addEventListener("click", aiOptimizeSkills);
document.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", () => {
  const p = AI_PRESETS[b.dataset.preset];
  if (!p) return;
  $("ai-endpoint").value = p.endpoint;
  $("ai-model").value = p.model;
  localStorage.setItem("nextforge-ai-endpoint", p.endpoint);
  toast(`Preset: ${b.dataset.preset} — now paste your API key.`);
}));
$("jd-input").addEventListener("input", persistSoon);
$("company-input").addEventListener("input", persistSoon);

/* ---------------- init ---------------- */
(function init() {
  const savedKey = localStorage.getItem("nextforge-ai-key");
  if (savedKey) $("ai-key").placeholder = "key saved ✓ (enter a new one to replace)";
  const savedEp = localStorage.getItem("nextforge-ai-endpoint");
  if (savedEp) $("ai-endpoint").value = savedEp;
  const had = restore();
  renderDoc();
  updateScore();
  if (had) $("resume-status").textContent = "Restored your saved resume.";
/* test/debug hook (harmless in production) */
window.__nf = { state, analyzeJD, computeScore, parseResumeText, tailor, renderDoc, updateScore,
  aiRewriteSummary, aiRewriteBullets, aiOptimizeSkills, aiTailorAll };
})();
})();
