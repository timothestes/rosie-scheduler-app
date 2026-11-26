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
        // Public site palette; values are set in app/(site)/site.css.
        rq: {
          paper: "rgb(var(--rq-paper) / <alpha-value>)",
          ink: "rgb(var(--rq-ink) / <alpha-value>)",
          muted: "rgb(var(--rq-muted) / <alpha-value>)",
          rule: "rgb(var(--rq-rule) / <alpha-value>)",
          accent: "rgb(var(--rq-accent) / <alpha-value>)",
          "on-accent": "rgb(var(--rq-on-accent) / <alpha-value>)",
          house: "rgb(var(--rq-house) / <alpha-value>)",
          "house-ink": "rgb(var(--rq-house-ink) / <alpha-value>)",
          "house-muted": "rgb(var(--rq-house-muted) / <alpha-value>)",
          "house-rule": "rgb(var(--rq-house-rule) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-archivo)", "Arial Narrow", "sans-serif"],
        body: ["var(--font-plex)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
