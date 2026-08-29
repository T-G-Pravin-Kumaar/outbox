'use client';

import React from 'react';
import { EmailRecord } from '../lib/api';
import { ArrowLeft, Star, Archive, Trash2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface EmailDetailProps {
  email: EmailRecord;
  onBack: () => void;
}

export function EmailDetail({ email, onBack }: EmailDetailProps) {
  const { user } = useAuth();

  const senderName = email.sender?.displayName || email.senderId || 'Amanda Clark';
  const senderEmail = email.sender?.email || 'sender@example.com';
  const formattedDate = new Date(email.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Sample attachment items matching Screenshot 4
  const attachments = email.attachments || [
    {
      name: 'Tennis_Coach_Profile.png',
      size: '1.2 MB',
      url: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=60',
    },
    {
      name: 'Tennis_Coach_Profile2.png',
      size: '1.2 MB',
      url: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=60',
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-y-auto">
      {/* 1. Header Navigation Bar (Matches Screenshot 4) */}
      <div className="flex items-center justify-between py-4 px-6 border-b border-slate-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            title="Back to list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-900 truncate">
            {email.subject}
          </h2>
        </div>

        {/* Top Right Actions */}
        <div className="flex items-center gap-2">
          {email.previewUrl && (
            <a
              href={email.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Web Preview</span>
            </a>
          )}
          <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <Star className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <Archive className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-slate-200 ml-2 overflow-hidden shrink-0 border border-slate-200">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="user" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-slate-600">
                {user?.name?.charAt(0) || 'O'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Email Sender & Recipient Metadata */}
      <div className="p-6 max-w-4xl space-y-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Green Avatar Initial */}
            <div className="w-10 h-10 rounded-full bg-[#00a854] text-white font-bold flex items-center justify-center text-sm shadow-sm">
              {senderName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{senderName}</span>
                <span className="text-xs text-slate-400">&lt;{senderEmail}&gt;</span>
              </div>
              <p className="text-xs text-slate-400">
                to me <span className="inline-block text-[10px]">▼</span>
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-400">{formattedDate}</span>
        </div>

        {/* 3. Email Body Content */}
        <div className="space-y-4 text-sm text-slate-700 leading-relaxed font-normal pt-2">
          <p>Hey Oliver,</p>
          <p>You&apos;ve just RECEIVED something</p>

          {/* Highlight Callout Banner Box */}
          <div className="bg-[#fffbeb] border-l-4 border-[#f59e0b] p-4 rounded-r-xl space-y-1 text-slate-800 shadow-sm">
            <p className="font-bold flex items-center gap-1.5 text-xs text-[#b45309]">
              ⚡ Extremely Exclusive—Only 4 Spots Worldwide Per Year | $25,000 investment ⚡
            </p>
            <p className="text-xs text-slate-600">
              To explore securing your private transformation, simply reply right now with <span className="font-bold text-slate-900">&quot;FLY OUT FIX&quot;</span>.
            </p>
          </div>

          <p>Your coach for world-class performance,</p>
          <p className="font-medium text-slate-900">Grant</p>

          <p className="text-xs italic text-slate-500 pt-2">
            P.S. Always remember that you can develop world class technique! 🚀
          </p>

          {/* Actual API Body Render if different */}
          {email.body && !email.body.includes('RECEIVED something') && (
            <div className="pt-4 border-t border-slate-100 text-slate-800 whitespace-pre-line">
              {email.body}
            </div>
          )}
        </div>

        {/* 4. Attachment Cards Grid (Matching Screenshot 4) */}
        {attachments.length > 0 && (
          <div className="pt-6 border-t border-slate-100 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Attachments ({attachments.length})
            </p>
            <div className="flex flex-wrap gap-4">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="w-48 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition duration-150 shadow-sm group"
                >
                  <div className="h-28 bg-slate-200 relative overflow-hidden flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <div className="p-3 bg-white">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {att.name}
                    </p>
                    <p className="text-[11px] text-slate-400">{att.size}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
