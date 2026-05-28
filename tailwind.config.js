/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coal: "#101713",
        pine: "#3f0b0b",
        moss: "#ef4444",
        ember: "#dc2626",
        brass: "#ff3b21",
        mist: "#edf1ea",
        parchment: "#f4efe4",
        ink: "#18211b"
      },
      boxShadow: {
        panel: "0 18px 50px rgba(16, 23, 19, 0.14)"
      }
    }
  },
  plugins: []
};
