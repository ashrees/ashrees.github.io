import { EXPERIENCE } from "../constants";
import { motion } from "framer-motion";

const Experience = () => {
    return (
        <div className="border-b border-neutral-900 pd-20">
        <motion.h2
        whileInView={{opacity: 1, y: 0}}
        initial={{ y: -100, opacity: 0}}
        transition={{ duration: 0.5}}
        className="my-10 text-center text-4xl"
        >Experience</motion.h2>
        <div>
            {EXPERIENCE.map((experience, index) => (
                <div key={index} className="mb-8 flex flex-wrap lg:justify-center">
                    <motion.div
                    whileInView={{ opacity: 1, x: 0}}
                    initial={{x: -100, opacity: 0}}
                    transition={{ duration: 1}}
                    className="w-full lg:w-1/4"
                    >
                        <p className="mb-2 text-sm text-neutral-400">{experience.year}</p>
                    </motion.div>
                    <motion.div
                    whileInView={{ opacity: 1, x: 0 }}
                    initial={{ x: 100, opacity: 0}}
                    transition={{ duration: 1}}
                    className="w-full max-w-xl lg:w-3/4"
                    >
                        <h6 className="mb-6 font-semibold">
                            {experience.company ? (
                                <a
                                    href={experience.companyUrl}
                                    target="_blank"   
                                    rel="noopener noreferrer"
                                    className="hover:text-purple-400 transition-colors duration-200"
                                >
                                    {experience.company}
                                </a>
                            ) : (
                                <p>
                                    {experience.company}
                                </p>
                            )} -{" "}
                            <span className="text-sm text-purple-100">
                                {experience.role}
                            </span>
                        </h6>
                        <p className="mb-4 text-neutral-400">{experience.description}
                            {experience.companyUrl}
                        </p>
                    </motion.div>
                </div>
            ))}
        </div>
        </div>
    )
}

export default Experience;