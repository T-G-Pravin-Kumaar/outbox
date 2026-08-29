'use client';

import React from 'react';
import { EmailRecord } from '../lib/api';
import { Clock, Star, ExternalLink } from 'lucide-react';

interface EmailRowProps {
  email: EmailRecord;
  onClick: () => void;
}

export function EmailRow({ email, onClick }: EmailRowProps) {
  // Format date for display (e.g., "Tue 9:15:12 AM" or ISO fallback)
  const formatScheduledTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const day = days[d.getDay()];
      const time = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      return `${day} ${time}`;
    } catch {
      return dateStr;
    }
  };

  const isScheduled = email.status === 'SCHEDULED' || email.status === 'SENDING';
  const recipientName = email.recipientEmail.split('@')[0];

  return (
    <div
      onClick={onClick}
      className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-xl transition duration-150 group cursor-pointer border-b border-slate-50 last:border-b-0"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Recipient */}
        <div className="w-36 shrink-0 text-xs font-bold text-slate-800 truncate">
          To: {recipientName}
        </div>

        {/* Status / Scheduled Time Badge */}
        {isScheduled ? (
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#fef3c7] border border-[#fde68a] text-[#b45309] text-[11px] font-semibold shrink-0">
            <Clock className="w-3 h-3 text-[#d97706]" />
            <span>{formatScheduledTime(email.scheduledAt)}</span>
          </div>
        ) : email.status === 'SENT' ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium shrink-0">
            <span>Sent</span>
            {email.previewUrl && (
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="View Ethereal Web Preview"
                className="text-slate-400 hover:text-emerald-600 transition"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[11px] font-medium shrink-0">
            Failed
          </div>
        )}

        {/* Subject & Body Snippet */}
        <div className="min-w-0 truncate text-xs flex-1">
          <span className="font-semibold text-slate-800 mr-1.5">
            {email.subject}
          </span>
          <span className="text-slate-400 font-normal">
            - {email.body.replace(/<[^>]*>?/gm, '')}
          </span>
        </div>
      </div>

      {/* Star Action */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
        }}
        className="p-1 text-slate-300 hover:text-amber-400 transition ml-2 shrink-0"
      >
        <Star className="w-4 h-4" />
      </button>
    </div>
  );
}
