import { Code, Briefcase } from 'lucide-react'

const skills = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'SQL']
const workHistory = [
  { company: 'Tech Corp', role: 'Senior Developer', period: '2020 - Present' },
  { company: 'StartUp Inc', role: 'Full Stack Developer', period: '2018 - 2020' },
  { company: 'Web Solutions', role: 'Junior Developer', period: '2016 - 2018' },
]

export default function About() {
  return (
    <section className="py-20 bg-gray-900">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8">About Me</h2>
        <p className="text-gray-300 mb-12 max-w-2xl">
          I&apos;m a passionate developer with a keen eye for design and a love for creating efficient, scalable solutions. With years of experience in both front-end and back-end technologies, I bring ideas to life through code.
        </p>
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Code className="mr-2" /> Skills
            </h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">
                  {skill}
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
                <li key={index} className="border-l-2 border-gray-800 pl-4">
                  <h4 className="font-semibold">{job.company}</h4>
                  <p className="text-gray-400">{job.role}</p>
                  <p className="text-sm text-gray-500">{job.period}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

