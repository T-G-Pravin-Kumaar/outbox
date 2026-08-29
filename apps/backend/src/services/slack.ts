import { prisma } from '../lib/prisma';
import { config } from '../config/env';

/**
 * Service to handle Slack OAuth and send Slack notifications.
 */
export const slackService = {
  /**
   * Generates the Slack OAuth v2 authorization URL.
   * State is used to pass the userId securely to the callback.
   */
  getSlackAuthorizeUrl(userId: string): string {
    const clientId = config.slack.clientId;
    const redirectUri = encodeURIComponent(config.slack.redirectUri);
    // Request incoming-webhook (creates a webhook) and chat:write (allows posting messages)
    const scopes = 'incoming-webhook,chat:write';
    
    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${userId}`;
  },

  /**
   * Exchange the temporary authorization code for Slack credentials.
   * Persists the token and webhook details in the slack_connections table.
   */
  async exchangeSlackCode(code: string, userId: string): Promise<any> {
    const clientId = config.slack.clientId;
    const clientSecret = config.slack.clientSecret;
    const redirectUri = config.slack.redirectUri;

    console.log(`[SlackService] Exchanging code for userId: ${userId}`);

    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const data: any = await response.json();

    if (!response.ok || !data.ok) {
      console.error('[SlackService] Exchange failed:', data);
      throw new Error(data.error || 'Failed to exchange authorization code');
    }

    const teamId = data.team?.id;
    const teamName = data.team?.name;
    const accessToken = data.access_token;
    const botUserId = data.bot_user_id;
    
    // Extract incoming webhook if authorized
    const channelId = data.incoming_webhook?.channel_id || null;
    const channelName = data.incoming_webhook?.channel || null;
    const webhookUrl = data.incoming_webhook?.url || null;

    if (!teamId || !accessToken) {
      throw new Error('Slack OAuth response did not contain required credentials');
    }

    // Persist/Update the connection details
    const connection = await prisma.slackConnection.upsert({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
      update: {
        teamName,
        accessToken,
        botUserId,
        channelId,
        channelName,
        webhookUrl,
        updatedAt: new Date(),
      },
      create: {
        userId,
        teamId,
        teamName,
        accessToken,
        botUserId,
        channelId,
        channelName,
        webhookUrl,
      },
    });

    console.log(`[SlackService] Successfully stored Slack connection in DB for userId: ${userId}, team: ${teamName}`);
    return connection;
  },

  /**
   * Sends a message to a user's configured Slack workspace.
   * Tries to use the Incoming Webhook if available, falls back to chat.postMessage API.
   * Returns true on success, false if skipped or errored.
   */
  async sendSlackNotification(userId: string, message: string): Promise<boolean> {
    try {
      const connection = await prisma.slackConnection.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });

      if (!connection) {
        // Skip silently as per SPEC: "If no connection exists, skip silently — do not throw or crash."
        return false;
      }

      // 1. Prefer Webhook if configured
      if (connection.webhookUrl) {
        console.log(`[SlackService] Sending notification via webhook for userId: ${userId}`);
        const res = await fetch(connection.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: message }),
        });

        if (res.ok) {
          console.log(`[SlackService] Webhook notification sent successfully`);
          return true;
        }
        
        console.warn(`[SlackService] Webhook post failed, attempting bot token fallback. Status: ${res.status}`);
      }

      // 2. Fall back to chat.postMessage API using Bot Access Token
      if (connection.accessToken) {
        const channel = connection.channelId || '#general';
        console.log(`[SlackService] Sending notification via chat.postMessage to channel ${channel} for userId: ${userId}`);

        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${connection.accessToken}`,
          },
          body: JSON.stringify({
            channel,
            text: message,
          }),
        });

        const data: any = await res.json();
        if (res.ok && data.ok) {
          console.log(`[SlackService] chat.postMessage notification sent successfully`);
          return true;
        }

        console.error(`[SlackService] chat.postMessage API failed:`, data.error || data);
      }

      return false;
    } catch (err: any) {
      // Catch error so we never crash worker or API process
      console.error(`[SlackService] Error sending Slack notification:`, err.message);
      return false;
    }
  },
};
