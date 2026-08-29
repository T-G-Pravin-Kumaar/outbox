'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { SearchBar } from '../../components/SearchBar';
import { EmailRow } from '../../components/EmailRow';
import { EmailDetail } from '../../components/EmailDetail';
import { SkeletonLoader } from '../../components/SkeletonLoader';
import { EmptyState } from '../../components/EmptyState';
import { ComposeModal } from '../../components/ComposeModal';
import { ToastContainer, ToastMessage, ToastType } from '../../components/Toast';
import { fetchEmails, searchEmails, EmailRecord } from '../../lib/api';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [searchQuery, setSearchQuery] = useState('');
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [counts, setCounts] = useState({ scheduled: 0, sent: 0 });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastType, title: string, description?: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load emails based on active tab and search query
  const loadEmails = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      let data: EmailRecord[] = [];
      if (searchQuery.trim().length > 0) {
        data = await searchEmails(searchQuery, activeTab.toUpperCase());
      } else {
        data = await fetchEmails(activeTab.toUpperCase() as 'SCHEDULED' | 'SENT');
      }

      setEmails(data);

      // Fetch background total counts for badges
      const [scheduledList, sentList] = await Promise.all([
        fetchEmails('SCHEDULED'),
        fetchEmails('SENT'),
      ]);
      setCounts({
        scheduled: scheduledList.length,
        sent: sentList.length,
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [activeTab, searchQuery]);

  useEffect(() => {
    loadEmails();
    const interval = setInterval(() => {
      loadEmails(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [loadEmails]);

  return (
    <div className="flex h-screen bg-white overflow-hidden relative">
      {/* 1. Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedEmail(null);
        }}
        onComposeClick={() => setIsComposeOpen(true)}
        scheduledCount={counts.scheduled}
        sentCount={counts.sent}
      />

      {/* 2. Main Content Area: Either Detail View OR Email List */}
      <main className="flex-1 flex flex-col h-full bg-white overflow-hidden">
        {selectedEmail ? (
          <EmailDetail
            email={selectedEmail}
            onBack={() => setSelectedEmail(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col h-full p-6 space-y-6 overflow-hidden">
            {/* Top Search Bar */}
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onRefresh={loadEmails}
            />

            {/* Email Rows List Container */}
            <div className="flex-1 overflow-y-auto pr-2">
              {isLoading ? (
                <SkeletonLoader count={5} />
              ) : emails.length === 0 ? (
                <EmptyState
                  title={
                    searchQuery
                      ? `No emails found for "${searchQuery}"`
                      : activeTab === 'scheduled'
                      ? 'No scheduled emails'
                      : 'No sent emails'
                  }
                  description={
                    searchQuery
                      ? 'Try searching for a different subject, body keyword, or recipient email.'
                      : activeTab === 'scheduled'
                      ? 'You have no pending scheduled emails in your queue.'
                      : 'You have not sent any emails yet.'
                  }
                />
              ) : (
                <div className="divide-y divide-slate-100">
                  {emails.map((email) => (
                    <EmailRow
                      key={email.id}
                      email={email}
                      onClick={() => setSelectedEmail(email)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 3. Compose Email Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          setActiveTab('scheduled');
          loadEmails();
          addToast('success', 'Email Scheduled', 'Batch emails have been successfully enqueued.');
        }}
        addToast={addToast}
      />

      {/* 4. Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
