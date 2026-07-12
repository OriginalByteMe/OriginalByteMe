"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Radio } from "lucide-react";
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
    <div className="mt-3 flex min-w-0 flex-col items-stretch">
      <button
        onClick={toggleOpen}
        type="button"
        aria-label={isOpen ? "Hide Noah's listening context" : "Show Noah's listening context"}
        aria-expanded={isOpen}
        className={cn(
          "hero-action min-h-11 w-full justify-between rounded-full px-4 text-sm font-medium",
          isOpen && "border-[#5646a8]/50 dark:border-[#9d8ff2]/60"
        )}
      >
        {isOpen ? (
          <>
            <span>Hide soundtrack</span>
            <X className="size-4" strokeWidth={1.5} aria-hidden />
          </>
        ) : (
          <>
            <span>Noah&apos;s soundtrack</span>
            <Radio className="size-4" strokeWidth={1.5} aria-hidden />
          </>
        )}
      </button>

      {isOpen && (
        <div className="mt-2 flex w-full min-w-0 flex-wrap justify-center gap-3 rounded-2xl border border-[#37304a]/10 bg-[#f4ecdf] p-3 dark:border-white/10 dark:bg-[#26232c]">
          {isLoading ? (
            <div className="flex items-center justify-center p-6 w-full">
              <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
              <span className="ml-2 text-emerald-600 dark:text-emerald-400">Loading Noah&apos;s top tracks...</span>
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
                className="animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${Math.min(index * 150, 1000)}ms` }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
