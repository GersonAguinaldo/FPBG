/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#348239",   // rgb(52,130,57)
          dark: "#2B6E31",      // ombre/hover
          light: "#3FA249",     // survol clair si besoin
        },
        navy: "#0E2233",
      },
      boxShadow: {
        'elev': '0 10px 30px rgba(0,0,0,.25)',
      }
    },
  },
  plugins: [],
};
