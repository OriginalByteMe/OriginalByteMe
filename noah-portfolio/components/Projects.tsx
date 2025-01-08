import Image from 'next/image'

const projects = [
  {
    title: 'E-commerce Platform',
    description: 'A full-stack e-commerce solution with React and Node.js',
    image: '/placeholder.svg?height=200&width=300',
  },
  {
    title: 'Task Management App',
    description: 'A responsive web app for managing tasks and projects',
    image: '/placeholder.svg?height=200&width=300',
  },
  {
    title: 'Data Visualization Dashboard',
    description: 'Interactive dashboard for visualizing complex datasets',
    image: '/placeholder.svg?height=200&width=300',
  },
]

export default function Projects() {
  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-12">Projects</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <div key={index} className="bg-gray-900 rounded-lg overflow-hidden transition-transform hover:scale-105">
              <Image
                src={project.image}
                alt={project.title}
                width={300}
                height={200}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-xl font-semibold mb-2">{project.title}</h3>
                <p className="text-gray-400">{project.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

