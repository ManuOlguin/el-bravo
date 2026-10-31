import type { Metadata } from "next";
import { ResetPasswordForm } from "@/src/features/account/AuthForms";

export const metadata: Metadata = { title: "Contraseña nueva" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" && token ? token : null} />;
}
