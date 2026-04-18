import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18181b",
        moss: "#4f6f52",
        coral: "#d35f4b",
        skywash: "#d9edf7"
      }
    }
  },
  plugins: []
};

export default config;

