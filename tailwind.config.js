/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /**
         * Body-copy ink for the LIGHT theme — the running text in the hero, the
         * About paragraph, and every project, contribution, role and course
         * description.
         *
         * A named token rather than an arbitrary value so the six paragraphs
         * that use it stay in step: change it here and they all follow.
         *
         * Deliberately NOT an override of Tailwind's `neutral-950`, even though
         * that is the step this hex belongs to on a neutral ramp. `neutral-950`
         * is the dark theme's page background, and moving it would repaint the
         * whole dark site as a side effect of a text colour change.
         */
        copy: "#131110",
      },
    },
  },
  plugins: [],
}
