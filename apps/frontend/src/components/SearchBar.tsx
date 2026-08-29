'use client';

import React from 'react';
import { Search, Filter, RotateCw } from 'lucide-react';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh?: () => void;
}

export function SearchBar({ searchQuery, onSearchChange, onRefresh }: SearchBarProps) {
  return (
    <div className="flex items-center gap-3 w-full max-w-3xl">
      {/* Search Input Box */}
      <div className="relative flex-1">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-100/80 border border-transparent text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-slate-200 focus:outline-none transition duration-150"
        />
      </div>

      {/* Filter Icon Button */}
      <button
        type="button"
        title="Filter"
        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
      >
        <Filter className="w-4 h-4" />
      </button>

      {/* Refresh Icon Button */}
      <button
        type="button"
        title="Refresh"
        onClick={onRefresh}
        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition active:rotate-180"
      >
        <RotateCw className="w-4 h-4 transition duration-200" />
      </button>
    </div>
  );
}
