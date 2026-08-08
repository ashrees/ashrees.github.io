import Section from "./Section";
import { PROJECTS } from "../constants/index";
import { FiArrowUpRight } from "react-icons/fi";
import PropTypes from "prop-types";

const ProjectRow = ({ project, index }) => {
  const content = (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-medium text-neutral-900 transition-colors group-hover:text-neutral-500 dark:text-neutral-100 dark:group-hover:text-neutral-400">
          <span className="mr-3 text-sm text-neutral-400 dark:text-neutral-600">
            {String(index + 1).padStart(2, "0")}
          </span>
          {project.title}
        </h3>
        <span className="flex shrink-0 items-center gap-2 text-neutral-500 dark:text-neutral-400">
          {project.status === "In Progress" && (
            <span className="text-xs uppercase tracking-widest">
              In progress
            </span>
          )}
          {project.projectUrl && (
            <FiArrowUpRight className="text-lg transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          )}
        </span>
      </div>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
        {project.description}
      </p>
      <p className="mt-3 text-xs tracking-wide text-neutral-500 dark:text-neutral-500">
        {project.technologies.join(" · ")}
      </p>
    </>
  );

  const className =
    "group block border-b border-neutral-200 py-6 first:border-t dark:border-neutral-800";

  return project.projectUrl ? (
    <a
      href={project.projectUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
};

ProjectRow.propTypes = {
  project: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    technologies: PropTypes.arrayOf(PropTypes.string).isRequired,
    projectUrl: PropTypes.string,
    status: PropTypes.string,
  }).isRequired,
  index: PropTypes.number.isRequired,
};

const Projects = () => {
  return (
    <Section id="projects" title="Projects">
      <div>
        {PROJECTS.map((project, index) => (
          <ProjectRow key={project.title} project={project} index={index} />
        ))}
      </div>
    </Section>
  );
};

export default Projects;
