import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — ENOS Discord Ecosystem',
  description: 'Official Privacy Policy detailing data collection, processing, and retention for ENOS.',
};

export default function PrivacyPage() {
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
              Privacy Policy
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
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>1. Information We Collect</h2>
          <p style={{ color: '#cbd5e1' }}>
            When you interact with the ENOS Discord Bot or Web Dashboard, we collect minimal operational data necessary to deliver community features:
          </p>
          <ul style={{ color: '#94a3b8', marginLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li><strong>Discord User ID (<code>discord_id</code>)</strong>: Used as the primary index for your Vault Coins balance, daily quest progress, boss raid AP, and verification status.</li>
            <li><strong>Discord Username & Display Name</strong>: Used for rendering leaderboards, boss damage logs, and user profile interfaces.</li>
            <li><strong>Guild / Server ID (<code>guild_id</code>)</strong>: Used to isolate multi-tenant server configurations and quest pools.</li>
            <li><strong>Voice Activity Timestamps</strong>: Tracked transiently to compute Voice Active daily quest duration.</li>
            <li><strong>Daily Message Counts</strong>: Incremented in RAM to evaluate Chat Active quest progress (message content is not stored).</li>
            <li><strong>User-Submitted Verification Information</strong>: In-Game Names (IGNs) and Birth Month/Day (submitted voluntarily for community birthday announcements).</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>2. Data We DO NOT Collect</h2>
          <p style={{ color: '#cbd5e1' }}>
            We do not store private message text history, DMs, financial data, passwords, home addresses, or real-world identity metrics.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>3. Data Storage & Security</h2>
          <p style={{ color: '#cbd5e1' }}>
            All persistent data is stored securely in <strong>Supabase PostgreSQL</strong> instances protected by SSL/TLS encryption in transit and AES-256 encryption at rest. Dashboard administrative authentication is managed via NextAuth.js OAuth2 tokens.
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>4. Third-Party Sub-processors</h2>
          <p style={{ color: '#cbd5e1' }}>
            ENOS integrates with the following trusted service providers:
          </p>
          <ul style={{ color: '#94a3b8', marginLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li><strong>Discord API</strong>: Authentication, Gateway events, and bot interactions.</li>
            <li><strong>Supabase</strong>: Database hosting and storage infrastructure.</li>
            <li><strong>Vercel</strong>: Hosting for the Next.js Web Dashboard.</li>
            <li><strong>Google Gemini API</strong>: Used for AI text formatting and birthday announcement prompts.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: '#facc15', marginBottom: '0.75rem' }}>5. User Rights & Data Deletion Requests</h2>
          <p style={{ color: '#cbd5e1' }}>
            You have the right to request a copy of your stored data or request complete deletion of your records from our database. To request data deletion, contact a server administrator or submit a data removal request.
          </p>
        </section>

        <div style={{
          borderTop: '1px solid #1e2330',
          paddingTop: '1.5rem',
          display: 'flex',
          justify: 'space-between',
          fontSize: '0.875rem',
          color: '#64748b',
        }}>
          <div>© 2026 Every Nation Gaming (ENOS). All rights reserved.</div>
          <div><Link href="/terms" style={{ color: '#facc15', textDecoration: 'none' }}>← Terms of Service</Link></div>
        </div>
      </div>
    </div>
  );
}
