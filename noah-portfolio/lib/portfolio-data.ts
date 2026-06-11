export const name = "Noah Rijkaard";
export const location = "Kuala Lumpur, Malaysia";
export const tagline = "AI Engineer · Agentic Systems · Full-Stack";

// Role sets cycled through by the orbiting hero text rings.
export const heroRoleSets: string[][] = [
  ["AI ENGINEER", "AGENT ARCHITECT", "LLM SYSTEMS"],
  ["FULL-STACK DEV", "RAG PIPELINES", "PROMPT DESIGN"],
  ["MODEL EVALS", "MCP TOOLING", "SELF-HOSTER"],
  ["DOCKER CAPTAIN", "OPEN SOURCE", "3D PRINTING"],
];

// The slower outer ring keeps a constant mantra.
export const orbitMantra = [
  "BUILD",
  "EVAL",
  "SHIP",
  "ITERATE",
  "AGENTS",
  "TOOLS",
  "CONTEXT",
  "MEMORY",
];

export const about = `I build AI-native products and agentic systems — pipelines where LLMs plan, call tools and ship real work. My background is full-stack engineering, which means the agents I build actually make it to production: evals, infra, UI and all. When I'm not orchestrating models I'm self-hosting half the internet in my homelab and 3D printing the other half.`;

export const skills: { category: string; items: string[] }[] = [
  {
    category: "AI & Agents",
    items: [
      "LLM Orchestration",
      "Agentic Workflows",
      "RAG Pipelines",
      "Evals & Benchmarking",
      "Prompt Engineering",
      "PyTorch",
      "Ollama",
    ],
  },
  {
    category: "Languages",
    items: ["Python", "TypeScript", "JavaScript", "Ruby", "Bash"],
  },
  {
    category: "Frameworks",
    items: ["Next.js", "React", "Ruby on Rails", "Node.js", "Tailwind CSS"],
  },
  {
    category: "Infra & Data",
    items: [
      "Docker",
      "AWS",
      "Terraform",
      "Proxmox",
      "PostgreSQL",
      "Redis",
      "MongoDB",
    ],
  },
];

export const work = [
  {
    company: "Supa",
    role: "Full-Stack Developer → AI Engineer",
    period: "2020 — Present",
    url: "https://supa.so",
    blurb:
      "Building AI data products, LLM comparison tooling and agentic pipelines end-to-end.",
  },
  {
    company: "Bowiq",
    role: "CAD Designer & 3D Printing Engineer",
    period: "2023 — Present",
    url: "https://bowiq.com",
    blurb:
      "Designing and manufacturing functional FDM-printed products with high-end materials.",
  },
];

export const projects = [
  {
    title: "AI Image Cutout Tool",
    repo: "github.com/OriginalByteMe/AI_Image_cutout_maker",
    url: "https://github.com/OriginalByteMe/AI_Image_cutout_maker",
    description:
      "Segment-Anything powered app that cuts people and objects out of images to use as stickers.",
    stack: ["Python", "PyTorch", "AWS", "Docker", "Terraform", "React"],
    image: "/cutout_project.jpeg",
  },
  {
    title: "LLM Comparison Arena",
    repo: "github.com/Supahands/llm-comparison",
    url: "https://github.com/Supahands/llm-comparison",
    description:
      "Open-source arena for pitting two LLMs head-to-head and scoring their outputs.",
    stack: ["React", "Python", "Ollama", "Docker", "AWS"],
    image: "/eval.png",
  },
  {
    title: "Tech Blog",
    repo: "blog.noahrijkaard.com",
    url: "https://blog.noahrijkaard.com",
    description:
      "Tutorials, homelab deep-dives and the occasional existential crisis, fresh from Kuala Lumpur.",
    stack: ["Writing", "Self-hosted"],
    image: null,
  },
];

export const socials = [
  {
    label: "Email",
    value: "noahrijkaard@gmail.com",
    href: "mailto:noahrijkaard@gmail.com",
  },
  {
    label: "GitHub",
    value: "github.com/OriginalByteMe",
    href: "https://github.com/OriginalByteMe",
  },
  {
    label: "LinkedIn",
    value: "linkedin.com/in/noah-rijkaard",
    href: "https://www.linkedin.com/in/noah-rijkaard",
  },
];
