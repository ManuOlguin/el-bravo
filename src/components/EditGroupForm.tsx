"use client";

import { useState } from "react";

export default function EditGroupForm({ group }: any) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState(group?.photoUrl ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const res = await fetch('/api/groups/update', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: group.id, name, photoUrl }),
            });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            alert(data?.error || 'Error saving group');
          } else {
            // refresh or navigate back to group page
            window.location.href = '/group';
          }
        } catch (err) {
          alert('Network error');
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-200">Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded" />
      </div>

      {/* description removed: Group model doesn't have a description field */}

      <div>
        <label className="block text-sm font-medium text-gray-200">URL de foto</label>
        <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded" />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 rounded">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <a href="/group" className="px-4 py-2 bg-gray-600 rounded">Cancelar</a>
      </div>
    </form>
  );
}
