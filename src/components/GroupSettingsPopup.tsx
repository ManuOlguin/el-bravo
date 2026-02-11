// src/components/GroupSettingsPopup.tsx
"use client";

import LeaveGroupButton from "@/src/components/LeaveGroupButton";
import DeleteGroupButton from "@/src/components/DeleteGroupButton";

type GroupSettingsPopupProps = {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  isAdmin: boolean;
  activeMemberCount: number;
    createdAt: Date;
};

export default function GroupSettingsPopup({
  open,
  onClose,
  groupId,
  groupName,
  isAdmin,
  activeMemberCount,
  createdAt,
}: GroupSettingsPopupProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Fondo oscuro */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Contenido del popup */}
      <div className="relative z-10 w-full max-w-sm rounded-lg bg-gray-900 border border-gray-700 p-4 shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">
              Configuración del grupo
            </h2>
            <p className="text-sm text-gray-400">
              Acciones sobre tu participación y el grupo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          {/* Dejar grupo */}
          <div className="border border-gray-700 rounded-md p-3">
            <div className="mb-2 text-sm font-medium text-gray-200">
              Tu participación
            </div>
            <LeaveGroupButton
              groupId={groupId}
              isAdmin={isAdmin}
              activeMemberCount={activeMemberCount}
            />
          </div>

          {/* Borrar grupo (solo admin) */}
          {isAdmin && (
            <div className="border border-red-900/60 bg-red-950/30 rounded-md p-3">
              <div className="mb-2 text-sm font-medium text-red-300">
                Administración del grupo
              </div>
              <DeleteGroupButton
                groupId={groupId}
                groupName={groupName}
              />
            </div>
          )}
          <div className="mt-3 text-sm text-gray-400">
                Creado: {new Date(createdAt).toLocaleDateString()}
              </div>
        </div>
      </div>
    </div>
  );
}
