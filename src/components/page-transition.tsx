"use client";

import { motion, useReducedMotion } from "framer-motion";
import { fadeMotion } from "@/lib/motion";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const reduced = reduceMotion !== false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fadeMotion(reduced)}
    >
      {children}
    </motion.div>
  );
}
