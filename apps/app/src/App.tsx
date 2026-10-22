import { runWind, type Envelope, type WindResult } from "@wind/engine";
import { useCallback, useMemo, useRef, useState } from "react";
import { Inputs } from "./components/Inputs";
import { Results } from "./components/Results";
import { Viewer } from "./components/Viewer";
import { DISCLAIMER } from "./disclaimer";
import { cloneProject, TEMPLATES, toWindInput, type Project } from "./project";
import { signed } from "./viz";

export { DISCLAIMER };

const STORE = "wind-loader:project";

export const runBlock = (p: Project, i: number): WindResult => runWind(toWindInput(p, p.blocks[i]!));

function loadSaved(): Project | null {
  try {
    const s = localStorage.getItem(STORE);
    if (!s) return null;
    const p = JSON.parse(s) as Project;
    return Array.isArray(p.blocks) && p.blocks.length ? p : null;
  } catch {
    return null;
  }
}

export function App() {
  const saved = useMemo(loadSaved, []);
  const [templateId, setTemplateId] = useState(saved ? "edited" : TEMPLATES[0]!.id);
  const [loadCount, setLoadCount] = useState(0);
  const [project, setProject] = useState<Project>(() => saved ?? cloneProject(TEMPLATES[0]!.project));
  const [blockIndex, setBlockIndex] = useState(0);
  const [envelope, setEnvelope] = useState<Envelope>("sealed");
  const bi = Math.min(blockIndex, project.blocks.length - 1);
  const block = project.blocks[bi]!;
  const result = useMemo(() => runBlock(project, bi), [project, bi]);
  const fileRef = useRef<HTMLInputElement>(null);

  const commit = (p: Project) => {
    setProject(p);
    try {
      localStorage.setItem(STORE, JSON.stringify(p));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  };

  const update = useCallback((fn: (draft: Project) => void) => {
    setProject((prev) => {
      const next = cloneProject(prev);
      fn(next);
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setTemplateId("edited");
  }, []);

  const loadTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    commit(cloneProject(t.project));
    setBlockIndex(0);
    setTemplateId(id);
    setLoadCount((n) => n + 1);
  };

  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportDocx = async () => {
    setExporting(true);
    setError(null);
    try {
      const { exportReport } = await import("./report");
      await exportReport(project, runBlock, DISCLAIMER);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const saveJson = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
    a.download = `${(project.meta.reference || "wind-loader").replace(/[^\w.-]+/g, "_")}.wind.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const openJson = async (f: File) => {
    try {
      const p = JSON.parse(await f.text()) as Project;
      if (!Array.isArray(p.blocks) || !p.blocks.length || !p.site) throw new Error("Not a Wind Loader project file.");
      commit(p);
      setBlockIndex(0);
      setTemplateId("edited");
      setLoadCount((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const allOk = project.blocks.every((_, i) => runBlock(project, i).ok);
  const quick = result.ok
    ? (() => {
        const els = result.elevations.map((e) => e.summary[envelope]);
        return `${signed(Math.max(...els.map((s) => s.wp.design)))} / ${signed(Math.min(...els.map((s) => s.wsA.design)))} kPa`;
      })()
    : `${result.errors.length} to fix`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <span>Wind Loader</span>
          <span className="tag">façade wind loads · release 1</span>
        </div>
        <div className="actions">
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Open
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && openJson(e.target.files[0])} />
          <button type="button" className="btn-ghost" onClick={saveJson}>
            Save
          </button>
          <button type="button" className="btn" onClick={exportDocx} disabled={!allOk || exporting} title={allOk ? "Word report for every block" : "Fix the inputs of every block first"}>
            {exporting ? "Preparing…" : "Word report"}
          </button>
        </div>
      </header>
      <p className="banner" role="note">
        Design aid only. Results must be checked by a qualified engineer.{error ? <strong className="err"> {error}</strong> : null}
      </p>
      <a className={`quick-verdict verdict-${result.ok ? "pass" : "incomplete"}`} href="#results" aria-hidden="true" tabIndex={-1}>
        {block.name}
        <span>{quick} · see results ↓</span>
      </a>
      <main className="layout">
        <aside className="col col-inputs">
          <h2>Inputs</h2>
          <Inputs key={loadCount} project={project} blockIndex={bi} onBlock={setBlockIndex} update={update} onTemplate={loadTemplate} templateId={templateId} />
        </aside>
        <div className="col col-view">
          <Viewer project={project} block={block} result={result} env={envelope} />
        </div>
        <aside className="col col-verify" id="results">
          <h2>Results</h2>
          <Results result={result} envelope={envelope} onEnvelope={setEnvelope} blockName={block.name} />
        </aside>
      </main>
      <footer className="footer">
        <p>{DISCLAIMER}</p>
      </footer>
    </div>
  );
}
