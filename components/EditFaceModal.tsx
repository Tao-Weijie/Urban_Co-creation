import React, { useEffect, useState } from 'react';
import { Face } from '@/rules/evaluate';

interface EditFaceModalProps {
  isOpen: boolean;
  face: Face | null;
  onClose: () => void;
  onSave: (type: string) => void;
}

export default function EditFaceModal({
  isOpen,
  face,
  onClose,
  onSave
}: EditFaceModalProps) {
  const [editBuiltType, setEditBuiltType] = useState<string>('empty');

  useEffect(() => {
    if (face) {
      setEditBuiltType(face.state?.built_type || 'empty');
    }
  }, [face]);

  if (!isOpen || !face) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-96 rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-950 p-6 shadow-2xl space-y-4 text-zinc-800 dark:text-zinc-200">
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-2 border-b border-black/5 dark:border-white/5">
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
            Edit Face Properties (ID: {face.id})
          </h3>
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 font-sans text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <div className="space-y-4 font-sans text-xs">
          {/* Build Type Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold uppercase">Build Type</label>
            <select
              value={editBuiltType}
              onChange={(e) => setEditBuiltType(e.target.value)}
              className="bg-zinc-100 border border-black/10 dark:bg-black dark:border-white/10 rounded-xl px-3 py-2 text-zinc-900 dark:text-white focus:outline-none focus:border-pink-500 transition cursor-pointer font-sans"
            >
              <option value="empty">Empty (Unoccupied)</option>
              <option value="residential">Residential</option>
              <option value="park">Park / Greenway</option>
            </select>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-black/5 dark:border-white/5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 bg-black/5 border border-black/10 dark:text-zinc-300 dark:bg-white/5 dark:border-white/10 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(editBuiltType)}
            className="px-5 py-2 text-xs font-bold text-white bg-pink-500 rounded-xl hover:bg-pink-600 shadow-lg shadow-pink-500/10 transition duration-150 cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
