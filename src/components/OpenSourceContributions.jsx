import Section from "./Section";
import { OPEN_SOURCE_CONTRIBUTIONS } from "../constants";

const OpenSourceContributions = () => {
  return (
    <Section id="open-source" title="🔐 Open Source Contributions">
      <div>
        {OPEN_SOURCE_CONTRIBUTIONS.map((item) => (
          <div
            key={item.project}
            className="grid gap-2 border-b border-neutral-200 py-6 first:border-t md:grid-cols-[1.15fr_2fr_auto] md:gap-6 dark:border-neutral-800"
          >
            <a
              href={item.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-neutral-900 transition-colors hover:text-neutral-500 dark:text-neutral-100 dark:hover:text-neutral-400"
            >
              {item.project}
            </a>
            <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {item.contribution}
            </p>
            <p className="text-xs uppercase tracking-widest text-neutral-500 md:text-right dark:text-neutral-400">
              {item.type}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
};

export default OpenSourceContributions;
