/**
 * Extra per-area data the areas content schema does not carry (build time only).
 * Slugs match site.areasServed and src/content/areas/*.md.
 */

export interface AreaMeta {
  slug: string;
  /** One-line note for the /areas/ index (<= 120 chars). */
  note: string;
  tag?: string;
  /** Route slugs most relevant to people in this area (shown first). */
  routes: string[];
}

export const AREA_META: AreaMeta[] = [
  {
    slug: "lahore-cantt",
    note: "Our head office. Saddar, Cavalry Ground, Walton, Fortress and the airport are all on our doorstep.",
    tag: "Head office",
    routes: ["lahore-to-islamabad", "lahore-to-wagah-border", "lahore-to-murree", "lahore-to-sialkot"],
  },
  {
    slug: "dha-lahore",
    note: "Every phase from 1 to 13, Rahbar and EME included. Y Block, Phase 5 CCA, Phase 6 and Raya pickups.",
    routes: ["lahore-to-islamabad", "lahore-to-murree", "lahore-to-wagah-border", "lahore-to-hunza"],
  },
  {
    slug: "gulberg",
    note: "MM Alam Road, Liberty Market and the offices on Main Boulevard. A driver beats the parking hunt.",
    routes: ["lahore-to-islamabad", "lahore-to-faisalabad", "lahore-to-sialkot", "lahore-to-murree"],
  },
  {
    slug: "johar-town",
    note: "Emporium Mall, Expo Centre and Shaukat Khanum, with Thokar Niaz Baig and the motorways close by.",
    routes: ["lahore-to-multan", "lahore-to-faisalabad", "lahore-to-islamabad", "lahore-to-naran-kaghan"],
  },
  {
    slug: "model-town",
    note: "Quiet blocks around Model Town Park, right off Ferozepur Road and Link Road.",
    routes: ["lahore-to-kartarpur-nankana-sahib", "lahore-to-islamabad", "lahore-to-multan", "lahore-to-faisalabad"],
  },
  {
    slug: "bahria-town-lahore",
    note: "The Grand Jamia Mosque, the Eiffel Tower replica and every sector, out on the south-west edge.",
    routes: ["lahore-to-multan", "lahore-to-faisalabad", "lahore-to-islamabad", "lahore-to-kartarpur-nankana-sahib"],
  },
  {
    slug: "askari",
    note: "Gated Askari sectors on the Cantt side, with Askari 10 a few minutes from the airport.",
    routes: ["lahore-to-wagah-border", "lahore-to-islamabad", "lahore-to-sialkot", "lahore-to-skardu"],
  },
  {
    slug: "wapda-town",
    note: "Wapda Town, Valencia and the roundabout markets, a short run from Thokar Niaz Baig.",
    routes: ["lahore-to-multan", "lahore-to-islamabad", "lahore-to-faisalabad", "lahore-to-swat"],
  },
];

export function areaMeta(slug: string): AreaMeta {
  const meta = AREA_META.find((a) => a.slug === slug);
  if (!meta) throw new Error(`[areas] No AREA_META entry for "${slug}" (src/components/local/area-meta.ts).`);
  return meta;
}
