import Section from "./Section";
import { CONTACT } from "../constants/index";
import { FaGithub, FaLinkedin } from "react-icons/fa";

const Contact = () => {
  return (
    <>
      <Section id="contact" title="Contact">
        <h3 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-50">
          Let&apos;s build something together.
        </h3>
        <p className="mt-4 max-w-xl leading-relaxed text-neutral-500 dark:text-neutral-400">
          I&apos;m open to full-time software development roles anywhere in
          Canada, as well as collaborations and freelance projects.
        </p>
        <div className="mt-8 flex flex-col gap-3 text-sm">
          <a
            href={`mailto:${CONTACT.email}`}
            className="w-fit font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-900 dark:text-neutral-100 dark:decoration-neutral-600 dark:hover:decoration-neutral-300"
          >
            {CONTACT.email}
          </a>
          <a
            href={`tel:${CONTACT.phoneNo}`}
            className="w-fit text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          >
            {CONTACT.phoneNo}
          </a>
        </div>
        <div className="mt-8 flex items-center gap-4 text-xl text-neutral-500 dark:text-neutral-400">
          <a
            href="https://github.com/ashrees"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="transition-colors hover:text-neutral-900 dark:hover:text-white"
          >
            <FaGithub />
          </a>
          <a
            href="https://www.linkedin.com/in/ashish-shrees-7aaa82261"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="transition-colors hover:text-neutral-900 dark:hover:text-white"
          >
            <FaLinkedin />
          </a>
        </div>
      </Section>
      <footer className="border-t border-neutral-200 py-8 text-center text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-500">
        © {new Date().getFullYear()} Ashish Shrees. Built with React &
        Tailwind CSS.
      </footer>
    </>
  );
};

export default Contact;
