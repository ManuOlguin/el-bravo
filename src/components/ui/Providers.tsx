"use client";
import { ConfirmProvider } from "./ConfirmDialog";
import { Toaster } from "./toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      {children}
      <Toaster />
    </ConfirmProvider>
  );
}
