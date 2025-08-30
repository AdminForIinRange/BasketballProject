"use client";

import dynamic from "next/dynamic";

// Dynamically import Chakra Provider and disable SSR
const Provider = dynamic(
  () => import("./provider").then((mod) => mod.Provider),
  { ssr: false },
);

export default function ClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Provider>{children}</Provider>;
}


