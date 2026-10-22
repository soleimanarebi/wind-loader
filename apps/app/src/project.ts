import type { BuildingInput, DirectionInput, Face, Options, SiteInput, WindInput } from "@wind/engine";

/** One building or block on the site. */
export interface Block {
  id: string;
  name: string;
  building: BuildingInput;
  directions: Record<Face, DirectionInput>;
}

export interface ProjectMeta {
  project: string;
  reference: string;
  client: string;
  preparedBy: string;
  date: string;
  /** Free text: location, terrain description, sources of map readings. */
  siteNotes: string;
}

export interface Project {
  meta: ProjectMeta;
  site: SiteInput;
  options: Options;
  blocks: Block[];
}

export interface Template {
  id: string;
  name: string;
  /** Where the values come from. */
  note: string;
  project: Project;
}

export const cloneProject = (p: Project): Project => structuredClone(p);

export function toWindInput(p: Project, block: Block): WindInput {
  return { site: p.site, building: block.building, directions: block.directions, options: p.options };
}

let seq = 0;
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export function blankBlock(name: string, like?: Block): Block {
  if (like) return { ...structuredClone(like), id: newId(), name };
  const dir = (): DirectionInput => ({ shorelineKm: 50, townKm: 1, have: 0, x: 0 });
  return {
    id: newId(),
    name,
    building: { widthNS: 20, widthEW: 20, height: 20 },
    directions: { N: dir(), E: dir(), S: dir(), W: dir() },
  };
}

const today = () => new Date().toISOString().slice(0, 10);

export const TEMPLATES: Template[] = [
  {
    id: "brent-cross",
    name: "Town tower",
    note: "Example values from the Brent Cross Town Plot 202 loads report (§2.2–2.3): vb,map 21.6 m/s, A = 48 m, 28 m high, 55 × 60 m, rotated −41°, funnelling gaps 27.5–28 m.",
    project: {
      meta: {
        project: "Example: town tower",
        reference: "WL-0001",
        client: "",
        preparedBy: "",
        date: today(),
        siteNotes: "Example values. Town terrain at the edge of the urban area; no significant orography.",
      },
      site: { vbMap: 21.6, altitude: 48, terrain: "town", orientation: -41, cdirMethod: "orthogonal" },
      options: { funnelling: "conservative", designBasis: "custom" },
      blocks: [
        {
          id: "bx",
          name: "Cores E & F",
          building: { widthNS: 55, widthEW: 60, height: 28 },
          directions: {
            N: { shorelineKm: 100, townKm: 0.1, have: 0, x: 20, gap: 28 },
            E: { shorelineKm: 60, townKm: 0.1, have: 0, x: 20, gap: 27.5 },
            S: { shorelineKm: 100, townKm: 0.1, have: 0, x: 20, gap: 28 },
            W: { shorelineKm: 100, townKm: 0.1, have: 0, x: 20, gap: 27.5 },
          },
        },
      ],
    },
  },
  {
    id: "isca",
    name: "Low-rise blocks",
    note: "Example values from the ISCA Place spreadsheet (Block A): vb,map 23.5 m/s, A = 43 m, 17.66 m high, orientation −10°, neighbours 17 m high. Distances inside town are example values (not in the source).",
    project: {
      meta: {
        project: "Example: low-rise residential blocks",
        reference: "WL-0002",
        client: "",
        preparedBy: "",
        date: today(),
        siteNotes: "Example values. Town terrain (category III); shoreline distances N 55, E 43, S 25, W 80 km.",
      },
      site: { vbMap: 23.5, altitude: 43, terrain: "town", orientation: -10, cdirMethod: "orthogonal" },
      options: { funnelling: "conservative", designBasis: "custom" },
      blocks: [
        {
          id: "isca-a",
          name: "Block A",
          building: { widthNS: 16.8, widthEW: 44.8, height: 17.66 },
          directions: {
            N: { shorelineKm: 55, townKm: 3, have: 17, x: 27.1, gap: 27.1 },
            E: { shorelineKm: 43, townKm: 3, have: 17, x: 104, gap: 4.8 },
            S: { shorelineKm: 25, townKm: 3, have: 17, x: 122, gap: 122 },
            W: { shorelineKm: 80, townKm: 3, have: 17, x: 11.2, gap: 11.2 },
          },
        },
      ],
    },
  },
  {
    id: "country-house",
    name: "Open country",
    note: "Example values for a building in country terrain 20 km from the coast. Replace every value with your site's data.",
    project: {
      meta: {
        project: "Example: building in open country",
        reference: "WL-0003",
        client: "",
        preparedBy: "",
        date: today(),
        siteNotes: "Example values. Country terrain; no significant orography.",
      },
      site: { vbMap: 22, altitude: 60, terrain: "country", orientation: 0, cdirMethod: "orthogonal" },
      options: { funnelling: "conservative", designBasis: "custom" },
      blocks: [
        {
          id: "cty",
          name: "Main building",
          building: { widthNS: 30, widthEW: 12, height: 9 },
          directions: {
            N: { shorelineKm: 40, have: 0, x: 0 },
            E: { shorelineKm: 60, have: 0, x: 0 },
            S: { shorelineKm: 20, have: 0, x: 0 },
            W: { shorelineKm: 30, have: 0, x: 0 },
          },
        },
      ],
    },
  },
];
