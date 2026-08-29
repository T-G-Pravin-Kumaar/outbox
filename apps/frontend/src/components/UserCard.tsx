'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react';

export function UserCard() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const name = user?.name || 'User';
  const email = user?.email || '';
  const avatarUrl = user?.avatarUrl;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-100/70 hover:bg-slate-100 border border-slate-200/50 transition duration-150 text-left group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs">
              {name.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate leading-snug">
              {name}
            </p>
            <p className="text-[11px] text-slate-400 truncate leading-none">
              {email}
            </p>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-xs font-medium text-slate-700">{name}</p>
            <p className="text-[11px] text-slate-400 truncate">{email}</p>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition text-left"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
