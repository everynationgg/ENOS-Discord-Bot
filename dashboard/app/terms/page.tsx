import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — ENOS Discord Ecosystem',
  description: 'Official Terms of Service for ENOS Discord Bot and Dashboard.',
};

export default function TermsPage() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0a0b0e',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '2rem 1rem',
      lineHeight: '1.7',
    }}>
      <div style={{
        maxWidth: '860px',
        margin: '0 auto',
        backgroundColor: '#12141c',
        border: '1px solid #1e2330',
        borderRadius: '16px',
        padding: '2.5rem',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
      }}>
        {/* Top Branding Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1e2330',
          paddingBottom: '1.5rem',
          marginBottom: '2rem',
        }}>
          <div>
            <span style={{
              background: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.5rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}>
              ENOS ECOSYSTEM
            </span>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.25rem 0 0 0', color: '#ffffff' }}>
              Terms of Service
            </h1>
          </div>
          <Link href="/dashboard" style={{
            color: '#facc15',
            fontSize: '0.875rem',
            textDecoration: 'none',
            border: '1px solid rgba(250, 204, 21, 0.3)',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            transition: 'all 0.2s',
          }}>
            ← Back to Dashboard
          </Link>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '2rem' }}>
          <strong>Effective Date:</strong> July 28, 2026 &nbsp;|&nbsp; <strong>Last Updated:</strong> July 28, 2026
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>1. Acceptance of Terms</h2>
          <p style={{ color: '#cbd5e1' }}>
            By inviting, accessing, or interacting with the <strong>ENOS Discord Application</strong> (Bot Client ID: <code>1521941412638363718</code>) or accessing the <strong>ENOS Web Management Dashboard</strong> (<code>enos-discord-bot.vercel.app</code>), you agree to be bound by these Terms of Service. If you do not agree to all of these terms, you may not use or interact with the Service.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>2. Eligibility & Age Requirements</h2>
          <p style={{ color: '#cbd5e1' }}>
            You must be at least 13 years old (or the minimum age of digital consent required in your jurisdiction) to use ENOS, in compliance with Discord&apos;s Terms of Service and legal standards.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>3. Description of Service</h2>
          <p style={{ color: '#cbd5e1' }}>
            ENOS provides automated server management, community gamification, virtual daily quests, weekly boss raid events, scheduled trivia drops, Text-to-Speech (TTS) voice announcements, and stream notifications for Discord servers.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>4. Virtual Currency Disclaimer (Vault Coins)</h2>
          <p style={{ color: '#cbd5e1' }}>
            ENOS includes an in-server virtual reward system known as <strong>Vault Coins (₱ PHP)</strong>. You acknowledge and agree that:
          </p>
          <ul style={{ color: '#94a3b8', marginLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>Vault Coins are purely virtual points for community recognition and server engagement.</li>
            <li>Vault Coins have <strong>NO real-world monetary value</strong>, cannot be redeemed for fiat currency, real money, or legal tender, and cannot be transferred outside the designated server ecosystem.</li>
            <li>Vault Coins are non-refundable and subject to daily earning caps (2.5 Coins/day cap).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>5. Acceptable Use & Conduct</h2>
          <p style={{ color: '#cbd5e1' }}>
            Users agree not to exploit bugs, use automated bots/self-bots to farm Vault Coins or daily quests, attempt to reverse-engineer API endpoints, or violate Discord&apos;s Community Guidelines and Terms of Service.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>6. Termination & Service Availability</h2>
          <p style={{ color: '#cbd5e1' }}>
            We reserve the right to suspend or terminate access to the bot or dashboard for any user or server that violates these Terms. The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>7. Contact & Data Deletion Requests</h2>
          <p style={{ color: '#cbd5e1' }}>
            If you have questions about these Terms of Service or wish to request data removal, please contact server administration or review our <Link href="/privacy" style={{ color: '#facc15' }}>Privacy Policy</Link>.
          </p>
        </section>

        <div style={{
          borderTop: '1px solid #1e2330',
          paddingTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.875rem',
          color: '#64748b',
        }}>
          <div>© 2026 Every Nation Gaming (ENOS). All rights reserved.</div>
          <div><Link href="/privacy" style={{ color: '#facc15', textDecoration: 'none' }}>Privacy Policy →</Link></div>
        </div>
      </div>
    </div>
  );
}
