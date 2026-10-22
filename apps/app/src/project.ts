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
    id: "town-tower",
    name: "Town tower",
    note: "Example values for a tower in town terrain with a neighbouring building close by, so funnelling applies. Replace every value with your site's data.",
    project: {
      meta: {
        project: "Example: town tower",
        reference: "WL-0001",
        client: "",
        preparedBy: "",
        date: today(),
        siteNotes: "Example values. Town terrain; no significant orography.",
      },
      site: { vbMap: 21.5, altitude: 30, terrain: "town", orientation: -20, cdirMethod: "orthogonal" },
      options: { funnelling: "conservative", designBasis: "custom" },
      blocks: [
        {
          id: "tower",
          name: "Tower",
          building: { widthNS: 30, widthEW: 45, height: 36 },
          directions: {
            N: { shorelineKm: 80, townKm: 2, have: 0, x: 20, gap: 25 },
            E: { shorelineKm: 60, townKm: 2, have: 0, x: 20, gap: 40 },
            S: { shorelineKm: 90, townKm: 2, have: 0, x: 20, gap: 25 },
            W: { shorelineKm: 100, townKm: 2, have: 0, x: 20, gap: 40 },
          },
        },
      ],
    },
  },
  {
    id: "low-rise",
    name: "Low-rise blocks",
    note: "Example values for a low-rise block among buildings of similar height in town terrain. Replace every value with your site's data.",
    project: {
      meta: {
        project: "Example: low-rise blocks",
        reference: "WL-0002",
        client: "",
        preparedBy: "",
        date: today(),
        siteNotes: "Example values. Town terrain; neighbouring buildings about 12 m high.",
      },
      site: { vbMap: 22.5, altitude: 25, terrain: "town", orientation: 15, cdirMethod: "orthogonal" },
      options: { funnelling: "conservative", designBasis: "custom" },
      blocks: [
        {
          id: "block-a",
          name: "Block A",
          building: { widthNS: 15, widthEW: 40, height: 15 },
          directions: {
            N: { shorelineKm: 30, townKm: 1.5, have: 12, x: 25, gap: 25 },
            E: { shorelineKm: 50, townKm: 1.5, have: 12, x: 60, gap: 6 },
            S: { shorelineKm: 40, townKm: 1.5, have: 12, x: 80, gap: 80 },
            W: { shorelineKm: 70, townKm: 1.5, have: 12, x: 12, gap: 12 },
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
