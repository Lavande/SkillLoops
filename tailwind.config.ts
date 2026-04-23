import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F4F1EA",
        ink: "#0B0B0B",
        grid: "#D9D4C7",
        accent: "#FF5B1F",
        muted: "#6B675E",
        "paper-raised": "#EDE8DB",
        "ink-soft": "#1A1A1A",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      fontSize: {
        "display-1": ["clamp(3rem, 6vw, 5rem)", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "display-2": ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
      },
      spacing: {
        baseline: "4px",
      },
      borderWidth: {
        "hair": "1px",
      },
      maxWidth: {
        frame: "1440px",
      },
    },
  },
  plugins: [],
};

export default config;
