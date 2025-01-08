'use client'

import { Mail, Github, Linkedin } from 'lucide-react'

export default function Contact() {
  return (
    <section className="py-20 bg-white dark:bg-black">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-12">Contact Me</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-900 rounded-2xl p-6">
            <Mail className="w-12 h-12 mb-4 text-gray-800 dark:text-white" />
            <h3 className="text-xl font-semibold mb-2">Email</h3>
            <a
              href="mailto:noahrijkaard@gmail.com"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              noahrijkaard@gmail.com
            </a>
          </div>
          <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-900 rounded-2xl p-6">
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
          <div className="flex flex-col items-center bg-gray-100 dark:bg-gray-900 rounded-2xl p-6">
            <Linkedin className="w-12 h-12 mb-4 text-gray-800 dark:text-white" />
            <h3 className="text-xl font-semibold mb-2">LinkedIn</h3>
            <a
              href="https://www.linkedin.com/in/noah-rijkaard-62837a149/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
            >
              linkedin.com/in/noah-rijkaard
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
