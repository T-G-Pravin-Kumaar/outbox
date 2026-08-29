'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Paperclip, Clock } from 'lucide-react';
import { RecipientInput } from './RecipientInput';
import { RichTextEditor } from './RichTextEditor';
import { SendLaterPopover } from './SendLaterPopover';
import { scheduleBatchEmails, fetchSenders, SenderRecord } from '../lib/api';
import { useAuth } from '../context/AuthContext';

import { ToastType } from './Toast';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  addToast?: (type: ToastType, title: string, description?: string) => void;
}

export function ComposeModal({ isOpen, onClose, onSuccess, addToast }: ComposeModalProps) {
  const { user } = useAuth();
  const [senders, setSenders] = useState<SenderRecord[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawInput, setRawInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState<string>('00');
  const [hourlyLimit, setHourlyLimit] = useState<string>('00');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentCount] = useState(1);

  useEffect(() => {
    if (isOpen) {
      fetchSenders().then((data) => {
        setSenders(data);
        const defaultSender = data.find((s) => s.isDefault) || data[0];
        if (defaultSender) {
          setSelectedSenderId(defaultSender.id);
          setSenderEmail(defaultSender.email);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    // Combine raw input if present
    let targetRecipients = [...recipients];
    if (rawInput.trim() && !targetRecipients.includes(rawInput.trim())) {
      targetRecipients.push(rawInput.trim());
    }

    if (targetRecipients.length === 0) {
      if (addToast) addToast('error', 'Validation Error', 'Please specify at least one recipient email address.');
      else alert('Please specify at least one recipient email address.');
      return;
    }

    if (!subject.trim()) {
      if (addToast) addToast('error', 'Validation Error', 'Please enter an email subject.');
      else alert('Please enter an email subject.');
      return;
    }

    setIsSubmitting(true);
    try {
      const delayNum = parseInt(delayBetweenEmails, 10) || 0;
      const limitNum = parseInt(hourlyLimit, 10) || 0;

      await scheduleBatchEmails(targetRecipients, {
        senderId: selectedSenderId || 'snd_reachinbox_growth_001',
        subject: subject,
        body: body || 'Hello from ReachInbox Outbox Email Scheduler!',
        scheduledAt: scheduledAt || new Date().toISOString(),
        delayBetweenEmails: delayNum,
        hourlyLimit: limitNum,
      });

      if (addToast) addToast('success', 'Batch Scheduled', `Successfully scheduled ${targetRecipients.length} email(s)!`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error submitting batch schedule:', err);
      if (addToast) addToast('error', 'Schedule Error', 'Failed to schedule emails. Please check backend connection.');
      else alert('Failed to schedule emails. Please check backend connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative">
        {/* 1. Header Navigation Bar (Matches Screenshots 5, 6, 7) */}
        <div className="flex items-center justify-between py-4 px-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-800">
              Compose New Email
            </h2>
          </div>

          {/* Top Right Action Tools */}
          <div className="flex items-center gap-3 relative">
            {/* Attachment Paperclip Button */}
            <button
              type="button"
              className="flex items-center gap-1 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Attach File"
            >
              <Paperclip className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-bold text-slate-400">
                {attachmentCount}
              </span>
            </button>

            {/* Clock Icon (Toggles Send Later Popover) */}
            <button
              type="button"
              onClick={() => setIsPopoverOpen(!isPopoverOpen)}
              className={`p-2 rounded-xl transition ${
                scheduledAt
                  ? 'text-[#00a854] bg-emerald-50'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="Schedule Time"
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Main Action Button (Send / Send Later) */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSend}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold transition shadow-xs ${
                scheduledAt
                  ? 'bg-white border border-[#00a854] text-[#00a854] hover:bg-emerald-50'
                  : 'bg-[#00a854] text-white hover:bg-emerald-600'
              }`}
            >
              {isSubmitting
                ? 'Submitting...'
                : scheduledAt
                ? 'Send Later'
                : 'Send'}
            </button>

            {/* Send Later Popover */}
            <SendLaterPopover
              isOpen={isPopoverOpen}
              onClose={() => setIsPopoverOpen(false)}
              onSelectTime={(timeStr) => {
                setScheduledAt(timeStr);
                setIsPopoverOpen(false);
              }}
            />
          </div>
        </div>

        {/* 2. Scrollable Compose Form Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* From Sender Dropdown */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">
              From
            </span>
            <select
              value={selectedSenderId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedSenderId(id);
                const s = senders.find((x) => x.id === id);
                if (s) setSenderEmail(s.email);
              }}
              className="bg-slate-100/80 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 border border-slate-200/50 focus:outline-none"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName} ({s.email})
                </option>
              ))}
            </select>
          </div>

          {/* To Recipient Input + CSV List Upload */}
          <RecipientInput
            recipients={recipients}
            setRecipients={setRecipients}
            rawInput={rawInput}
            setRawInput={setRawInput}
          />

          {/* Subject Field */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">
              Subject
            </span>
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full text-xs text-slate-800 placeholder-slate-300 bg-transparent focus:outline-none"
            />
          </div>

          {/* Throttling Numeric Inputs (Delay between 2 emails & Hourly Limit) */}
          <div className="flex items-center gap-6 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">
                Delay between 2 emails
              </span>
              <input
                type="number"
                min="0"
                placeholder="00"
                value={delayBetweenEmails}
                onChange={(e) => setDelayBetweenEmails(e.target.value)}
                className="w-16 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-700 font-semibold focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">
                Hourly Limit
              </span>
              <input
                type="number"
                min="0"
                placeholder="00"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className="w-16 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-700 font-semibold focus:outline-none"
              />
            </div>
          </div>

          {/* Rich Text Toolbar & Body Area */}
          <RichTextEditor body={body} setBody={setBody} />

          {/* Attached Image Thumbnail Card (Matching Screenshots 6 & 7) */}
          <div className="pt-2">
            <div className="w-36 h-24 rounded-2xl overflow-hidden border border-slate-200 shadow-xs relative">
              <img
                src="https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=300&auto=format&fit=crop&q=60"
                alt="Tennis Athlete Attachment"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
