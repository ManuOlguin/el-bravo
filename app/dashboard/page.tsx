import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main style={{ padding: 32 }}>
      <h1>Dashboard</h1>

      <p>
        Logged in as <b>{user.email}</b>
      </p>

      {user.name && <p>Name: {user.name}</p>}

      <form action="/api/auth/logout" method="POST">
        <button type="submit">Logout</button>
      </form>
    </main>
  );
}
