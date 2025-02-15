"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  Code,
  Briefcase,
  Terminal,
  Layout,
  Server,
  Database,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
// import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const skillCategories = {
  "Programming Languages": [
    {
      name: "Ruby",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ruby/ruby-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ruby/ruby-plain.svg",
    },
    {
      name: "Python",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg",
    },
    {
      name: "JavaScript",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-plain.svg",
    },
    {
      name: "TypeScript",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-plain.svg",
    },
    {
      name: "React",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
    },
    {
      name: "Bash",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bash/bash-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/bash/bash-original.svg",
    },
  ],
  "Frontend Frameworks": [
    {
      name: "Next.js",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nextjs/nextjs-plain.svg",
    },
    {
      name: "Ruby on Rails",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rails/rails-original-wordmark.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rails/rails-plain-wordmark.svg",
    },
    {
      name: "Tailwind CSS",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg",
    },
  ],
  "Infrastructure & DevOps": [
    {
      name: "Docker",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-plain.svg",
    },
    {
      name: "Proxmox",
      lightImage:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Cib-proxmox_%28CoreUI_Icons_v1.0.0%29.svg/120px-Cib-proxmox_%28CoreUI_Icons_v1.0.0%29.svg.png",
      darkImage:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Cib-proxmox_%28CoreUI_Icons_v1.0.0%29.svg/120px-Cib-proxmox_%28CoreUI_Icons_v1.0.0%29.svg.png",
    },
    {
      name: "Unraid",
      lightImage:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Unraid_logo.svg/512px-Unraid_logo.svg.png?20220714061117",
      darkImage:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Unraid_logo.svg/512px-Unraid_logo.svg.png?20220714061117",
    },
    {
      name: "AWS",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg",
    },
    {
      name: "Git",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg",
    },
    {
      name: "Terraform",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/terraform/terraform-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/terraform/terraform-original.svg",
    },
  ],
  Databases: [
    {
      name: "PostgreSQL",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-plain.svg",
    },
    {
      name: "MySQL",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mysql/mysql-original.svg",
    },
    {
      name: "SQLite",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/sqlite/sqlite-original.svg",
    },
    {
      name: "Redis",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/redis/redis-plain.svg",
    },
    {
      name: "MongoDB",
      lightImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg",
      darkImage:
        "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-plain.svg",
    },
  ],
};

const operatingSystems = [
  {
    name: "Linux Environment",
    systems: [
      {
        name: "Linux",
        lightImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg",
        darkImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg",
      },
      {
        name: "Debian",
        lightImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/debian/debian-original.svg",
        darkImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/debian/debian-plain.svg",
      },
      {
        name: "Ubuntu",
        lightImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ubuntu/ubuntu-original.svg",
        darkImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/ubuntu/ubuntu-original.svg",
      },
    ],
  },
  {
    name: "Windows Environment",
    systems: [
      {
        name: "Windows",
        lightImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/windows8/windows8-original.svg",
        darkImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/windows8/windows8-original.svg",
      },
      {
        name: "WSL2",
        lightImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg",
        darkImage:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/linux/linux-original.svg",
      },
    ],
  },
];

const workHistory = [
  {
    company: "Supa",
    role: "Full-Stack Developer",
    period: "2020 - Present",
    logo: "https://cdn.prod.website-files.com/63024b20439fa61d4aee344c/63030911c32fa796ec211265_SUPA.png",
    url: "https://supa.so",
  },
  {
    company: "Bowiq",
    role: "CAD Designer & 3D Printing Engineer",
    period: "2023 - Present",
    logo: "https://bowiq.com/wp-content/themes/bowiq/img/local/logov2.png",
    url: "https://bowiq.com",
  },
  // Add more work history items as needed
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
          I&apos;m a passionate developer with a keen eye for design and a love
          for creating efficient, scalable solutions. With years of experience
          in both front-end and back-end technologies, I bring ideas to life
          through code.
        </p>
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Code className="mr-2" /> Skills
            </h3>
            <div className="space-y-6">
              {Object.entries(skillCategories).map(([category, skills]) => (
                <div key={category}>
                  <h4 className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center">
                    {category === "Programming Languages" && (
                      <Terminal className="mr-2 h-5 w-5" />
                    )}
                    {category === "Frontend Frameworks" && (
                      <Layout className="mr-2 h-5 w-5" />
                    )}
                    {category === "Infrastructure & DevOps" && (
                      <Server className="mr-2 h-5 w-5" />
                    )}
                    {category === "Databases" && (
                      <Database className="mr-2 h-5 w-5" />
                    )}
                    {category}
                  </h4>
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
                  className="border-l-2 border-gray-300 dark:border-gray-800 pl-4 flex items-start gap-4"
                >
                  <Image
                    src={job.logo}
                    alt={`${job.company} logo`}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-lg"
                  />
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      {job.company}
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
                          />
                        </svg>
                      </a>
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400">
                      {job.role}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {job.period}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12">
          <h3 className="text-2xl font-semibold mb-4 flex items-center">
            <Code className="mr-2" /> Operating Systems
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {operatingSystems.map((environment) => (
              <div
                key={environment.name}
                className="bg-gray-200 dark:bg-gray-800 p-6 rounded-xl shadow-sm" // Updated rounded corners and padding
              >
                <div className="flex items-center mb-4">
                  <Image
                    src={
                      isDark
                        ? environment.systems[0].darkImage
                        : environment.systems[0].lightImage
                    }
                    alt={environment.systems[0].name}
                    width={32}
                    height={32}
                    className="w-8 h-8 mr-3"
                  />
                  <h4 className="text-lg font-semibold">{environment.name}</h4>
                </div>
                <div className="flex flex-wrap gap-3">
                  {environment.systems.slice(1).map((system) => (
                    <span
                      key={system.name}
                      className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white px-3 py-1 rounded-full text-sm flex items-center gap-2 hover:shadow-md transition-all duration-200"
                    >
                      <Image
                        src={isDark ? system.darkImage : system.lightImage}
                        alt={system.name}
                        width={20}
                        height={20}
                        className="w-5 h-5"
                      />
                      {system.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12">
          <h3 className="text-2xl font-semibold mb-4 flex items-center">
            <Code className="mr-2" /> Side Projects
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-200 dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center mb-4">
                <Image
                  src="/Noah Icon FA.svg"
                  alt="3D Printing"
                  width={64}
                  height={64}
                  className="w-16 h-16 mr-3"
                />
                <h4 className="text-lg font-semibold">3D Printing</h4>
              </div>
              {/* <div className="flex items-center mb-4">
                <DotLottieReact
                  src="https://lottie.host/ccaa3086-9bde-4416-894a-af43276c53b6/cjH4XYVlEa.lottie"
                  loop
                  autoplay
                  className="w-16 h-16 mr-3"
                />
              </div> */}
              <p className="text-gray-700 dark:text-gray-300">
                I have learned CAD design and use a variety of 3D printing
                methods and techniques to make my products work for different
                use cases. Namely in FDM printing at the moment, but with very
                high end materials and machines.
              </p>
            </div>
            <div className="bg-gray-200 dark:bg-gray-800 p-6 rounded-xl shadow-sm">
              <div className="flex items-center mb-4">
                <div className="flex items-center mb-4">
                  <DotLottieReact
                    src="https://lottie.host/ef9b2abd-0371-4525-ad25-ad50ff45c364/JSqmr4sTA8.lottie"
                    loop
                    autoplay
                    className="w-16 h-16 mr-3"
                  />
                </div>
                <Link
                  href="https://blog.noahrijkaard.com"
                  target="_blank"
                  rel="noopener norefferer"
                >
                  <h4 className="text-lg font-semibold hover:underline hover:text-blue-500 dark:hover:text-blue-400">
                    My blog!
                  </h4>
                </Link>
              </div>
              <p className="text-gray-700 dark:text-gray-300">
                The tech diary of Noah Rijkaard, a Full-stack software engineer
                working out of Kuala Lumpur Malaysia, it comprises of tutorials,
                thoughts and existential crises.
              </p>
            </div>

            {/* Add more side projects as needed */}
          </div>
        </div>
      </div>
    </section>
  );
}
