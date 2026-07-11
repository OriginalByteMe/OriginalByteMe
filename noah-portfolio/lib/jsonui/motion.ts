import type { Variants } from "framer-motion";

export const enter: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, type: "spring", stiffness: 220, damping: 24 },
  }),
};
