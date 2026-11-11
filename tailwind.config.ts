import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#FAFAF9",
          dark: "#15161A",
        },
        ink: {
          DEFAULT: "#1C1D21",
          soft: "#53565F",
          dark: "#E7E7EA",
        },
        ai: {
          50: "#EEF2F8",
          100: "#D7E0EE",
          300: "#7E97BD",
          500: "#3C5A8A",
          600: "#2B4570",
          700: "#1F3353",
        },
        vermilion: {
          DEFAULT: "#C1502E",
          soft: "#E2A28C",
        },
        line: {
          DEFAULT: "#E3E2DD",
          dark: "#2A2B30",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        jp: ["var(--font-noto-jp)", "sans-serif"],
        display: ["var(--font-serif-jp)", "serif"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
export default config;
