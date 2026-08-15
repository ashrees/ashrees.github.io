import Section from "./Section";

const SKILL_CATEGORIES = [
  {
    name: "Languages",
    skills: [
      "JavaScript",
      "TypeScript",
      "Java",
      "Python",
      "C++",
      "SQL",
      "HTML/CSS",
    ],
  },
  {
    name: "Backend",
    skills: [
      "Node.js",
      "Express.js",
      "Spring Boot",
      "RESTful APIs",
      "Microservices",
      "Event-Driven Architecture",
      "Apache Kafka",
      "JWT",
    ],
  },
  {
    name: "Frontend",
    skills: ["React", "Next.js", "Tailwind CSS", "Bootstrap", "Responsive Design"],
  },
  {
    name: "Databases",
    skills: ["PostgreSQL", "MongoDB", "Oracle SQL"],
  },
  {
    name: "DevOps & SDLC",
    skills: [
      "Git",
      "Docker",
      "Kubernetes",
      "Terraform",
      "CI/CD",
      "Jenkins",
      "GitHub Actions",
      "Linux",
      "Prometheus & Grafana",
      "Agile/Scrum",
      "Postman",
      "Unit Testing",
    ],
  },
  {
    name: "AI/ML",
    skills: [
      "LLM API Integration",
      "RAG",
      "AI Agents",
      "Prompt Engineering",
      "Ollama",
    ],
  },
];

const Technologies = () => {
  return (
    <Section id="technologies" title="Technologies">
      <div className="flex flex-col gap-6">
        {SKILL_CATEGORIES.map((category) => (
          <div key={category.name}>
            <h3 className="text-xs font-medium uppercase tracking-widest text-neutral-500 dark:text-neutral-500">
              {category.name}
            </h3>
            <ul className="mt-3 flex max-w-xl flex-wrap gap-2">
              {category.skills.map((skill) => (
                <li
                  key={skill}
                  className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-sm text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-400 dark:hover:text-white"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
};

export default Technologies;
