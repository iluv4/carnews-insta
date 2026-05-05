'use client';

import { SessionProvider } from "next-auth/react";
import { TabProvider } from "@/context/TabContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TabProvider>
        {children}
      </TabProvider>
    </SessionProvider>
  );
}
