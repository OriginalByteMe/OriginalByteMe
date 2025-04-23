'use client'

import { Mail, Github, Linkedin } from 'lucide-react'
import FrostedGlassBox from './ui/frosted-glass-box'

export default function Contact() {
  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-12">Contact Me</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FrostedGlassBox variant="blue" hoverEffect="lift" glassOpacity="heavy" onClick={() => window.open("mailto:noahrijkaard@gmail.com", "_blank")}>
            <div className="flex flex-col items-center">
              <Mail className="w-12 h-12 mb-4 text-gray-800 dark:text-white" />
              <h3 className="text-xl font-semibold mb-2">Email</h3>
              <a
                href="mailto:noahrijkaard@gmail.com"
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                noahrijkaard@gmail.com
              </a>
            </div>
          </FrostedGlassBox>
          <FrostedGlassBox variant="blue" hoverEffect="lift" glassOpacity="heavy" onClick={() => window.open("https://github.com/OriginalByteMe", "_blank")}>
            <div className="flex flex-col items-center">
              <Github className="w-12 h-12 mb-4 text-gray-800 dark:text-white" />
              <h3 className="text-xl font-semibold mb-2">GitHub</h3>
              <a
                href="https://github.com/OriginalByteMe"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                github.com/OriginalByteMe
              </a>
            </div>
          </FrostedGlassBox>
          <FrostedGlassBox variant="blue" hoverEffect="lift" glassOpacity="heavy" onClick={() => window.open("https://www.linkedin.com/in/noah-rijkaard/", "_blank")}>
            <div className="flex flex-col items-center">
              <Linkedin className="w-12 h-12 mb-4 text-gray-800 dark:text-white" />
              <h3 className="text-xl font-semibold mb-2">LinkedIn</h3>
              <a
                href="https://www.linkedin.com/in/noah-rijkaard/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
              >
                linkedin.com/in/noah-rijkaard
              </a>
            </div>
          </FrostedGlassBox>
        </div>
      </div>
    </section>
  )
}
