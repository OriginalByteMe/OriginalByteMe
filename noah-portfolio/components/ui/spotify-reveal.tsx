"use client";

import { useState, useEffect } from "react";
import { AiOutlineSpotify } from "react-icons/ai";
import { X, Loader2 } from "lucide-react";
import SpotifyPill from "./spotify-pill";
import { cn } from "@/lib/utils";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import useSpotify from "@/lib/hooks/useSpotify";

export default function SpotifyReveal() {
  const [isOpen, setIsOpen] = useState(false);
  const { tracks, isLoading, error } = useSelector((state: RootState) => state.spotify);
  const { fetchSpotifyTracksAndPalettes } = useSpotify();

  // Fetch tracks when the reveal is opened
  useEffect(() => {
    if (isOpen && tracks.length === 0 && !isLoading) {
      fetchSpotifyTracksAndPalettes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={toggleOpen}
        className={cn(
          "flex items-center gap-3 justify-center border-2 border-emerald-200 dark:border-emerald-600 rounded-xl w-max m-2 p-3 transition-all duration-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer",
          "hover:shadow-md hover:shadow-emerald-200/30 dark:hover:shadow-emerald-600/20",
          isOpen && "bg-emerald-50 dark:bg-emerald-950/30 shadow-md shadow-emerald-200/30 dark:shadow-emerald-600/20"
        )}
      >
        {isOpen ? (
          <>
            <X className="h-8 w-8 dark:text-emerald-600 text-emerald-200" />
            <div>
              <h1 className="text-sm font-medium dark:text-white text-gray-900">Close Spotify Magic</h1>
            </div>
          </>
        ) : (
          <>
            <AiOutlineSpotify className="h-9 w-9 dark:text-emerald-600 text-emerald-200" />
            <div>
              <h1 className="text-sm font-medium dark:text-white text-gray-900">Hey! Click here to see some cool Spotify Magic✨</h1>
            </div>
          </>
        )}
      </button>

      {isOpen && (
        <div className="flex flex-wrap justify-center gap-4 w-full max-w-4xl mx-auto p-4 mt-2 transition-all duration-500 animate-in fade-in slide-in-from-top-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-xl shadow-lg shadow-emerald-100/20 dark:shadow-emerald-900/10 border border-emerald-100 dark:border-emerald-900/50">
          {isLoading ? (
            <div className="flex items-center justify-center p-6 w-full">
              <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">Loading your top tracks...</span>
            </div>
          ) : error ? (
            <div className="text-red-500 p-4 text-center">
              <p>Error loading tracks. Using demo data instead.</p>
            </div>
          ) : (
            tracks.map((track, index) => (
              <SpotifyPill 
                key={track.id} 
                track={track}
                className={cn(
                  "animate-in fade-in slide-in-from-bottom-4", 
                  {
                    "delay-150": index === 1,
                    "delay-300": index === 2,
                    "delay-500": index === 3,
                    "delay-700": index === 4
                  }
                )} 
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}