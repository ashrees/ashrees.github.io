export const HERO_CONTENT = `I'm a software developer and Computer Programming graduate from Seneca Polytechnic, building web applications and RESTful APIs across the full stack — React, TypeScript, Node.js, Python, and SQL. I contribute to open source, with merged PRs in NVIDIA NemoClaw and a fix landed in Node.js core. Lately I've been deep in LLM integration, RAG, and multi-agent systems.`;

export const ABOUT_TEXT = `I care about building software that actually ships. At Hallow Tech, I worked on production web applications supporting hundreds of active users — designing RESTful APIs, cutting QA bug reports and rework by ~20%, and resolving 10–15 issues per sprint in an Agile/Scrum team. Since then, I've launched my own products end-to-end: an e-commerce platform with Stripe payments, and an event-driven multi-agent system built on local and cloud LLMs. I've completed my Computer Programming diploma at Seneca Polytechnic and I'm looking for my next full-time role, anywhere in Canada. Outside of product work, I contribute to open source — two merged PRs in NVIDIA NemoClaw, a documentation fix landed in Node.js core, and active patches in review at Chromium DevTools, MUI, and nodejs.org.`;

export const PROJECTS = [
  {
    title: "ApexWire",
    description:
      "An event-driven cross-border payment and sanctions screening system. Three Spring Boot microservices communicate asynchronously over Apache Kafka — ingesting payments, screening parties against a sanctions list, and settling ledger transactions atomically in PostgreSQL with automatic reversal on failure. Ships with Docker, Kubernetes manifests, Terraform for AWS (EKS/RDS), Prometheus/Grafana observability, and a Testcontainers + Selenium E2E suite.",
    image: "",
    technologies: [
      "Java",
      "Spring Boot",
      "Apache Kafka",
      "PostgreSQL",
      "Kubernetes",
      "Terraform",
    ],
    projectUrl: "https://github.com/ashrees/apex-wire",
    status: "Completed",
  },
  {
    title: "AI-Native Organization OS",
    description:
      "An event-driven multi-agent framework integrating local Ollama deployments and cloud LLM APIs (DeepSeek, Gemini) to run autonomous task-planning loops, real-time RAG diagnostics, and serialized queue orchestration.",
    image: "",
    technologies: ["Python", "Ollama", "LLM APIs", "RAG"],
    projectUrl: "https://github.com/ashrees/AI-Native-Organization-System",
    status: "In Progress",
  },
  {
    title: "Barahi Shop & Manager",
    description:
      "A full-stack e-commerce platform with product browsing, cart, and checkout via Stripe, maintaining 94% uptime. Ships with a companion admin panel for inventory and order management with role-based access control.",
    image: "",
    technologies: ["Node.js", "Express.js", "MongoDB", "Stripe"],
    projectUrl: "https://www.barahishop.com/",
    status: "Completed",
  },
  {
    title: "Kirkire Pomodoro Timer",
    description:
      "A productivity timer built around the Pomodoro technique, featuring an integrated AI chat assistant for task guidance and focus coaching, with customizable work and break intervals.",
    image: "",
    technologies: ["React", "TypeScript", "LLM API Integration"],
    projectUrl: "https://pomodoro-timer-xi-nine.vercel.app/",
    status: "Completed",
  },
  {
    title: "Task Planner",
    description:
      "A task management app for creating, categorizing, and tracking tasks, with deadline reminders and productivity analytics to keep users on schedule.",
    image: "",
    technologies: ["JavaScript", "Node.js", "PostgreSQL"],
    projectUrl: "https://task-planner-ashrees-projects.vercel.app/",
    status: "Completed",
  },
  {
    title: "Multimedia Management System",
    description:
      "A C++17 application for managing books, movies, and TV shows, built on polymorphism, STL containers, dynamic memory safety, and exception handling.",
    image: "",
    technologies: ["C++17", "STL", "OOP"],
    projectUrl: "",
    status: "Completed",
  },
];

export const OPEN_SOURCE_CONTRIBUTIONS = [
  {
    project: "NVIDIA/NemoClaw — validation docs",
    projectUrl: "https://github.com/NVIDIA/NemoClaw/pull/9183",
    contribution:
      "Documented Gemini model-validation behavior & error handling grounded in implementation source (merged).",
    type: "Docs",
  },
  {
    project: "NVIDIA/NemoClaw — inference tests",
    projectUrl: "https://github.com/NVIDIA/NemoClaw/pull/9281",
    contribution:
      "Added regression tests locking exact model-validation messages for Anthropic & NVIDIA endpoint paths (merged).",
    type: "Tests",
  },
  {
    project: "Chromium DevTools",
    projectUrl:
      "https://chromium-review.googlesource.com/c/devtools/devtools-frontend/+/8263748",
    contribution:
      "Added unit test coverage for the TypeScriptUtilities assert helpers used across the DevTools front-end (Gerrit CL, in review).",
    type: "Tests",
  },
  {
    project: "mui/material-ui",
    projectUrl: "https://github.com/mui/material-ui/pull/48968",
    contribution:
      "Fixed screen-reader row count in the collapsible table demo (in review).",
    type: "Accessibility",
  },
  {
    project: "arichornlover/uYouEnhanced",
    projectUrl: "https://github.com/arichornlover/uYouEnhanced/pull/985",
    contribution: "Authored a README FAQ covering the most re-filed issues (in review).",
    type: "Docs",
  },
  {
    project: "nodejs/node",
    projectUrl: "https://github.com/nodejs/node/issues/65280",
    contribution:
      "Traced a 15-year-old documentation gap in fs.lchmod to its 2011 changelog origin; the diagnosis was adopted and the fix landed in Node.js core via #65283.",
    type: "Research",
  },
];

export const EXPERIENCE = [
  {
    year: "Sep 2021 - Oct 2022",
    role: "Junior Software Developer",
    company: "Hallow Tech Pvt. Ltd.",
    companyUrl: "https://hallow-tech.com/",
    description: `Contributed to full-stack development of production web applications (Node.js, MongoDB, JavaScript) supporting hundreds of active users. Designed and implemented RESTful API endpoints and frontend components in an Agile/Scrum team, reducing bug reports and QA rework by ~20%. Resolved 10–15 issues per sprint and authored API documentation and onboarding guides that improved knowledge transfer across the team.`,
  }
]
export const EDUCATIONS = [
  {
    year: "2023 - 2025",
    education: "Computer Programming Diploma",
    school: "Seneca Polytechnic",
    description: `Graduated from Seneca's Computer Programming program, with coursework in data structures & algorithms, object-oriented programming (C++), web programming for apps and services, software testing, and software analysis & design (UML) on UNIX/Linux.`,
    technologies: [
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "C++",
      "Python",
      "PostgreSQL",
      "Git",
    ],
  },
  {
    year: "2018 - 2020",
    education: "High School",
    school: "Welhams College",
    description: `During my high school years at Welhams College, I developed a strong interest in computer science and web development. This period was crucial in shaping my understanding of fundamental programming concepts and web technologies, which laid the groundwork for my future studies and career in technology.`,
    technologies: ["C", "HTML", "CSS"],
  },
  {
    year: "2011 - 2018",
    education: "Secondary School",
    school: "Angels' Heart Secondary School",
    description: `During my time at Angels' Heart Secondary School, I developed a keen interest in technology and began exploring the basics of programming and web development. This period was instrumental in building my foundational knowledge in computer science and igniting my passion for the field.`,
    technologies: ["HTML", "CSS"],
  },
];

export const CONTACT = {
  phoneNo: "+1 (437)436-1466",
  email: "ashish.shrees08@gmail.com",
};
