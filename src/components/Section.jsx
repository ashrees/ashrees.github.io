import { motion } from "framer-motion";
import PropTypes from "prop-types";

const Section = ({ id, title, children }) => {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      // pushes the dot field aside so body copy stays readable
      data-dot-avoid="0.55"
      className="grid scroll-mt-24 gap-6 border-t border-neutral-200 py-14 sm:py-16 md:grid-cols-[140px_1fr] md:gap-10 dark:border-neutral-800"
    >
      <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500 md:pt-1 dark:text-neutral-400">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </motion.section>
  );
};

Section.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

export default Section;
