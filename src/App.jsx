import Navbar from "./components/Navbar";
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
    <div className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-neutral-900">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6">
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
