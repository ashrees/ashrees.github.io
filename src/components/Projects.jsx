import { motion } from "framer-motion";
import { PROJECTS } from "../constants/index";

const Projects = () => {
  return (
    <div className="border-b border-neutral-800 pb-24">
      <motion.h1
        whileInView={{ opacity: 1, y: 0 }}
        initial={{ y: -100, opacity: 0 }}
        transition={{ duration: 1 }}
        className="my-20 text-center text-4xl"
      >
        Projects
      </motion.h1>
      <div>
        {PROJECTS.map((project, index) => (
          <div key={index} className="mb-8 flex flex-wrap lg:justify-center">
            <motion.div
              whileInView={{ opacity: 1, x: 0 }}
              initial={{ x: -100, opacity: 0 }}
              transition={{ duration: 1 }}
              className="w-full lg:w-1/4"
            >
              <h6 className="mb-2 font text-neutral-100">
                {project.projectUrl ? (
                  <a
                    href={project.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-purple-400 transition-colors duration-200"
                  >
                    {project.title}
                  </a>
                ) : (
                  <p>{project.title}</p>
                )}
                {project.status === "In Progress" ? (
                  <span className="ml-2 text-sm text-yellow-500">
                    ({project.status})
                  </span>
                ) : (
                  <span className="ml-2 text-sm text-green-500">
                    ({project.status})
                  </span>
                )}
              </h6>
            </motion.div>
            <motion.div
              whileInView={{ opacity: 1, x: 0 }}
              initial={{ x: -100, opacity: 0 }}
              transition={{ duration: 1 }}
              className="w-full max-w-xl lg:w-3/4"
            >
              <p className="mb-4 text-neutral-400">{project.description}</p>
              {project.technologies.map((tech, index) => (
                <span
                  key={index}
                  className="mr-2 mt-4 mb-0.5 inline-block rounded bg-neutral-900 px-2 py-1 text-sm font-medium text-green-700"
                >
                  {tech}
                </span>
              ))}
            </motion.div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Projects;
