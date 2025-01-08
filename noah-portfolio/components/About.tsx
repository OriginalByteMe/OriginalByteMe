"use client";

import { Code, Briefcase } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

const skills = [
  {
    name: "JavaScript",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-plain.svg",
  },
  {
    name: "React",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-plain.svg",
  },
  {
    name: "Node.js",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-plain.svg",
  },
  {
    name: "TypeScript",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-plain.svg",
  },
  {
    name: "GraphQL",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/graphql/graphql-plain-wordmark.svg",
  },
  {
    name: "MongoDB",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-plain.svg",
  },
  {
    name: "Docker",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-plain.svg",
  },
  {
    name: "Tailwind CSS",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-plain.svg",
  },
  {
    name: "Next.js",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-plain.svg",
  },
  {
    name: "Jest",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain-wordmark.svg",
  },
  {
    name: "AWS",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg",
  },
  {
    name: "CI/CD",
    lightImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg",
    darkImage:
      "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-plain.svg",
  },
];
const workHistory = [
  { company: "Tech Corp", role: "Senior Developer", period: "2020 - Present" },
  {
    company: "StartUp Inc",
    role: "Full Stack Developer",
    period: "2018 - 2020",
  },
  { company: "Web Solutions", role: "Junior Developer", period: "2016 - 2018" },
];

export default function About() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check theme on mount and listen for changes
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          setIsDark(document.documentElement.classList.contains("dark"));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8">About Me</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-12 max-w-2xl">
          I&apos;m a passionate developer with a keen eye for design and a love for
          creating efficient, scalable solutions. With years of experience in
          both front-end and back-end technologies, I bring ideas to life
          through code.
        </p>
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Code className="mr-2" /> Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill.name}
                  className="bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  <Image
                    src={isDark ? skill.darkImage : skill.lightImage}
                    alt={skill.name}
                    width={20}
                    height={20}
                    className="w-5 h-5"
                  />
                  {skill.name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Briefcase className="mr-2" /> Work History
            </h3>
            <ul className="space-y-4">
              {workHistory.map((job, index) => (
                <li
                  key={index}
                  className="border-l-2 border-gray-300 dark:border-gray-800 pl-4"
                >
                  <h4 className="font-semibold">{job.company}</h4>
                  <p className="text-gray-600 dark:text-gray-400">{job.role}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {job.period}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
