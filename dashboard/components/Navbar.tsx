'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import GuildSelector from './GuildSelector';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/moderation', label: 'Moderation', icon: '🛡️' },
  { href: '/dashboard/gaming', label: 'Gaming', icon: '🎮' },
  { href: '/dashboard/newsroom', label: 'Newsroom', icon: '📰' },
  { href: '/dashboard/leaderboards', label: 'Leaderboards', icon: '🏆' },
  { href: '/dashboard/social', label: 'Social', icon: '📡' },
  { href: '/dashboard/companion', label: 'ENOS NPC', icon: '🤖' },
  { href: '/dashboard/system-ops', label: 'System Ops', icon: '⚙️' },
  { href: '/dashboard/logs', label: 'Logs', icon: '📋' },
];

const MOBILE_PRIMARY_TABS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/gaming', label: 'Gaming', icon: '🎮' },
  { href: '/dashboard/moderation', label: 'Moderation', icon: '🛡️' },
  { href: '/dashboard/social', label: 'Social', icon: '📡' },
];

const MOBILE_MORE_ITEMS = [
  { href: '/dashboard/newsroom', label: 'Newsroom', icon: '📰' },
  { href: '/dashboard/leaderboards', label: 'Leaderboards', icon: '🏆' },
  { href: '/dashboard/companion', label: 'ENOS NPC', icon: '🤖' },
  { href: '/dashboard/system-ops', label: 'System Ops', icon: '⚙️' },
  { href: '/dashboard/logs', label: 'Logs', icon: '📋' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="navbar">
        <Link href="/dashboard" className="navbar-logo">
          <div className="navbar-logo-icon">🏰</div>
          <span className="navbar-logo-text">
            <span style={{ color: 'var(--accent-primary)' }}>Every</span>
            <span style={{ color: 'var(--accent-secondary)' }}>Nation</span>
          </span>
        </Link>

        <GuildSelector />

        <div className="navbar-sep" />

        {/* Desktop Navigation (Untouched, shown on >= 769px) */}
        <div className="navbar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${isActive ? 'active' : ''}`}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>

        {session?.user && (
          <div className="navbar-user">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="navbar-avatar"
                width={32}
                height={32}
              />
            )}
            <span className="navbar-username">{session.user.name}</span>
            <div className="navbar-sep" />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              id="logout-btn"
            >
              Sign Out
            </button>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Navigation Bar (Only active on <= 768px portrait mobile) */}
      <div className="mobile-bottom-nav">
        {MOBILE_PRIMARY_TABS.map((tab) => {
          const isActive =
            tab.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setMoreOpen(false)}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}

        <button
          type="button"
          className={`mobile-nav-item ${moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <span>☰</span>
          More
        </button>
      </div>

      {/* Mobile "More" Slide-up Sheet */}
      {moreOpen && (
        <>
          <div
            className="mobile-more-backdrop"
            onClick={() => setMoreOpen(false)}
          />
          <div className="mobile-more-sheet">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                All Modules
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.625rem',
              }}
            >
              {MOBILE_MORE_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    style={{
                      justifyContent: 'flex-start',
                      padding: '0.625rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive
                        ? 'var(--accent-primary-dim)'
                        : 'rgba(255, 255, 255, 0.03)',
                    }}
                    onClick={() => setMoreOpen(false)}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div
              style={{
                marginTop: '0.5rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Logged in as {session?.user?.name || 'Admin'}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
