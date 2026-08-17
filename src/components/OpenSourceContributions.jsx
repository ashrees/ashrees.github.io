import Section from "./Section";
import { OPEN_SOURCE_CONTRIBUTIONS } from "../constants";
import { FiArrowUpRight } from "react-icons/fi";

const OpenSourceContributions = () => {
  return (
    <Section id="open-source" title="Open Source">
      <div>
        {OPEN_SOURCE_CONTRIBUTIONS.map((item) => (
          <a
            key={item.project}
            href={item.projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border-b border-neutral-200 py-6 first:border-t dark:border-neutral-800"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="font-medium text-neutral-900 transition-colors group-hover:text-neutral-500 dark:text-neutral-100 dark:group-hover:text-neutral-400">
                {item.project}
              </h3>
              <span className="flex shrink-0 items-center gap-2 text-neutral-500 dark:text-neutral-400">
                <span className="text-xs uppercase tracking-widest">
                  {item.type}
                </span>
                <FiArrowUpRight className="text-lg transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {item.contribution}
            </p>
          </a>
        ))}
      </div>
    </Section>
  );
};

export default OpenSourceContributions;
