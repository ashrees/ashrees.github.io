import { useEffect, useState } from "react";
import { FaGithub, FaLinkedin } from "react-icons/fa";
import { FiMoon, FiSun } from "react-icons/fi";

const links = [
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
  { label: "Experience", href: "#open-source" },
  { label: "Contact", href: "#contact" },
];

const Navbar = () => {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200/70 bg-white/70 backdrop-blur-md dark:border-neutral-800/70 dark:bg-neutral-950/70">
      {/* Tight gaps and a shrinking icon set below sm: at 320px the old layout
          needed 369px of row and pushed the page sideways. */}
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-4 sm:gap-8 sm:px-6">
        <a
          href="#top"
          className="min-w-0 truncate text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
        >
          ashish shrees
        </a>
        <div className="flex shrink-0 items-center gap-2 sm:gap-5">
          <ul className="hidden items-center gap-5 whitespace-nowrap text-sm text-neutral-500 md:flex dark:text-neutral-400">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="transition-colors hover:text-neutral-900 dark:hover:text-white"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="/resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="glass-pill whitespace-nowrap px-3.5 py-1.5 text-xs font-medium sm:px-4 sm:text-sm"
          >
            Resume
          </a>
          <div className="flex items-center text-lg text-neutral-500 dark:text-neutral-400">
            {/* Social links also live in the hero and Contact section, so they
                are the first thing to go when the row runs out of room. */}
            <a
              href="https://github.com/ashrees"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="hidden p-2 transition-colors hover:text-neutral-900 sm:block dark:hover:text-white"
            >
              <FaGithub />
            </a>
            <a
              href="https://www.linkedin.com/in/ashish-shrees-7aaa82261"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="hidden p-2 transition-colors hover:text-neutral-900 sm:block dark:hover:text-white"
            >
              <FaLinkedin />
            </a>
            <button
              onClick={() => setDark(!dark)}
              aria-label="Toggle dark mode"
              className="cursor-pointer p-2 transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              {dark ? <FiSun /> : <FiMoon />}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
