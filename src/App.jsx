import Navbar from "./components/Navbar";
import DotField from "./components/DotField";
import Hero from "./components/Hero";
import About from "./components/About";
import Technologies from "./components/Technologies";
import Education from "./components/Education";
import Contact from "./components/Contact";
import Projects from "./components/Projects";
import Experience from "./components/Experience";
import OpenSourceContributions from "./components/OpenSourceContributions";

const App = () => {
  return (
    // No background here on purpose: the page colour lives on <body> so the
    // DotField canvas can sit above it and below the content.
    <div className="min-h-screen text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white dark:text-neutral-100 dark:selection:bg-white dark:selection:text-neutral-900">
      <DotField />
      <Navbar />
      <main className="relative z-10 mx-auto max-w-3xl px-5 sm:px-6">
        <Hero />
        <About />
        <Technologies />
        <Projects />
        <OpenSourceContributions />
        <Experience />
        <Education />
        <Contact />
      </main>
    </div>
  );
};

export default App;
