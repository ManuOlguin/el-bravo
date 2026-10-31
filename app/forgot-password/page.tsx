import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/src/features/account/AuthForms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
