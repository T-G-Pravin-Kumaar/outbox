'use client';

import React from 'react';

export function SkeletonLoader({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-slate-100 animate-pulse w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="py-3.5 px-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Recipient Skeleton */}
            <div className="w-32 h-4 bg-slate-200 rounded-md shrink-0"></div>
            {/* Badge Skeleton */}
            <div className="w-24 h-5 bg-slate-200 rounded-full shrink-0"></div>
            {/* Text Snippet Skeleton */}
            <div className="h-4 bg-slate-200 rounded-md flex-1 min-w-0"></div>
          </div>
          {/* Star Icon Skeleton */}
          <div className="w-4 h-4 bg-slate-200 rounded-full shrink-0"></div>
        </div>
      ))}
    </div>
  );
}
