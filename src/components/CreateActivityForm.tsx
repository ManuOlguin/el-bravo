"use client";

import { useEffect, useState } from "react";

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
  const [activityType, setActivityType] = useState<string>('other');
  const [routines, setRoutines] = useState<any[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = u seState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/routine/list');
        const data = await res.json() ;
        if (!res.ok) return;
        if (!mounted) return;
        setRoutines(Array.isArray(data) ? data : data.routines || []);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

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
          const payload: any = { startedAt: s.toISOString(), endedAt: ed.toISOString(), notes, type: activityType };
          if (selectedRoutineId) payload.routineId = selectedRoutineId;
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
        <label className="block text-sm font-medium text-gray-200">Tipo</label>
        <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded">
          <option value="gym">Gimnasio</option>
          <option value="run">Correr</option>
          <option value="sport">Deporte</option>
          <option value="mobility">Movilidad</option>
          <option value="other">Otro</option>
        </select>
      </div>

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

      <div>
        <label className="block text-sm font-medium text-gray-200">Rutina (opcional)</label>
        <select value={selectedRoutineId ?? ""} onChange={(e) => setSelectedRoutineId(e.target.value || null)} className="w-full mt-1 px-3 py-2 bg-gray-700 rounded">
          <option value="">-- Ninguna --</option>
          {routines.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {selectedRoutineId && (
        (() => {
          const r = routines.find(x => x.id === selectedRoutineId);
          if (!r) return null;
          return (
            <div className="bg-gray-800 p-3 rounded">
              <h3 className="font-medium">{r.name}</h3>
              <ul className="text-sm text-gray-300 list-disc ml-5">
                {r.exercises.map((ex: any) => (
                  <li key={ex.id}>{ex.name} – {ex.sets}x{ex.reps}</li>
                ))}
              </ul>
            </div>
          );
        })()
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 rounded">{saving ? 'Guardando...' : 'Guardar actividad'}</button>
        <a href="/dashboard" className="px-4 py-2 bg-gray-600 rounded">Cancelar</a>
      </div>
    </form>
  );
}
