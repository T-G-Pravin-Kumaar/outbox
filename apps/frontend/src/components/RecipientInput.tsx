'use client';

import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

interface RecipientInputProps {
  recipients: string[];
  setRecipients: (emails: string[]) => void;
  rawInput: string;
  setRawInput: (text: string) => void;
}

export function RecipientInput({
  recipients,
  setRecipients,
  rawInput,
  setRawInput,
}: RecipientInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email regex validation rule
  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // CSV / TXT / JSON File Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      // Extract emails using regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = content.match(emailRegex) || [];

      // Filter and validate emails
      const validEmails: string[] = [];
      let skippedCount = 0;

      matches.forEach((email) => {
        const clean = email.trim().toLowerCase();
        if (validateEmail(clean)) {
          if (!validEmails.includes(clean)) {
            validEmails.push(clean);
          }
        } else {
          skippedCount++;
        }
      });

      if (validEmails.length > 0) {
        setRecipients(validEmails);
        alert(
          `✅ Parsed ${validEmails.length} valid email address(es).${
            skippedCount > 0 ? ` (${skippedCount} invalid rows skipped)` : ''
          }`
        );
      } else {
        alert('⚠️ No valid email addresses found in the uploaded file.');
      }
    };

    reader.readAsText(file);
    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const visibleRecipients = recipients.slice(0, 3);
  const overflowCount = recipients.length > 3 ? recipients.length - 3 : 0;

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3">
      <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">To</span>

      <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
        {recipients.length > 0 ? (
          /* Render Pill Chips (Matching Screenshot 7) */
          <div className="flex items-center gap-2 flex-wrap">
            {visibleRecipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center px-3 py-1 rounded-full bg-[#eaf7ee] border border-emerald-300 text-[#00a854] text-xs font-medium shadow-xs"
              >
                {email}
              </span>
            ))}
            {overflowCount > 0 && (
              <span
                title={recipients.slice(3).join(', ')}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#eaf7ee] border border-emerald-300 text-[#00a854] text-xs font-bold shadow-xs cursor-pointer hover:bg-emerald-100 transition"
              >
                +{overflowCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => setRecipients([])}
              className="text-[11px] text-slate-400 hover:text-rose-500 ml-1 underline"
            >
              Clear
            </button>
          </div>
        ) : (
          /* Plain Text Input (Matching Screenshot 6) */
          <input
            type="text"
            placeholder="recipient@example.com"
            value={rawInput}
            onChange={(e) => {
              setRawInput(e.target.value);
              const text = e.target.value;
              if (text.includes(',') || text.includes(' ')) {
                const parts = text.split(/[\s,]+/).filter(Boolean);
                const valid = parts.filter(validateEmail);
                if (valid.length > 0) {
                  setRecipients(valid);
                  setRawInput('');
                }
              }
            }}
            onBlur={() => {
              if (rawInput.trim() && validateEmail(rawInput)) {
                setRecipients([rawInput.trim()]);
                setRawInput('');
              }
            }}
            className="w-full text-xs text-slate-800 placeholder-slate-300 bg-transparent focus:outline-none"
          />
        )}
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,.txt,.json"
        className="hidden"
      />

      {/* Upload List Action Button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#00a854] hover:text-emerald-700 transition shrink-0"
      >
        <Upload className="w-3.5 h-3.5" />
        <span>Upload List</span>
      </button>
    </div>
  );
}
