'use client';

import React from 'react';
import { UserCard } from './UserCard';
import { Clock, Send } from 'lucide-react';

interface SidebarProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onComposeClick: () => void;
  scheduledCount?: number;
  sentCount?: number;
}

export function Sidebar({
  activeTab,
  onTabChange,
  onComposeClick,
  scheduledCount = 12,
  sentCount = 785,
}: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen p-4 space-y-6 select-none shrink-0">
      {/* 1. ONB / ONG Brand Wordmark */}
      <div className="px-2 pt-1">
        <h1 className="text-2xl font-black tracking-tighter text-slate-900">
          ONG
        </h1>
      </div>

      {/* 2. User Card Component */}
      <UserCard />

      {/* 3. Green Outlined Pill Compose Button */}
      <button
        onClick={onComposeClick}
        className="w-full py-2.5 px-4 rounded-full border border-[#00a854] text-[#00a854] hover:bg-[#00a854]/5 font-medium text-sm transition duration-150 flex items-center justify-center gap-2 shadow-sm"
      >
        Compose
      </button>

      {/* 4. CORE Navigation Section */}
      <div className="space-y-1">
        <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          CORE
        </p>

        {/* Scheduled Item */}
        <button
          onClick={() => onTabChange('scheduled')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition duration-150 ${
            activeTab === 'scheduled'
              ? 'bg-[#eaf7ee] text-[#00a854] font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Clock className={`w-4 h-4 ${activeTab === 'scheduled' ? 'text-[#00a854]' : 'text-slate-400'}`} />
            <span>Scheduled</span>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {scheduledCount}
          </span>
        </button>

        {/* Sent Item */}
        <button
          onClick={() => onTabChange('sent')}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition duration-150 ${
            activeTab === 'sent'
              ? 'bg-[#eaf7ee] text-[#00a854] font-semibold'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-[#00a854]' : 'text-slate-400'}`} />
            <span>Sent</span>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            {sentCount}
          </span>
        </button>
      </div>
    </aside>
  );
}
