/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        coal: "#101713",
        pine: "#173527",
        moss: "#6f8e4f",
        ember: "#c96f3a",
        brass: "#c9a24f",
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
