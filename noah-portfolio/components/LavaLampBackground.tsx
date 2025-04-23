"use client";

import React from "react";

export default function LavaLampBackground() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-gradient-start to-gradient-end opacity-80" />
      <div className="absolute inset-0">
        <div
          className="absolute w-72 h-72 bg-blob-primary rounded-full blur-xl opacity-50 animate-[blob1_35s_infinite] left-0 top-0"
        />
        <div
          className="absolute w-64 h-64 bg-blob-secondary rounded-full blur-xl opacity-40 animate-[blob2_28s_infinite] right-0 top-0"
        />
        <div
          className="absolute w-80 h-80 bg-blob-tertiary rounded-full blur-xl opacity-45 animate-[blob3_32s_infinite] right-1/4 top-0"
        />
        <div
          className="absolute w-56 h-56 bg-blob-primary rounded-full blur-xl opacity-55 animate-[blob4_25s_infinite] left-1/3 top-0"
        />
        <div
          className="absolute w-[30rem] h-[30rem] bg-blob-secondary rounded-full blur-xl opacity-60 animate-[blob2_48s_infinite] right-0 bottom-1/4"
        />
        <div
          className="absolute w-[28rem] h-[28rem] bg-blob-tertiary rounded-full blur-xl opacity-50 animate-[blob3_39s_infinite] left-1/4 bottom-0"
        />
        <div
          className="absolute w-[34rem] h-[34rem] bg-blob-primary rounded-full blur-xl opacity-40 animate-[blob4_42s_infinite] right-1/4 top-1/4"
        />
        <div
          className="absolute w-[26rem] h-[26rem] bg-blob-secondary rounded-full blur-xl opacity-50 animate-[blob5_87s_infinite] left-1/3 top-1/3"
        />
        <div
          className="absolute w-[21rem] h-[21rem] bg-blob-secondary rounded-full blur-xl opacity-50 animate-[blob6_52s_infinite] left-1/3 top-1/3"
        />
        <div
          className="absolute w-[21rem] h-[21rem] bg-blob-secondary rounded-full blur-xl opacity-50 animate-[blob7_11s_infinite] right-1/3 top-2/3"
        />
        <div
          className="absolute w-[12rem] h-[12rem] bg-blob-secondary rounded-full blur-xl opacity-50 animate-[blob8_10s_infinite] left-3/4 top-1/3"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40" />
    </div>
  );
}
