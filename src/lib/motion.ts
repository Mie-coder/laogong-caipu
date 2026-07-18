export const appleSpring = { type: "spring", stiffness: 420, damping: 38, mass: 0.8 } as const;

export const pressMotion = { scale: 0.98 } as const;

export function fadeMotion(reduced: boolean) {
  return reduced ? { duration: 0.01 } : { duration: 0.16, ease: "easeOut" as const };
}
