import RoutineForm from "@/src/components/RoutineForm";

export default function CreateRoutinePage() {
  return (
    <div className="bg-gray-900 min-h-screen">
      <div className="max-w-2xl mx-auto pt-4">
        <a href="/routine" className="inline-flex items-center px-3 py-2 bg-gray-700 rounded-md text-sm hover:bg-gray-600"> ← Volver a mis rutinas </a>
      </div>

      <RoutineForm mode="create" />
    </div>
  );
}
