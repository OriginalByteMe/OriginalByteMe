"use client"

import { SpotifyTrack } from "@/app/utils/interfaces"
import { cn } from "@/lib/utils"
import { Music, Wand2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useSelector } from "react-redux"
import { RootState } from "@/lib/store"
import Image from "next/image"
import { useDispatch } from "react-redux"
export default function SpotifyPill({
  className,
  track
}: {
  className?: string
  track?: SpotifyTrack
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isJiggling, setIsJiggling] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const {selectedTrack } = useSelector((state: RootState) => state.spotify)
  const dispatch = useDispatch();
  
  // Use the provided track
  const currentTrack = track

  // Reset palette view when selected track changes
  useEffect(() => {
    if (selectedTrack && currentTrack && selectedTrack.id !== currentTrack.id) {
      setShowPalette(false)
    }
  }, [selectedTrack, currentTrack])
  
  // Handle magic wand click
  const handleMagicWandClick = () => {
    setIsJiggling(true)
    // Toggle between soundwave and palette view
    setShowPalette(!showPalette)
    // Reset jiggling after animation completes
    setTimeout(() => setIsJiggling(false), 820)
    // Set the selected track
    dispatch({ type: "spotify/setSelectedTrack", payload: currentTrack || null })
  }

  // Check if device is touch-enabled
  useEffect(() => {
    const isTouchDevice = () => {
      return "ontouchstart" in window || navigator.maxTouchPoints > 0
    }

    if (isTouchDevice()) {
      setIsHovered(true)
    }
  }, [])

  // If no track data is available, return null or a loading state
  if (!currentTrack) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-full p-1 pr-4 w-full sm:w-auto min-w-[240px] md:min-w-[280px] shadow-lg transition-all duration-300",
        "bg-white dark:bg-black text-gray-800 dark:text-white border border-gray-200 dark:border-gray-800",
        "hover:shadow-md hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={cn("relative h-10 w-10 sm:h-12 sm:w-12 rounded-full overflow-hidden flex-shrink-0 bg-emerald-100 dark:bg-emerald-900")}
      >
        {currentTrack.albumCover ? (
          <Image
            src={currentTrack.albumCover || "/placeholder.svg"}
            alt={`${currentTrack.title} album cover`}
            className="object-cover"
            fill
            sizes="(max-width: 768px) 40px, 48px"
            priority={false}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Music className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}

        {isHovered && (
          <button
            onClick={handleMagicWandClick}
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200 touch-manipulation bg-white/60 dark:bg-black/60"
          >
            <Wand2 
              className={cn(
                "h-5 w-5 text-emerald-600 dark:text-emerald-400",
                isJiggling && "magic-wand-jiggle"
              )}
            />
          </button>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.36.12-.75-.12-.87-.48-.12-.36.12-.75.48-.87 4.56-1.02 8.52-.6 11.64 1.32.42.18.479.66.301 1.021zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-.959-.12-1.08-.6-.12-.48.12-.96.6-1.08C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Spotify
          </span>
        </div>

        <div className="truncate font-semibold text-sm sm:text-base">{currentTrack.title}</div>

        <div className="truncate text-xs sm:text-sm text-gray-500 dark:text-gray-400">{currentTrack.artist}</div>
      </div>

      <div className="flex-shrink-0 ml-1">
        <div className={cn("transition-opacity duration-300", {
          "opacity-0 absolute": showPalette && currentTrack.colourPalette && currentTrack.colourPalette.length > 0,
          "opacity-100": !showPalette || !currentTrack.colourPalette || currentTrack.colourPalette.length === 0
        })}>
          <div className="soundwave-container">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="soundwave-bar bg-emerald-500 dark:bg-emerald-400"
                style={{
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
        
        <div className={cn("transition-opacity duration-300", {
          "opacity-100": showPalette && currentTrack.colourPalette && currentTrack.colourPalette.length > 0,
          "opacity-0 absolute": !showPalette || !currentTrack.colourPalette || currentTrack.colourPalette.length === 0
        })}>
          <div className="palette-grid">
            {currentTrack.colourPalette && currentTrack.colourPalette.map((color, i) => (
              <div
                key={i}
                className="palette-circle"
                style={{
                  backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
                  animationDelay: `${i * 0.05}s`,
                  animation: showPalette ? 'pop-in 0.3s forwards' : 'none'
                }}
                title={`RGB(${color[0]}, ${color[1]}, ${color[2]})`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

