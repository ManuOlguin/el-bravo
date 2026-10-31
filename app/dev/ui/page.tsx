import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevUiCatalog } from "./DevUiCatalog";

export const metadata: Metadata = { title: "Catálogo UI" };

// Catálogo de primitivas para verificar a ojo. Solo existe en desarrollo.
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DevUiCatalog />;
}
