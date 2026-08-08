import Section from "./Section";
import { ABOUT_TEXT } from "../constants/index";

const About = () => {
  return (
    <Section id="about" title="About">
      <p className="max-w-xl leading-relaxed text-neutral-500 dark:text-neutral-400">
        {ABOUT_TEXT}
      </p>
    </Section>
  );
};

export default About;
