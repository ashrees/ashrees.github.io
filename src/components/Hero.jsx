import { HERO_CONTENT, CONTACT } from "../constants/index";
import profilePic from "../assets/myImg.jpg";
import { motion } from "framer-motion";
import { FiDownload } from "react-icons/fi";

const fadeUp = (delay) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: "easeOut" },
});

const Hero = () => {
  return (
    <section id="top" className="pb-20 pt-32 md:pt-40">
      <motion.img
        {...fadeUp(0)}
        src={profilePic}
        alt="Ashish Shrees"
        className="h-16 w-16 rounded-full object-cover grayscale transition duration-500 hover:grayscale-0"
      />
      <motion.p
        {...fadeUp(0.1)}
        className="mt-8 text-sm font-medium uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400"
      >
        Software Developer
      </motion.p>
      <motion.h1
        {...fadeUp(0.2)}
        className="mt-3 text-5xl font-semibold tracking-tight text-neutral-900 md:text-7xl dark:text-neutral-50"
      >
        Ashish Shrees
      </motion.h1>
      <motion.p
        {...fadeUp(0.3)}
        className="mt-6 max-w-xl leading-relaxed text-neutral-500 dark:text-neutral-400"
      >
        {HERO_CONTENT}
      </motion.p>
      <motion.div
        {...fadeUp(0.4)}
        className="mt-10 flex flex-wrap items-center gap-4"
      >
        <a
          href={`mailto:${CONTACT.email}`}
          className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Get in touch
        </a>
        <a
          href="/resume.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-400"
        >
          Resume <FiDownload />
        </a>
      </motion.div>
      <motion.p
        {...fadeUp(0.5)}
        className="mt-8 flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
        </span>
        Open to opportunities · Anywhere in Canada
      </motion.p>
    </section>
  );
};

export default Hero;
