import { Request, Response } from 'express';
import { config } from '../config/index.js';
import { prisma } from '../config/database.js';
import { generateToken } from '../middlewares/auth.middleware.js';
import { createGitHubService } from '../services/github.service.js';
import { AuthenticatedRequest, ApiResponse } from '../types/index.js';
import { AppError } from '../utils/errors.js';
import { ErrorCode } from '../types/index.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// Encryption helpers for storing tokens
const ENCRYPTION_KEY = crypto.scryptSync(
  config.jwt.secret,
  'salt',
  32
);
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Initiate GitHub OAuth flow
export async function initiateGitHubAuth(
  req: Request,
  res: Response
): Promise<void> {
  const state = crypto.randomBytes(16).toString('hex');

  // Store state in session/cookie for verification
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: config.isProduction,
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'user:email repo read:org',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

// Handle GitHub OAuth callback
export async function handleGitHubCallback(
  req: Request,
  res: Response<ApiResponse>
): Promise<void> {
  const { code, state } = req.query;
  const storedState = req.cookies?.oauth_state;

  // Verify state
  if (!state || state !== storedState) {
    throw new AppError(
      'Invalid OAuth state',
      400,
      ErrorCode.GITHUB_AUTH_FAILED
    );
  }

  if (!code || typeof code !== 'string') {
    throw new AppError(
      'No authorization code provided',
      400,
      ErrorCode.GITHUB_AUTH_FAILED
    );
  }

  // Exchange code for access token
  const tokenResponse = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
      }),
    }
  );

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    logger.error('GitHub token exchange failed', { error: tokenData.error });
    throw new AppError(
      tokenData.error_description || 'Failed to exchange code for token',
      400,
      ErrorCode.GITHUB_AUTH_FAILED
    );
  }

  const { access_token, refresh_token } = tokenData;

  // Get user info from GitHub
  const githubService = createGitHubService(access_token);
  const githubUser = await githubService.getUser();

  // Upsert user in database
  const user = await prisma.user.upsert({
    where: { githubId: String(githubUser.id) },
    update: {
      username: githubUser.login,
      email: githubUser.email,
      avatarUrl: githubUser.avatar_url,
      accessToken: encrypt(access_token),
      refreshToken: refresh_token ? encrypt(refresh_token) : null,
      lastLoginAt: new Date(),
    },
    create: {
      githubId: String(githubUser.id),
      username: githubUser.login,
      email: githubUser.email,
      avatarUrl: githubUser.avatar_url,
      accessToken: encrypt(access_token),
      refreshToken: refresh_token ? encrypt(refresh_token) : null,
    },
  });

  // Generate JWT
  const token = generateToken({
    id: user.id,
    githubId: user.githubId,
    username: user.username,
    email: user.email ?? undefined,
  });

  // Clear OAuth state cookie
  res.clearCookie('oauth_state');

  // Redirect to frontend with token
  res.redirect(`${config.frontendUrl}/auth/callback?token=${token}`);
}

// Get current user
export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      githubId: true,
      username: true,
      email: true,
      avatarUrl: true,
      defaultLlmProvider: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  res.json({
    success: true,
    data: user,
  });
}

// Logout (client-side token removal, but we can track it)
export async function logout(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  // In a stateless JWT system, logout is handled client-side
  // But we can update lastLoginAt or track revoked tokens if needed

  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
}

// Update user preferences
export async function updateUserPreferences(
  req: AuthenticatedRequest,
  res: Response<ApiResponse>
): Promise<void> {
  const { defaultLlmProvider } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      defaultLlmProvider,
    },
    select: {
      id: true,
      username: true,
      defaultLlmProvider: true,
    },
  });

  res.json({
    success: true,
    data: user,
  });
}

// Helper to get decrypted access token for a user
export async function getUserAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessToken: true },
  });

  if (!user) {
    throw new AppError('User not found', 404, ErrorCode.NOT_FOUND);
  }

  return decrypt(user.accessToken);
}

// Login with Personal Access Token (PAT)
export async function loginWithToken(
  req: Request,
  res: Response<ApiResponse>
): Promise<void> {
  const { token } = req.body;

  if (!token || typeof token !== 'string') {
    throw new AppError(
      'Personal Access Token is required',
      400,
      ErrorCode.VALIDATION_ERROR
    );
  }

  // Validate token with GitHub API
  const githubService = createGitHubService(token);

  let githubUser;
  try {
    githubUser = await githubService.getUser();
  } catch (error) {
    logger.error('Invalid GitHub token', { error });
    throw new AppError(
      'Invalid GitHub Personal Access Token',
      401,
      ErrorCode.GITHUB_AUTH_FAILED
    );
  }

  // Upsert user in database
  const user = await prisma.user.upsert({
    where: { githubId: String(githubUser.id) },
    update: {
      username: githubUser.login,
      email: githubUser.email,
      avatarUrl: githubUser.avatar_url,
      accessToken: encrypt(token),
      lastLoginAt: new Date(),
    },
    create: {
      githubId: String(githubUser.id),
      username: githubUser.login,
      email: githubUser.email,
      avatarUrl: githubUser.avatar_url,
      accessToken: encrypt(token),
    },
  });

  // Generate JWT
  const jwtToken = generateToken({
    id: user.id,
    githubId: user.githubId,
    username: user.username,
    email: user.email ?? undefined,
  });

  res.json({
    success: true,
    data: {
      token: jwtToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    },
  });
}
