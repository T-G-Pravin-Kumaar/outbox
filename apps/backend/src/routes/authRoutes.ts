import { Router } from 'express';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';

const router = Router();

// Redirect to Google Consent Screen
router.get('/auth/google', (req, res) => {
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: config.google.callbackUrl,
    client_id: config.google.clientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  const qs = new URLSearchParams(options);
  return res.redirect(`${rootUrl}?${qs.toString()}`);
});

// OAuth Callback handler
router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('Authorization code not provided');
  }

  try {
    // Exchange code for tokens
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const values = {
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: config.google.callbackUrl,
      grant_type: 'authorization_code',
    };

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(values),
    });
    const tokens = await tokenRes.json();

    if (tokens.error) {
      console.error('[Google OAuth Callback] Token exchange failed:', tokens);
      return res.status(400).json(tokens);
    }

    // Fetch user profile info
    const profileRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokens.access_token}`
    );
    const profile = await profileRes.json();

    // Create or Update user in Database
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      update: {
        name: profile.name || 'Google User',
        avatarUrl: profile.picture || null,
        googleId: profile.sub,
      },
      create: {
        id: `usr_${Date.now()}`,
        email: profile.email,
        name: profile.name || 'Google User',
        avatarUrl: profile.picture || null,
        googleId: profile.sub,
      },
    });

    // Create or Update Sender in Database for this user
    await prisma.sender.upsert({
      where: { email: user.email },
      update: {
        displayName: user.name || 'Google User',
        userId: user.id,
        smtpUser: process.env.SMTP_USER || '',
        smtpPass: process.env.SMTP_PASS || '',
      },
      create: {
        userId: user.id,
        email: user.email,
        displayName: user.name || 'Google User',
        smtpHost: process.env.SMTP_HOST || 'smtp.ethereal.email',
        smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
        smtpUser: process.env.SMTP_USER || '',
        smtpPass: process.env.SMTP_PASS || '',
        smtpSecure: false,
        isDefault: true,
      },
    });

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
    const encodedUser = Buffer.from(JSON.stringify(userData)).toString('base64');

    // Redirect back to frontend dashboard
    return res.redirect(`${config.frontendUrl}/dashboard?user=${encodedUser}`);
  } catch (err: any) {
    console.error('[Google OAuth Callback] Error:', err);
    return res.redirect(`${config.frontendUrl}/login?error=oauth_failed`);
  }
});

export const authRouter = router;
