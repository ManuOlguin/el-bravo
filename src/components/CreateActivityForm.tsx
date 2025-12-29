"use client";

import { useState } from "react";

function twoDigits(n: number) {
  return String(n).padStart(2, '0');
}

// using native time inputs for simpler, consistent mobile behavior

export default function CreateActivityForm(): any {
  const now = new Date();
  const startDefault = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const defaultDate = startDefault.toISOString().slice(0,10);
  const defaultStartTime = `${twoDigits(startDefault.getHours())}:${twoDigits(startDefault.getMinutes())}`;
  const defaultEndTime = `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
  const [date, setDate] = useState<string>(defaultDate);
  const [startTime, setStartTime] = useState<string>(defaultStartTime);
  const [endTime, setEndTime] = useState<string>(defaultEndTime);
  // endDate is kept separate so default end uses today's date (now)
  const [endDate] = useState<string>(now.toISOString().slice(0,10));
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // native time inputs will handle hours/minutes on mobile devices

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          const s = new Date(`${date}T${startTime}:00`);
          let ed = new Date(`${endDate}T${endTime}:00`);
          if (ed.getTime() <= s.getTime()) {
            ed = new Date(ed.getTime() + 24 * 60 * 60 * 1000);
          }
          const payload = { startedAt: s.toISOString(), endedAt: ed.toISOString(), notes };
          const res = await fetch('/api/activities/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            alert(data?.error || 'Error creating activity');
          } else {
            window.location.href = '/dashboard';
          }
        } catch (err) {
          alert('Network error');
        } finally {
          setSaving(false);
        }
      }}
      className="space-y-4"
    >
      {/* activity type removed from model */}

      <div>
        <label className="block text-sm font-medium text-gray-200">Fecha</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-200">Inicio</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-200">Fin</label>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded" />
        </div>
      </div>

      

      <div>
        <label className="block text-sm font-medium text-gray-200">Notas</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded" rows={3} />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 rounded">{saving ? 'Guardando...' : 'Guardar actividad'}</button>
        <a href="/dashboard" className="px-4 py-2 bg-gray-600 rounded">Cancelar</a>
      </div>
    </form>
  );
}
