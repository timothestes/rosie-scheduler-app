// Production photos, carried over from the Wix site. Order here is the order on /media.
// `featured` is the photo's position in the Home page selection (lower shows first).

export interface ProductionPhoto {
  src: string;
  width: number;
  height: number;
  /** Role and production, e.g. "Meg in Damn Yankees". Also used as alt text. */
  title: string;
  /** Director, company, photo credit: one per line. */
  credits: string[];
  featured?: number;
}

export const productionPhotos: ProductionPhoto[] = [
  {
    src: "/site/photos/hunchback-1.jpg",
    width: 1225,
    height: 817,
    title: "Esmeralda in The Hunchback of Notre Dame",
    credits: ["Directed by M. William Shiner", "The Western Stage Theatre", "Photo Credit: Richard Green"],
  },
  {
    src: "/site/photos/hunchback-2.jpg",
    width: 1225,
    height: 817,
    title: "Esmeralda in The Hunchback of Notre Dame",
    credits: ["Directed by M. William Shiner", "The Western Stage Theatre", "Photo Credit: Richard Green"],
    featured: 11,
  },
  {
    src: "/site/photos/hunchback-3.jpg",
    width: 1225,
    height: 817,
    title: "Esmeralda in The Hunchback of Notre Dame",
    credits: ["Directed by M. William Shiner", "The Western Stage Theatre", "Photo Credit: Richard Green"],
    featured: 6,
  },
  {
    src: "/site/photos/hunchback-4.jpg",
    width: 1225,
    height: 817,
    title: "Esmeralda in The Hunchback of Notre Dame",
    credits: ["Directed by M. William Shiner", "The Western Stage Theatre", "Photo Credit: Richard Green"],
    featured: 0,
  },
  {
    src: "/site/photos/river-bride-1.jpg",
    width: 1080,
    height: 720,
    title: "Belmira in The River Bride",
    credits: ["Directed by Marilet Martinez", "PCPA Pacific Conservatory Theatre", "Photo Credit: Luis Escobar"],
    featured: 8,
  },
  {
    src: "/site/photos/river-bride-2.jpg",
    width: 1080,
    height: 720,
    title: "Belmira in The River Bride",
    credits: ["Directed by Marilet Martinez", "PCPA Pacific Conservatory Theatre", "Photo Credit: Luis Escobar"],
    featured: 5,
  },
  {
    src: "/site/photos/river-bride-3.jpg",
    width: 1600,
    height: 1066,
    title: "Belmira in The River Bride",
    credits: ["Directed by Marilet Martinez", "PCPA Pacific Conservatory Theatre", "Photo Credit: Luis Escobar"],
  },
  {
    src: "/site/photos/damn-yankees-1.jpg",
    width: 1296,
    height: 1600,
    title: "Meg in Damn Yankees",
    credits: ["Directed by Damien Lorton", "The Gem Theatre", "Photo Credit: Ron Lyon"],
    featured: 4,
  },
  {
    src: "/site/photos/damn-yankees-2.jpg",
    width: 1600,
    height: 768,
    title: "Meg in Damn Yankees",
    credits: ["Directed by Damien Lorton", "The Gem Theatre", "Photo Credit: Ron Lyon"],
    featured: 12,
  },
  {
    src: "/site/photos/damn-yankees-3.jpg",
    width: 1496,
    height: 1600,
    title: "Meg in Damn Yankees",
    credits: ["Directed by Damien Lorton", "The Gem Theatre", "Photo Credit: Ron Lyon"],
    featured: 10,
  },
  {
    src: "/site/photos/damn-yankees-4.jpg",
    width: 1600,
    height: 1050,
    title: "Meg in Damn Yankees",
    credits: ["Directed by Damien Lorton", "The Gem Theatre", "Photo Credit: Ron Lyon"],
  },
  {
    src: "/site/photos/damn-yankees-5.jpg",
    width: 1600,
    height: 1067,
    title: "Meg in Damn Yankees",
    credits: ["Directed by Damien Lorton", "The Gem Theatre", "Photo Credit: Ron Lyon"],
    featured: 14,
  },
  {
    src: "/site/photos/henry-v-1.jpg",
    width: 1600,
    height: 1066,
    title: "Duke of Gloucester in Henry V",
    credits: ["Directed by Mark Booher", "PCPA Pacific Conservatory Theatre", "Photo Credit: Luis Escobar"],
    featured: 15,
  },
  {
    src: "/site/photos/henry-v-2.jpg",
    width: 1600,
    height: 1066,
    title: "Duke of Gloucester in Henry V",
    credits: ["Directed by Mark Booher", "PCPA Pacific Conservatory Theatre", "Photo Credit: Luis Escobar"],
    featured: 3,
  },
  {
    src: "/site/photos/emilia-1.jpg",
    width: 1226,
    height: 817,
    title: "Lady Katherine in Emilia",
    credits: ["Directed by Kristin Kusanovich & Rebecca Haley Clark", "The Western Stage Theatre", "Photo Credit: Richard Green"],
    featured: 1,
  },
  {
    src: "/site/photos/emilia-2.jpg",
    width: 1225,
    height: 817,
    title: "Lady Katherine/Stage Desdemona in Emilia",
    credits: ["Directed by Kristin Kusanovich & Rebecca Haley Clark", "The Western Stage Theatre", "Photo Credit: Richard Green"],
  },
  {
    src: "/site/photos/emilia-3.jpg",
    width: 1225,
    height: 817,
    title: "Lady Katherine in Emilia",
    credits: ["Directed by Kristin Kusanovich & Rebecca Haley Clark", "The Western Stage Theatre", "Photo Credit: Richard Green"],
  },
  {
    src: "/site/photos/john-proctor-1.jpg",
    width: 1066,
    height: 1600,
    title: "Bailey Gallagher in John Proctor is the Villain",
    credits: ["Directed by Andrew Philpot", "PCPA Pacific Conservatory Theatre", "Photo Credit: Kaitlin McNeil"],
    featured: 9,
  },
  {
    src: "/site/photos/john-proctor-2.jpg",
    width: 1066,
    height: 1600,
    title: "Bailey Gallagher in John Proctor is the Villain",
    credits: ["Directed by Andrew Philpot", "PCPA Pacific Conservatory Theatre", "Photo Credit: Kaitlin McNeil"],
  },
  {
    src: "/site/photos/john-proctor-3.jpg",
    width: 1066,
    height: 1600,
    title: "Bailey Gallagher in John Proctor is the Villain",
    credits: ["Directed by Andrew Philpot", "PCPA Pacific Conservatory Theatre", "Photo Credit: Kaitlin McNeil"],
  },
  {
    src: "/site/photos/oregon-gothic-1.jpg",
    width: 1080,
    height: 566,
    title: "Ensemble in Oregon Gothic by Octavio Solis - Workshop & Staged Reading with playwright",
    credits: ["Interplay Series", "PCPA Pacific Conservatory Theatre", "Directed by Lana Russell"],
    featured: 16,
  },
  {
    src: "/site/photos/elf-1.jpg",
    width: 1600,
    height: 1066,
    title: "Mrs. Claus in Elf The Musical",
    credits: ["Directed by Keenon Hooks", "PCPA Pacific Conservatory Theatre", "Photo Credit: Luis Escobar"],
    featured: 2,
  },
  {
    src: "/site/photos/elf-2.jpg",
    width: 1600,
    height: 1066,
    title: "Ensemble in Elf the Musical",
    credits: ["Directed by Keenon Hooks", "PCPA Pacific Conservatory Theatre", "Photo Credit: Luis Escobar"],
  },
  {
    src: "/site/photos/elf-3.jpg",
    width: 1600,
    height: 1066,
    title: "Ensemble in Elf the Musical",
    credits: ["Directed by Keenon Hooks", "PCPA Pacific Conservatory Theatre", "Photo Credit: Luis Escobar"],
    featured: 13,
  },
  {
    src: "/site/photos/newsies-1.jpg",
    width: 1600,
    height: 1199,
    title: "Music Director for Newsies performance",
    credits: ["Directed by Kristina Melsheimer", "Fun in the Sun Youth Camp"],
  },
  {
    src: "/site/photos/bright-star-1.jpg",
    width: 1279,
    height: 853,
    title: "Margo in Bright Star",
    credits: ["Directed by Megan O'Toole", "Landmark Theatre Company", "Photo Credit: Freedom Fotos"],
    featured: 7,
  },
  {
    src: "/site/photos/andrews-sisters-1.jpg",
    width: 1600,
    height: 1066,
    title: "\"Andrews Sisters\" appearance in MBI Student Recital",
    credits: ["Torrey Gray Auditorium, Chicago"],
    featured: 17,
  },
];

export const featuredPhotos = (limit: number): ProductionPhoto[] =>
  productionPhotos
    .filter((p) => p.featured !== undefined)
    .sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0))
    .slice(0, limit);

export const headshots = [
  { src: "/site/headshots/headshot-1.jpg", width: 1067, height: 1600 },
  { src: "/site/headshots/headshot-2.jpg", width: 1067, height: 1600 },
  { src: "/site/headshots/headshot-3.jpg", width: 1067, height: 1600 },
  { src: "/site/headshots/headshot-4.jpg", width: 1067, height: 1600 },
];
