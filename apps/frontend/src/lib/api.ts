export interface EmailRecord {
  id: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'SENT' | 'FAILED' | 'SENDING';
  scheduledAt: string;
  sentAt?: string | null;
  previewUrl?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  attachments?: Array<{
    name: string;
    size: string;
    url: string;
  }>;
  sender?: {
    id: string;
    email: string;
    displayName: string;
  };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export async function fetchEmails(status?: 'SCHEDULED' | 'SENT' | 'FAILED'): Promise<EmailRecord[]> {
  try {
    const url = status ? `${API_BASE_URL}/emails?status=${status}` : `${API_BASE_URL}/emails`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  } catch (error) {
    console.error('Failed to fetch emails:', error);
    return [];
  }
}

export async function searchEmails(query: string, status?: string): Promise<EmailRecord[]> {
  try {
    let url = `${API_BASE_URL}/emails/search?q=${encodeURIComponent(query)}`;
    if (status) url += `&status=${status}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

export async function fetchEmailById(id: string): Promise<EmailRecord | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/emails/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(`Failed to fetch email ${id}:`, error);
    return null;
  }
}

export interface SchedulePayload {
  senderId?: string;
  sender_id?: string;
  recipientEmail?: string;
  recipient_email?: string;
  subject: string;
  body: string;
  scheduledAt?: string;
  scheduled_at?: string;
  delayBetweenEmails?: number;
  hourlyLimit?: number;
}

export async function scheduleEmail(payload: SchedulePayload): Promise<EmailRecord | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/emails/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: payload.sender_id || payload.senderId || 'snd_reachinbox_growth_001',
        recipient_email: payload.recipient_email || payload.recipientEmail,
        subject: payload.subject,
        body: payload.body,
        scheduled_at: payload.scheduled_at || payload.scheduledAt || new Date().toISOString(),
        delay_between_emails: payload.delayBetweenEmails,
        hourly_limit: payload.hourlyLimit,
      }),
    });
    if (!res.ok) throw new Error(`Schedule API HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Failed to schedule email:', error);
    return null;
  }
}

export async function scheduleBatchEmails(
  recipients: string[],
  basePayload: Omit<SchedulePayload, 'recipientEmail' | 'recipient_email'>
): Promise<EmailRecord[]> {
  const results: EmailRecord[] = [];
  for (const recipient of recipients) {
    const result = await scheduleEmail({
      ...basePayload,
      recipient_email: recipient,
    });
    if (result) results.push(result);
  }
  return results;
}

export interface SenderRecord {
  id: string;
  email: string;
  displayName: string;
  isDefault: boolean;
}

export async function fetchSenders(): Promise<SenderRecord[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/senders`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data.data || [];
  } catch (error) {
    console.error('Failed to fetch senders:', error);
    return [];
  }
}

