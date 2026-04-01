import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import CreateActivityForm from "@/src/components/CreateActivityForm";

export default async function LoadPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <CreateActivityForm />
      </div>
    </main>
  );
}