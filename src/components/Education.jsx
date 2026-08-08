import Section from "./Section";
import { EDUCATIONS } from "../constants/index";

const Education = () => {
  return (
    <Section id="education" title="Education">
      <div>
        {EDUCATIONS.map((edu) => (
          <div
            key={edu.school}
            className="border-b border-neutral-200 py-6 first:border-t dark:border-neutral-800"
          >
            <p className="text-xs uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
              {edu.year}
            </p>
            <h3 className="mt-2 font-medium text-neutral-900 dark:text-neutral-100">
              {edu.education} · {edu.school}
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {edu.description}
            </p>
            <p className="mt-3 text-xs tracking-wide text-neutral-500 dark:text-neutral-500">
              {edu.technologies.join(" · ")}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
};

export default Education;
