/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          0: "#000000",
          50: "#0A0A0A",
          100: "#0F0F10",
          200: "#141416",
          300: "#1A1A1C",
          400: "#262626",
          500: "#333333",
          600: "#4a4a4a",
        },
        accent: {
          green: "#3EF3A2",
          cyan: "#36D1DC",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      backgroundImage: {
        "accent-gradient":
          "linear-gradient(90deg, #3EF3A2 0%, #36D1DC 100%)",
        "accent-radial":
          "radial-gradient(circle at 50% 50%, rgba(62,243,162,0.18) 0%, rgba(54,209,220,0.06) 40%, transparent 70%)",
        "grid-dark":
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-32": "32px 32px",
        "grid-64": "64px 64px",
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter2: "-0.025em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(62,243,162,0.25), 0 0 30px -5px rgba(62,243,162,0.45)",
        "glow-soft":
          "0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px -20px rgba(62,243,162,0.25)",
      },
      animation: {
        "pulse-dot": "pulseDot 1.8s ease-in-out infinite",
        "scan-line": "scanLine 3s linear infinite",
        shimmer: "shimmer 2.4s linear infinite",
        float: "float 6s ease-in-out infinite",
        "gradient-pan": "gradientPan 8s ease infinite",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.35)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        gradientPan: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [],
};
