import { runWind } from "@wind/engine";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Packer } from "docx";
import { afterEach, describe, expect, it } from "vitest";
import { runBlock } from "../src/App";
import { Inputs } from "../src/components/Inputs";
import { Results } from "../src/components/Results";
import { facePoint, faceSegments } from "../src/components/Viewer";
import { DISCLAIMER } from "../src/disclaimer";
import { cloneProject, TEMPLATES, toWindInput, type Project } from "../src/project";
import { buildReport, reportBlocks } from "../src/report";
import { elevationSvg, envelopeSegments, pressureColour } from "../src/viz";

afterEach(cleanup);
const tpl = (id: string) => cloneProject(TEMPLATES.find((t) => t.id === id)!.project);

describe("templates", () => {
  it("all run and say where their values come from", () => {
    for (const t of TEMPLATES) {
      for (let i = 0; i < t.project.blocks.length; i++) expect(runBlock(t.project, i).ok, t.id).toBe(true);
      expect(t.note.length).toBeGreaterThan(20);
    }
  });
});

describe("Results", () => {
  it("shows the design summary per elevation with sources", () => {
    const p = tpl("town-tower");
    render(<Results result={runBlock(p, 0)} envelope="sealed" onEnvelope={() => {}} blockName="Tower" />);
    const rows = document.querySelectorAll(".summary tbody tr");
    expect(rows).toHaveLength(4);
    expect(screen.getAllByText(/Table NA\.4/).length).toBeGreaterThan(0);
    expect(screen.getByText(/ADV-DIGITISED/)).toBeTruthy();
  });
  it("lists input errors", () => {
    const p = tpl("town-tower");
    p.blocks[0]!.building.height = -1;
    render(<Results result={runBlock(p, 0)} envelope="sealed" onEnvelope={() => {}} blockName="Tower" />);
    expect(screen.getByRole("status").textContent).toContain("Inputs incomplete");
  });
});

describe("Inputs", () => {
  it("shows template cards and edits the per-direction table", () => {
    let project: Project = tpl("town-tower");
    const update = (fn: (d: Project) => void) => {
      const d = cloneProject(project);
      fn(d);
      project = d;
    };
    render(<Inputs project={project} blockIndex={0} onBlock={() => {}} update={update} onTemplate={() => {}} templateId="town-tower" />);
    const cards = screen.getByRole("group", { name: "Example projects" }).querySelectorAll("button");
    expect(cards).toHaveLength(TEMPLATES.length);
    expect([...cards].every((c) => c.querySelector("svg"))).toBe(true);
    fireEvent.change(screen.getByLabelText("North: Gap"), { target: { value: "12" } });
    expect(project.blocks[0]!.directions.N.gap).toBe(12);
    fireEvent.change(screen.getByLabelText("East: ce"), { target: { value: "3" } });
    expect(project.blocks[0]!.directions.E.overrides?.ce).toBe(3);
  });
});

describe("viewer geometry", () => {
  it("places each elevation's left end on the correct corner", () => {
    // Seen from outside, the North elevation's left end is its east corner.
    expect(facePoint("N", 0, 0, 10, 6)).toEqual([5, 0, -3]);
    expect(facePoint("S", 0, 0, 10, 6)).toEqual([-5, 0, 3]);
    expect(facePoint("E", 0, 0, 10, 6)).toEqual([5, 0, 3]);
    expect(facePoint("W", 0, 0, 10, 6)).toEqual([-5, 0, -3]);
  });
  it("builds envelope and zone segments that cover each elevation", () => {
    const p = tpl("low-rise");
    const r = runBlock(p, 0);
    if (!r.ok) throw new Error();
    const env = faceSegments(r, "envelope", "sealed", 15);
    for (const el of r.elevations) {
      const segs = env[el.face];
      expect(segs[0]!.from).toBe(0);
      expect(segs[segs.length - 1]!.to).toBeCloseTo(el.width, 9);
    }
    const zones = faceSegments(r, "N", "sealed", 15);
    expect(zones.N.map((s) => s.zone)).toEqual(["D"]);
    expect(zones.S.map((s) => s.zone)).toEqual(["E"]);
    expect(envelopeSegments(r.elevations[0]!, "sealed", 15)).toHaveLength(3);
  });
  it("colours suction red and pressure blue", () => {
    expect(pressureColour(-1, 1)).toBe("rgb(196, 46, 40)");
    expect(pressureColour(1, 1)).toBe("rgb(30, 96, 170)");
  });
  it("draws the elevation mark-up with design values", () => {
    const r = runWind(toWindInput(tpl("town-tower"), tpl("town-tower").blocks[0]!));
    if (!r.ok) throw new Error();
    const svg = elevationSvg(r.elevations[0]!, "sealed", 36, "Tower <A & B>");
    expect(svg).toContain("Ws = −");
    expect(svg).toContain("Tower &lt;A &amp; B>");
  });
});

describe("Word report", () => {
  it("builds a .docx with the summary, appendix and disclaimer", async () => {
    const p = tpl("low-rise");
    p.blocks.push({ ...structuredClone(p.blocks[0]!), id: "x", name: "Block C" });
    const doc = await buildReport(p, reportBlocks(p, runBlock), { disclaimer: DISCLAIMER });
    const buf = await Packer.toBuffer(doc);
    expect(buf.byteLength).toBeGreaterThan(5000);
    const { unzipSync, strFromU8 } = await import("fflate");
    const xml = strFromU8(unzipSync(new Uint8Array(buf))["word/document.xml"]!);
    expect(xml).toContain("Wind Load Calculation Report");
    expect(xml).toContain("Appendix A: Calculation details");
    expect(xml).toContain("Block C");
    expect(xml).toContain("NA Table NA.4");
    expect(xml).toContain("qualified engineer");
  });
});

describe("PDF report", () => {
  it("builds a PDF with the summary, appendix and disclaimer", async () => {
    const { buildPdfReport, pdfText } = await import("../src/pdf");
    const p = tpl("town-tower");
    const doc = await buildPdfReport(p, reportBlocks(p, runBlock), { disclaimer: DISCLAIMER, compress: false });
    const text = doc.output();
    expect(doc.getNumberOfPages()).toBeGreaterThan(3);
    for (const t of ["Wind Load Calculation Report", "Appendix A: Calculation details", "NA Table NA.4", "qualified engineer", "Funnelling check"]) expect(text).toContain(t);
    expect(pdfText("−0.80 kPa, θ ≤ 45°")).toBe("-0.80 kPa, theta <= 45°");
  });
});
