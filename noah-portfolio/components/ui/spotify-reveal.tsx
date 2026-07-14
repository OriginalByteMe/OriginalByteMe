"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2, Radio } from "lucide-react";
import SpotifyPill from "./spotify-pill";
import { cn } from "@/lib/utils";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/store";
import useSpotify from "@/lib/hooks/useSpotify";

export default function SpotifyReveal({ variant = "default" }: { variant?: "default" | "easter-egg" }) {
  const [isOpen, setIsOpen] = useState(false);
  const { tracks, isLoading, error } = useSelector((state: RootState) => state.spotify);
  const { fetchSpotifyTracksAndPalettes } = useSpotify();
  const revealRef = useRef<HTMLDivElement>(null);
  const hasShownCalloutRef = useRef(false);
  const [isCalloutVisible, setIsCalloutVisible] = useState(false);

  useEffect(() => {
    if (isOpen && tracks.length === 0 && !isLoading) {
      fetchSpotifyTracksAndPalettes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (variant !== "easter-egg" || typeof IntersectionObserver === "undefined") {
      return;
    }

    const reveal = revealRef.current;
    if (!reveal) {
      return;
    }

    let calloutTimeout: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (hasShownCalloutRef.current || !entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        hasShownCalloutRef.current = true;
        observer.disconnect();
        setIsCalloutVisible(true);
        calloutTimeout = window.setTimeout(() => {
          setIsCalloutVisible(false);
        }, 4500);
      },
      { rootMargin: "0px" },
    );

    observer.observe(reveal);

    return () => {
      observer.disconnect();
      if (calloutTimeout !== undefined) {
        window.clearTimeout(calloutTimeout);
      }
    };
  }, [variant]);

  const toggleOpen = () => {
    setIsOpen((open) => !open);
  };

  const archive = isOpen && (
    <div className={variant === "easter-egg" ? "listening-easter-egg__archive" : "mt-2 flex w-full min-w-0 flex-wrap justify-center gap-3 rounded-2xl border border-[#37304a]/10 bg-[#f4ecdf] p-3 dark:border-white/10 dark:bg-[#26232c]"}>
      {isLoading ? (
        <div role="status" className="flex w-full items-center justify-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" aria-hidden />
          <span className="ml-2 text-emerald-600 dark:text-emerald-400">Loading Noah&apos;s top tracks...</span>
        </div>
      ) : error ? (
        <div role="alert" className="p-4 text-center text-red-500">
          <p>Error loading tracks. Using demo data instead.</p>
        </div>
      ) : (
        tracks.map((track, index) => (
          <SpotifyPill
            key={track.id}
            track={track}
            className={variant === "easter-egg" ? undefined : "animate-in fade-in slide-in-from-bottom-4"}
            style={variant === "easter-egg" ? undefined : { animationDelay: `${Math.min(index * 150, 1000)}ms` }}
          />
        ))
      )}
    </div>
  );

  if (variant === "easter-egg") {
    return (
      <div
        ref={revealRef}
        className="listening-easter-egg__reveal"
        data-callout-visible={isCalloutVisible ? "true" : undefined}
      >
        <button
          onClick={toggleOpen}
          type="button"
          aria-label={isOpen ? "Hide Noah's listening context" : "Show Noah's listening context"}
          aria-expanded={isOpen}
          aria-controls="listening-easter-egg-archive"
          className="listening-easter-egg__trigger"
        >
          <Radio strokeWidth={1.5} aria-hidden />
          <span className="listening-easter-egg__cta" aria-hidden="true">
            {isOpen ? "Hide Noah’s listening archive" : "Want to know what I’m listening to?"}
          </span>
        </button>
        {archive && <div id="listening-easter-egg-archive">{archive}</div>}
      </div>
    );
  }

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
      {archive}
    </div>
  );
}
