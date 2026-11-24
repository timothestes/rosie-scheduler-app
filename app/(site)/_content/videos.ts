// Performance videos. They are hosted on YouTube; only the poster images live in this repo.

export interface PerformanceVideo {
  youtubeId: string;
  title: string;
  writers: string;
  poster: string;
  featured?: number;
}

export const performanceVideos: PerformanceVideo[] = [
  {
    youtubeId: "JUG7wtoZ-os",
    title: "Spark of Creation",
    writers: "Stephen Schwartz",
    poster: "/site/videos/JUG7wtoZ-os.jpg",
    featured: 0,
  },
  {
    youtubeId: "E9VLwgktZMc",
    title: "So Far Away",
    writers: "Carole King",
    poster: "/site/videos/E9VLwgktZMc.jpg",
    featured: 1,
  },
  {
    youtubeId: "20GDs6o_sHY",
    title: "Always Better",
    writers: "Jason Robert Brown",
    poster: "/site/videos/20GDs6o_sHY.jpg",
  },
  {
    youtubeId: "dG2fuvSt304",
    title: "At Last",
    writers: "Steve Martin and Edie Brickell",
    poster: "/site/videos/dG2fuvSt304.jpg",
    featured: 4,
  },
  {
    youtubeId: "KwmosgB2Le8",
    title: "A Quiet Thing",
    writers: "Kander and Ebb",
    poster: "/site/videos/KwmosgB2Le8.jpg",
    featured: 6,
  },
  {
    youtubeId: "7J4IJOzzlGU",
    title: "Happy Days/Get Happy duet with Edella Oroz Westerfield",
    writers: "Harold Arlen and Ted Koehler, Milton Ager and Jack Yellen",
    poster: "/site/videos/7J4IJOzzlGU.jpg",
    featured: 2,
  },
  {
    youtubeId: "rAb_4A8ZgAs",
    title: "Wouldn't It Be Loverly",
    writers: "Lerner and Loewe",
    poster: "/site/videos/rAb_4A8ZgAs.jpg",
    featured: 3,
  },
  {
    youtubeId: "r0vOSu-rFX0",
    title: "People",
    writers: "Jule Styne and Bob Merrill",
    poster: "/site/videos/r0vOSu-rFX0.jpg",
    featured: 5,
  },
];

export const featuredVideos = (limit: number): PerformanceVideo[] =>
  performanceVideos
    .filter((x) => x.featured !== undefined)
    .sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0))
    .slice(0, limit);
