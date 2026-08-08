import Section from "./Section";
import { EXPERIENCE } from "../constants/index";

const Experience = () => {
  return (
    <Section id="experience" title="Experience">
      <div>
        {EXPERIENCE.map((exp) => (
          <div
            key={exp.role + exp.company}
            className="border-b border-neutral-200 py-6 first:border-t dark:border-neutral-800"
          >
            <p className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              {exp.year}
            </p>
            <h3 className="mt-2 font-medium text-neutral-900 dark:text-neutral-100">
              {exp.role} ·{" "}
              <a
                href={exp.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-900 dark:decoration-neutral-600 dark:hover:decoration-neutral-300"
              >
                {exp.company}
              </a>
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {exp.description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
};

export default Experience;
