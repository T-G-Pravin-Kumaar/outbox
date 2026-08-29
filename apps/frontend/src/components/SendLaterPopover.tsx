'use client';

import React, { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

interface SendLaterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTime: (scheduledAt: string) => void;
}

export function SendLaterPopover({
  isOpen,
  onClose,
  onSelectTime,
}: SendLaterPopoverProps) {
  const [customDateTime, setCustomDateTime] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  if (!isOpen) return null;

  // Helper to format ISO string for tomorrow at specific hours
  const getTomorrowAt = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  const presets = [
    { label: 'Tomorrow', value: getTomorrowAt(9) },
    { label: 'Tomorrow, 10:00 AM', value: getTomorrowAt(10) },
    { label: 'Tomorrow, 11:00 AM', value: getTomorrowAt(11) },
    { label: 'Tomorrow, 3:00 PM', value: getTomorrowAt(15) },
  ];

  const handleDone = () => {
    if (customDateTime) {
      onSelectTime(new Date(customDateTime).toISOString());
    } else if (selectedPreset) {
      onSelectTime(selectedPreset);
    } else {
      // Default to tomorrow 9:00 AM
      onSelectTime(getTomorrowAt(9));
    }
    onClose();
  };

  return (
    <div className="absolute top-12 right-6 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
      <h3 className="text-sm font-bold text-slate-800 mb-4">Send Later</h3>

      {/* Date Time Input */}
      <div className="relative mb-4">
        <input
          type="datetime-local"
          value={customDateTime}
          onChange={(e) => {
            setCustomDateTime(e.target.value);
            setSelectedPreset(null);
          }}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
        />
        {!customDateTime && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <CalendarIcon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Quick Pick Presets */}
      <div className="space-y-1 mb-6">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              setSelectedPreset(preset.value);
              setCustomDateTime('');
            }}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition ${
              selectedPreset === preset.value
                ? 'bg-emerald-50 text-[#00a854] font-semibold'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Footer Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDone}
          className="px-5 py-1.5 rounded-full border border-[#00a854] text-[#00a854] hover:bg-[#00a854]/10 text-xs font-semibold transition"
        >
          Done
        </button>
      </div>
    </div>
  );
}
