import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSvgSrc(src: string) {
  const marker = src.search(/[?#]/)
  const pathname = marker === -1 ? src : src.slice(0, marker)
  return pathname.toLowerCase().endsWith(".svg")
}
