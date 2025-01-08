import Image from 'next/image'

const projects = [
  {
    title: "AI Image Cutout Tool",
    description:
      "A fun little app that uses segment anything to cut people and objects out of images to use as stickers!",
    image: "/cutout_project.jpeg",
    url: "https://github.com/OriginalByteMe/AI_Image_cutout_maker",
  },
  {
    title: "LLM Comparison app",
    description:
      "An opensource project that allows users to pit two LLMs against each other and see how they compare",
    image: "/eval.png",
    url: "https://github.com/Supahands/llm-comparison",
  },
];

export default function Projects() {
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
              className="group bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden transition-all hover:scale-105 hover:shadow-lg"
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
                <p className="text-gray-600 dark:text-gray-400">{project.description}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

