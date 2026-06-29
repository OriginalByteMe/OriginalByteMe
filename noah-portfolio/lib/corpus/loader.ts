import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Corpus, Bio, Job, SkillCategory, OperatingSystem, Project, Contact, FunFact } from "./types";

const ROOT = path.join(process.cwd(), "content", "about-me");

interface ParsedFile {
  data: Record<string, unknown>;
  content: string;
}

function read(file: string): ParsedFile {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return { data: {}, content: "" };
  const parsed = matter(fs.readFileSync(full, "utf8"));
  const data: Record<string, unknown> = parsed.data;
  return { data, content: parsed.content };
}

// Frontmatter is authored in-repo, so each field's shape is trusted to match
// the domain type. Read it as `unknown` and assert the caller-supplied shape,
// falling back when the key is absent. (No `any` — the cast is to a generic T.)
function field<T>(data: Record<string, unknown>, key: string, fallback: T): T {
  const value = data[key];
  return value === undefined ? fallback : (value as T);
}

export function loadCorpus(): { corpus: Corpus; knowledge: string } {
  const bioF = read("bio.md");
  const careerF = read("career.md");
  const skillsF = read("skills.md");
  const osF = read("operating-systems.md");
  const contactF = read("contact.md");
  const funF = read("fun-facts.md");

  const projectsDir = path.join(ROOT, "projects");
  const projectFiles = fs.existsSync(projectsDir)
    ? fs.readdirSync(projectsDir).filter((f) => f.endsWith(".md"))
    : [];
  const projects: Project[] = projectFiles.map((f) => {
    const parsed = matter(fs.readFileSync(path.join(projectsDir, f), "utf8"));
    const data: Record<string, unknown> = parsed.data;
    return {
      slug: f.replace(/\.md$/, ""),
      title: field(data, "title", ""),
      image: field(data, "image", ""),
      url: field(data, "url", ""),
      technologies: field<Project["technologies"]>(data, "technologies", []),
      description: field(data, "description", parsed.content.trim()),
    };
  });

  const corpus: Corpus = {
    bio: field<Bio>(bioF.data, "bio", { headline: "", location: "" }),
    careerTimeline: field<Job[]>(careerF.data, "jobs", []),
    skills: field<SkillCategory[]>(skillsF.data, "skills", []),
    operatingSystems: field<OperatingSystem[]>(osF.data, "operatingSystems", []),
    projects,
    contact: field<Contact>(contactF.data, "contact", { email: "", github: "", linkedin: "" }),
    funFacts: field<FunFact[]>(funF.data, "funFacts", []),
  };

  const knowledge = [bioF, careerF, skillsF, osF, contactF, funF]
    .map((f) => f.content.trim())
    .filter(Boolean)
    .join("\n\n");

  return { corpus, knowledge };
}
