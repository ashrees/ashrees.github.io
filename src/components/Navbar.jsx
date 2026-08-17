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
      <nav className="mx-auto flex max-w-3xl items-center justify-between gap-8 px-6 py-4">
        <a
          href="#top"
          className="whitespace-nowrap text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
        >
          ashish shrees
        </a>
        <div className="flex items-center gap-5">
          <ul className="hidden items-center gap-5 whitespace-nowrap text-sm text-neutral-500 sm:flex dark:text-neutral-400">
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
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-400"
          >
            Resume
          </a>
          <div className="flex items-center gap-2 text-lg text-neutral-500 dark:text-neutral-400">
            <a
              href="https://github.com/ashrees"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="p-2 transition-colors hover:text-neutral-900 dark:hover:text-white"
            >
              <FaGithub />
            </a>
            <a
              href="https://www.linkedin.com/in/ashish-shrees-7aaa82261"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="p-2 transition-colors hover:text-neutral-900 dark:hover:text-white"
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
