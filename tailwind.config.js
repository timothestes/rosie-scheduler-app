/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        btn: {
          background: "hsl(var(--btn-background))",
          "background-hover": "hsl(var(--btn-background-hover))",
        },
        // Public portfolio palette; values are set in app/(site)/site.css.
        rq: {
          paper: "rgb(var(--rq-paper) / <alpha-value>)",
          "paper-deep": "rgb(var(--rq-paper-deep) / <alpha-value>)",
          ink: "rgb(var(--rq-ink) / <alpha-value>)",
          muted: "rgb(var(--rq-muted) / <alpha-value>)",
          accent: "rgb(var(--rq-accent) / <alpha-value>)",
          "on-accent": "rgb(var(--rq-on-accent) / <alpha-value>)",
          clay: "rgb(var(--rq-clay) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-forum)", "Georgia", "serif"],
        body: ["var(--font-jost)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
