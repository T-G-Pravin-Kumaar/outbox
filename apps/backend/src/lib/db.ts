import { prisma } from './prisma';
import { redisClient } from './redis';
import { EmailStatus } from '@prisma/client';
import { searchService } from '../services/search';

export interface CreateEmailDTO {
  id?: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  idempotencyKey: string;
  bullmqJobId?: string;
  metadata?: Record<string, any>;
}

export interface EmailFilterDTO {
  status?: string;
  senderId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// Timeout helper to guarantee fast responses
function withTimeout<T>(promise: Promise<T>, timeoutMs = 1500): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Seed default senders
const defaultUser = {
  id: 'usr_demo_reachinbox_001',
  email: 'demo@reachinbox.ai',
  name: 'Pravin Kumar (ReachInbox Demo)',
  googleId: 'google_oauth_demo_123456789',
  avatarUrl: 'https://lh3.googleusercontent.com/a/default-user',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const defaultSenders = [
  {
    id: 'snd_reachinbox_growth_001',
    userId: defaultUser.id,
    email: 'growth@reachinbox-outbox.io',
    displayName: 'Growth Team (ReachInbox)',
    smtpHost: 'smtp.ethereal.email',
    smtpPort: 587,
    smtpUser: 'growth.ethereal@reachinbox.ai',
    smtpPass: 'ethereal_growth_pass_secure',
    smtpSecure: false,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'snd_reachinbox_updates_002',
    userId: defaultUser.id,
    email: 'alex.updates@reachinbox-outbox.io',
    displayName: 'Alex Rivers (Product Updates)',
    smtpHost: 'smtp.ethereal.email',
    smtpPort: 587,
    smtpUser: 'alex.ethereal@reachinbox.ai',
    smtpPass: 'ethereal_alex_pass_secure',
    smtpSecure: false,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'snd_reachinbox_support_003',
    userId: defaultUser.id,
    email: 'support@reachinbox-outbox.io',
    displayName: 'Outbox Customer Support',
    smtpHost: 'smtp.ethereal.email',
    smtpPort: 587,
    smtpUser: 'support.ethereal@reachinbox.ai',
    smtpPass: 'ethereal_support_pass_secure',
    smtpSecure: false,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Helper to interact with Redis shared state
async function setRedisJson(key: string, data: any) {
  try {
    await redisClient.set(key, JSON.stringify(data));
  } catch (err) {
    // ignore
  }
}

async function getRedisJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const dbService = {
  // Senders
  async listSenders() {
    try {
      return await withTimeout(
        prisma.sender.findMany({
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        })
      );
    } catch {
      const cached = await getRedisJson<any[]>('outbox:senders');
      if (cached && cached.length > 0) return cached;
      await setRedisJson('outbox:senders', defaultSenders);
      return defaultSenders;
    }
  },

  async findSenderById(id: string) {
    try {
      const sender = await withTimeout(prisma.sender.findUnique({ where: { id } }));
      if (sender) return sender;
      const senders = await this.listSenders();
      return senders.find((s) => s.id === id) || null;
    } catch {
      const senders = await this.listSenders();
      return senders.find((s) => s.id === id) || null;
    }
  },

  async findDefaultSender() {
    try {
      const sender = await withTimeout(
        prisma.sender.findFirst({
          where: { isDefault: true },
        })
      );
      if (sender) return sender;
      const anySender = await withTimeout(prisma.sender.findFirst());
      if (anySender) return anySender;
      const list = await this.listSenders();
      return list.find((s) => s.isDefault) || list[0] || null;
    } catch {
      const list = await this.listSenders();
      return list.find((s) => s.isDefault) || list[0] || null;
    }
  },

  // Emails
  async createEmail(data: CreateEmailDTO) {
    const id = data.id || `eml_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const emailRecord = {
      id,
      senderId: data.senderId,
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      body: data.body,
      status: EmailStatus.SCHEDULED,
      scheduledAt: data.scheduledAt.toISOString(),
      sentAt: null,
      bullmqJobId: data.bullmqJobId || null,
      idempotencyKey: data.idempotencyKey,
      errorMessage: null,
      previewUrl: null,
      metadata: data.metadata || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Store in Redis shared state across all processes
    await setRedisJson(`outbox:email:${id}`, emailRecord);
    await setRedisJson(`outbox:email:idem:${data.idempotencyKey}`, emailRecord);
    await redisClient.sadd('outbox:email_ids', id);

    try {
      const created = await withTimeout(
        prisma.email.create({
          where: undefined, // Fix typings if needed, but not present in prisma.create
          data: {
            id: emailRecord.id,
            senderId: emailRecord.senderId,
            recipientEmail: emailRecord.recipientEmail,
            subject: emailRecord.subject,
            body: emailRecord.body,
            status: EmailStatus.SCHEDULED,
            scheduledAt: data.scheduledAt,
            idempotencyKey: emailRecord.idempotencyKey,
            bullmqJobId: emailRecord.bullmqJobId,
            metadata: (emailRecord.metadata as any) || undefined,
          },
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        } as any)
      );
      searchService.indexEmailDoc(created).catch(() => {});
      return created;
    } catch (err) {
      const sender = await this.findSenderById(emailRecord.senderId);
      const fallbackResult = {
        ...emailRecord,
        sender: sender
          ? { id: sender.id, email: sender.email, displayName: sender.displayName }
          : null,
      };
      searchService.indexEmailDoc(fallbackResult).catch(() => {});
      return fallbackResult;
    }
  },

  async findEmailById(id: string) {
    try {
      const email = await withTimeout(
        prisma.email.findUnique({
          where: { id },
          include: { sender: true },
        })
      );
      if (email) return email;
      const cached = await getRedisJson<any>(`outbox:email:${id}`);
      if (!cached) return null;
      const sender = await this.findSenderById(cached.senderId);
      return { ...cached, sender: sender || null };
    } catch {
      const cached = await getRedisJson<any>(`outbox:email:${id}`);
      if (!cached) return null;
      const sender = await this.findSenderById(cached.senderId);
      return { ...cached, sender: sender || null };
    }
  },

  async findEmailByIdempotencyKey(idempotencyKey: string) {
    try {
      const email = await withTimeout(
        prisma.email.findUnique({
          where: { idempotencyKey },
          include: { sender: true },
        })
      );
      if (email) return email;
      const cached = await getRedisJson<any>(`outbox:email:idem:${idempotencyKey}`);
      if (!cached) return null;
      const sender = await this.findSenderById(cached.senderId);
      return { ...cached, sender: sender || null };
    } catch {
      const cached = await getRedisJson<any>(`outbox:email:idem:${idempotencyKey}`);
      if (!cached) return null;
      const sender = await this.findSenderById(cached.senderId);
      return { ...cached, sender: sender || null };
    }
  },

  async updateEmailStatus(
    id: string,
    updateData: {
      status: EmailStatus;
      sentAt?: Date;
      bullmqJobId?: string;
      errorMessage?: string;
      previewUrl?: string;
    }
  ) {
    const existing = await getRedisJson<any>(`outbox:email:${id}`);
    let updatedRecord: any = null;
    if (existing) {
      updatedRecord = {
        ...existing,
        status: updateData.status,
        sentAt: updateData.sentAt ? updateData.sentAt.toISOString() : existing.sentAt,
        bullmqJobId: updateData.bullmqJobId ?? existing.bullmqJobId,
        errorMessage: updateData.errorMessage ?? existing.errorMessage,
        previewUrl: updateData.previewUrl ?? existing.previewUrl,
        updatedAt: new Date().toISOString(),
      };
      await setRedisJson(`outbox:email:${id}`, updatedRecord);
      if (existing.idempotencyKey) {
        await setRedisJson(`outbox:email:idem:${existing.idempotencyKey}`, updatedRecord);
      }
    }

    try {
      const updated = await withTimeout(
        prisma.email.update({
          where: { id },
          data: {
            status: updateData.status,
            sentAt: updateData.sentAt,
            bullmqJobId: updateData.bullmqJobId,
            errorMessage: updateData.errorMessage,
            previewUrl: updateData.previewUrl,
            updatedAt: new Date(),
          },
          include: { sender: true },
        })
      );
      searchService.indexEmailDoc(updated).catch(() => {});
      return updated;
    } catch {
      if (updatedRecord) {
        const sender = await this.findSenderById(updatedRecord.senderId);
        const fallbackResult = { ...updatedRecord, sender: sender || null };
        searchService.indexEmailDoc(fallbackResult).catch(() => {});
        return fallbackResult;
      }
      return null;
    }
  },

  async listEmails(filters: EmailFilterDTO = {}) {
    try {
      const where: any = {};
      if (filters.status) {
        where.status = filters.status.toUpperCase() as EmailStatus;
      }
      if (filters.senderId) {
        where.senderId = filters.senderId;
      }
      if (filters.search) {
        where.OR = [
          { recipientEmail: { contains: filters.search, mode: 'insensitive' } },
          { subject: { contains: filters.search, mode: 'insensitive' } },
          { body: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      return await withTimeout(
        prisma.email.findMany({
          where,
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
          orderBy: { scheduledAt: 'desc' },
          take: filters.limit || 100,
          skip: filters.offset || 0,
        })
      );
    } catch {
      const allIds = await redisClient.smembers('outbox:email_ids');
      const all: any[] = [];
      for (const id of allIds) {
        const item = await getRedisJson<any>(`outbox:email:${id}`);
        if (item) all.push(item);
      }

      let filtered = all;
      if (filters.status) {
        filtered = filtered.filter(
          (e) => e.status.toUpperCase() === filters.status?.toUpperCase()
        );
      }
      if (filters.senderId) {
        filtered = filtered.filter((e) => e.senderId === filters.senderId);
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.recipientEmail?.toLowerCase().includes(s) ||
            e.subject?.toLowerCase().includes(s) ||
            e.body?.toLowerCase().includes(s)
        );
      }

      filtered.sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      );

      const senders = await this.listSenders();
      const senderMap = new Map(senders.map((s) => [s.id, s]));

      return filtered.map((e) => {
        const sender = senderMap.get(e.senderId);
        return {
          ...e,
          sender: sender
            ? {
                id: sender.id,
                email: sender.email,
                displayName: sender.displayName,
              }
            : null,
        };
      });
    }
  },
};
