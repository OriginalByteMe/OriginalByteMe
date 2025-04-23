import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        blob: {
          primary: "hsl(var(--blob-primary))",
          secondary: "hsl(var(--blob-secondary))",
          tertiary: "hsl(var(--blob-tertiary))",
        },
        gradient: {
          start: "hsl(var(--gradient-start))",
          end: "hsl(var(--gradient-end))",
        }
      },
      keyframes: {
        blob1: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "25%": { transform: "translate(100%, 80%) scale(1.2)" },
          "50%": { transform: "translate(50%, 120%) scale(0.8)" },
          "75%": { transform: "translate(120%, 50%) scale(1.1)" },
        },
        blob2: {
          "0%, 100%": { transform: "translate(0, 0) scale(1.2)" },
          "25%": { transform: "translate(-120%, -80%) scale(0.9)" },
          "50%": { transform: "translate(-80%, 100%) scale(1.1)" },
          "75%": { transform: "translate(-100%, -50%) scale(0.8)" },
        },
        blob3: {
          "0%, 100%": { transform: "translate(0, 0) scale(0.8)" },
          "25%": { transform: "translate(80%, -120%) scale(1.1)" },
          "50%": { transform: "translate(-100%, -80%) scale(0.9)" },
          "75%": { transform: "translate(120%, -100%) scale(1.2)" },
        },
        blob4: {
          "0%, 100%": { transform: "translate(0, 0) scale(1.1)" },
          "25%": { transform: "translate(-60%, 100%) scale(0.8)" },
          "50%": { transform: "translate(100%, 60%) scale(1.2)" },
          "75%": { transform: "translate(-80%, -60%) scale(0.9)" },
        },
        blob5: {
          "0%, 100%": { transform: "translate(0, 0) scale(0.9)" },
          "25%": { transform: "translate(70%, -70%) scale(1.1)" },
          "50%": { transform: "translate(-50%, 100%) scale(0.8)" },
          "75%": { transform: "translate(90%, 80%) scale(1.2)" },
        },
        blob6: {
          "0%, 100%": { transform: "translate(0, 0) scale(1.2)" },
          "25%": { transform: "translate(-120%, -80%) scale(0.9)" },
          "50%": { transform: "translate(-80%, 100%) scale(1.1)" },
          "75%": { transform: "translate(-100%, -50%) scale(0.8)" },
        },
        blob7: {
          "0%, 100%": { transform: "translate(0, 0) scale(0.8)" },
          "25%": { transform: "translate(80%, -120%) scale(1.1)" },
          "50%": { transform: "translate(-100%, -80%) scale(0.9)" },
          "75%": { transform: "translate(120%, -100%) scale(1.2)" },
        },
        blob8: {
          "0%, 100%": { transform: "translate(0, 0) scale(1.1)" },
          "25%": { transform: "translate(-60%, 100%) scale(0.8)" },
          "50%": { transform: "translate(100%, 60%) scale(1.2)" },
          "75%": { transform: "translate(-80%, -60%) scale(0.9)" },
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
