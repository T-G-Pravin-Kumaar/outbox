import { Router, Request, Response } from 'express';
import { slackService } from '../services/slack';

export const slackRouter = Router();

/**
 * GET /api/slack/connect
 * Redirects the user to Slack OAuth authorization screen.
 * Query Parameter: userId (optional, falls back to seeded demo user)
 */
slackRouter.get('/slack/connect', (req: Request, res: Response) => {
  // Use user ID from request session or query parameter.
  // Fall back to seeded developer User ID to guarantee it works out-of-the-box.
  const userId = (req.query.userId as string) || 'usr_demo_reachinbox_001';

  console.log(`[SlackRouter] Initiating Slack connection for userId: ${userId}`);

  const authUrl = slackService.getSlackAuthorizeUrl(userId);
  return res.redirect(authUrl);
});

/**
 * GET /api/slack/callback
 * Redirect handler from Slack OAuth.
 * Query Parameters: code (auth code), state (carries our userId)
 */
slackRouter.get('/slack/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('[SlackRouter] OAuth access denied by user:', error);
    return res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #0f172a; color: white;">
          <h1 style="color: #f43f5e;">Slack Connection Denied</h1>
          <p>${error}</p>
          <a href="/" style="color: #6366f1; text-decoration: none;">Return to Application</a>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send('Authorization code is missing from callback.');
  }

  // The 'state' query parameter carries the userId
  const userId = (state as string) || 'usr_demo_reachinbox_001';

  try {
    const connection = await slackService.exchangeSlackCode(String(code), userId);

    return res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #0f172a; color: white;">
          <div style="max-width: 500px; margin: 0 auto; padding: 30px; border-radius: 10px; border: 1px solid #1e293b; background: #1e293b/50;">
            <h1 style="color: #10b981;">🎉 Slack Connected!</h1>
            <p style="color: #94a3b8; font-size: 1.1em; line-height: 1.6;">
              ReachInbox Outbox has successfully linked to workspace <strong>${connection.teamName || 'Your Workspace'}</strong>.
            </p>
            <p style="color: #64748b; font-size: 0.9em;">
              Target Channel: <strong>${connection.channelName || '#general'}</strong>
            </p>
            <div style="margin-top: 30px;">
              <button onclick="window.close()" style="background: #4f46e5; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 5px; cursor: pointer; transition: background 0.2s;">
                Close Window
              </button>
            </div>
          </div>
          <script>
            setTimeout(() => {
              // Try to close window automatically
              window.close();
            }, 3000);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('[SlackRouter] Callback exchange failed:', err);
    return res.status(500).send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #0f172a; color: white;">
          <h1 style="color: #ef4444;">Slack Connection Failed</h1>
          <p style="color: #94a3b8;">${err.message || 'Internal server error during exchange'}</p>
          <a href="/" style="color: #6366f1; text-decoration: none;">Return to Application</a>
        </body>
      </html>
    `);
  }
});
