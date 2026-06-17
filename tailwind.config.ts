import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coral: "#FF6B6B",
        apricot: "#FFE4D6",
        cream: "#FFF9F5",
        ink: "#3D2F2F",
        muted: "#8A6F6A"
      },
      boxShadow: {
        soft: "0 8px 24px rgba(61, 47, 47, 0.10)",
        lift: "0 12px 32px rgba(61, 47, 47, 0.14)"
      },
      borderRadius: {
        card: "16px",
        pill: "24px"
      }
    }
  },
  plugins: []
};

export default config;
