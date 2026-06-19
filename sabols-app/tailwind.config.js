/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#0ea5e9", // Sky 500
        secondary: "#38bdf8", // Sky 400
        background: "#f8fafc", // Slate 50
        card: "#ffffff",
        text: "#0f172a", // Slate 900
        muted: "#64748b", // Slate 500
      },
    },
  },
  plugins: [],
};
