# NextForge — Resume Builder

A client-side resume builder and ATS tailoring tool. Upload your resume, paste a job
description, and get a tailored, ATS-scored resume you can edit in the browser and export as PDF.

**Live site:** https://k1sh0r3.github.io/NextForge/

## How it works

- **Left panel:** upload a resume (PDF / DOCX / TXT, parsed in-browser with pdf.js + mammoth),
  or paste resume text, or load a sample. Enter the company + job description, then hit
  **“Update resume for this job.”**
- **Right panel:** your resume as a live document — **click any text to edit it**. Add/remove
  experience entries, bullets, education, and skills.
- **Tailoring:** the job description is analyzed for skills, phrases, and frequent keywords.
  Missing skills are added automatically; the rest appear as clickable chips.
- **ATS score:** 0–100 with a breakdown (keyword match, sections, contact info, quantified
  bullets, skills depth, length). Layouts are single-column and ATS-safe by design.
- **Export PDF:** prints only the resume with real selectable text (ATS-parseable), via the
  browser's *Save as PDF*.
- **Extras:** 3 templates, localStorage autosave, optional AI bullet rewriting (bring your own
  OpenAI-compatible API key — stored only in your browser).

## Project layout

```
index.html          two-pane app shell
assets/style.css    app styles + resume templates + print stylesheet
assets/app.js       parsing, JD analysis, ATS scoring, editor, PDF export
```

No build step, no backend. Everything runs in the browser.
