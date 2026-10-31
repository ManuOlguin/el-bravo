import type { Metadata } from "next";
import { RegisterForm } from "@/src/features/account/AuthForms";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RegisterForm next={typeof next === "string" ? next : null} />;
}
