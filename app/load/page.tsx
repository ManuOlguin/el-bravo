import CreateActivityForm from "@/src/components/CreateActivityForm";
import LogoutButton from "@/src/components/LogoutButton";

export default function LoadPage() {
  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <a href="/dashboard" className="inline-flex items-center px-3 py-2 bg-gray-700 rounded-md text-sm hover:bg-gray-600">
            ← Volver al dashboard
          </a>
          <LogoutButton />
        </div>


        <div className="bg-gray-800 rounded-lg p-6">
          <h1 className="text-2xl font-semibold mb-4">Cargar actividad</h1>
          <CreateActivityForm />
        </div>
      </div>
    </main>
  );
}
