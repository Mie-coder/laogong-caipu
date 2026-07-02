import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#fff9f5",
        surface: "#ffffff",
        ink: "#2e2725",
        text: "#3d3633",
        muted: "#6f6865",
        subtle: "#9a928e",
        line: "#e9e3df",
        accent: "#ff6b6b",
        "accent-soft": "#fff0ed",
        overlay: "rgba(24, 20, 18, 0.52)",
        disabled: "#c9c2be"
      },
      boxShadow: {
        sheet: "0 -8px 30px rgba(46, 39, 37, 0.10)"
      },
      borderRadius: {
        input: "8px",
        sheet: "8px",
        thumb: "6px"
      },
      fontFamily: {
        sans: ["PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
