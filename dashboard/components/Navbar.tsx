'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/moderation', label: 'Moderation', icon: '🛡️' },
  { href: '/dashboard/gaming', label: 'Gaming', icon: '🎮' },
  { href: '/dashboard/social', label: 'Social', icon: '📡' },
  { href: '/dashboard/system-ops', label: 'System Ops', icon: '⚙️' },
  { href: '/dashboard/logs', label: 'Logs', icon: '📋' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="navbar">
      <Link href="/dashboard" className="navbar-logo">
        <div className="navbar-logo-icon">🏰</div>
        <span className="navbar-logo-text">
          Every<span>Nation</span>
        </span>
      </Link>

      <div className="navbar-sep" />

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
  );
}
