"use client";

import React from "react";

export default function LavaLampBackground() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
      <div className="absolute inset-0 bg-gradient-to-br from-gradient-start to-gradient-end opacity-80" />
      <div className="absolute inset-0">
        <div
          className="absolute w-96 h-96 bg-blob-primary rounded-full blur-xl opacity-60 animate-[blob1_55s_infinite] left-0 top-0"
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
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40" />
    </div>
  );
}
