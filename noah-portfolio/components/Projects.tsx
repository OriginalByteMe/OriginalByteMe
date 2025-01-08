'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

const projects = [
  {
    title: "AI Image Cutout Tool",
    description:
      "A fun little app that uses segment anything to cut people and objects out of images to use as stickers!",
    image: "/cutout_project.jpeg",
    url: "https://github.com/OriginalByteMe/AI_Image_cutout_maker",
    technologies: [
      {
        name: "Python",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      },
      {
        name: "AWS",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg",
      },
      {
        name: "Docker",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-plain.svg",
      },
      {
        name: "Pytorch",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg",
      },
      {
        name: "Terraform",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/terraform/terraform-original.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/terraform/terraform-original.svg",
      },
      {
        name: "React",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
      },
    ],
  },
  {
    title: "LLM Comparison app",
    description:
      "An opensource project that allows users to pit two LLMs against each other and see how they compare",
    image: "/eval.png",
    url: "https://github.com/Supahands/llm-comparison",
    technologies: [
      {
        name: "React",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg",
      },
      {
        name: "Python",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg",
      },
      {
        name: "Docker",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-plain.svg",
      },
      {
        name: "AWS",
        lightIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-original-wordmark.svg",
        darkIcon:
          "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/amazonwebservices/amazonwebservices-plain-wordmark.svg",
      },
      {
        name: "Ollama",
        lightIcon:
          "https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light/ollama.png",
        darkIcon:
          "https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/dark/ollama.png",
      },
    ],
  },
];

export default function Projects() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
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
    <section className="py-20 bg-white dark:bg-black">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-12">Projects</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <a 
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              key={index} 
              className="group bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden transition-all hover:scale-105 hover:shadow-lg"
            >
              <Image
                src={project.image}
                alt={project.title}
                width={300}
                height={200}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  {project.title}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 20 20" 
                    fill="currentColor" 
                    className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" />
                  </svg>
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{project.description}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {project.technologies.map((tech, techIndex) => (
                    <div key={techIndex} className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-1 rounded-full text-sm">
                      <Image
                        src={isDark ? tech.darkIcon : tech.lightIcon}
                        alt={tech.name}
                        width={20}
                        height={20}
                        className="w-5 h-5"
                      />
                      <span>{tech.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

