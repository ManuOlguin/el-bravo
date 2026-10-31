import type { Metadata } from "next";
import { LoginForm } from "@/src/features/account/AuthForms";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : null} expired={expired === "1"} />;
}
