"use client";

// Forces a client boundary in segments that may trigger
// a Next.js manifest invariant under certain builds.
export function ForceClient() {
  return null;
}

