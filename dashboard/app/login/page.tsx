'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  not_in_guild: 'You must be a member of the Every Nation server to access this dashboard.',
  insufficient_permissions: 'You do not have the required admin role to access this dashboard.',
  auth_failed: 'Authentication failed. Please try again.',
  OAuthSignin: 'Could not start the sign-in flow. Please try again.',
  OAuthCallback: 'OAuth callback error. Please try again.',
};

function LoginContent() {
  const params = useSearchParams();
  const error = params.get('error') || '';
  const errorMessage = ERROR_MESSAGES[error];

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🏰</div>
        <h1 className="login-title">ENOS Dashboard</h1>
        <p className="login-subtitle">
          Every Nation — Bot Configuration Panel<br />
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Admin access required
          </span>
        </p>

        {errorMessage && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--danger)',
              fontSize: '0.8125rem',
              lineHeight: '1.5',
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        <button
          className="discord-btn"
          onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
          id="discord-login-btn"
        >
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
            <path
              d="M18.59 1.35C17.18.67 15.66.18 14.07 0c-.22.38-.42.77-.6 1.17C11.9.99 10.34.99 8.77 1.17A9.4 9.4 0 0 0 8.17 0C6.58.18 5.06.67 3.64 1.35A15.8 15.8 0 0 0 .7 12.47c1.68 1.21 3.3 1.95 4.9 2.43.39-.54.74-1.11 1.05-1.7a9.7 9.7 0 0 1-1.65-.8c.14-.1.27-.2.4-.31a11.24 11.24 0 0 0 9.52 0c.13.11.26.21.4.31a9.77 9.77 0 0 1-1.66.8c.31.6.66 1.17 1.05 1.7 1.6-.48 3.23-1.22 4.9-2.43A15.8 15.8 0 0 0 18.6 1.35ZM7.34 10.27c-.88 0-1.6-.8-1.6-1.78 0-.98.7-1.79 1.6-1.79.9 0 1.61.81 1.6 1.79 0 .98-.7 1.78-1.6 1.78Zm5.57 0c-.88 0-1.6-.8-1.6-1.78 0-.98.7-1.79 1.6-1.79.9 0 1.61.81 1.6 1.79 0 .98-.7 1.78-1.6 1.78Z"
              fill="white"
            />
          </svg>
          Continue with Discord
        </button>

        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            marginTop: '1.25rem',
            lineHeight: '1.6',
          }}
        >
          Only members with the designated admin role in the Every Nation Discord server can
          access this dashboard.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
