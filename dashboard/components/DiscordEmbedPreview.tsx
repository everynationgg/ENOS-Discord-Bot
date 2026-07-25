'use client';

import React from 'react';

interface DiscordEmbedPreviewProps {
  presetType: string;
  title: string;
  summary?: string;
  bodyMarkdown: string;
  bannerUrl?: string;
  videoUrl?: string;
  rewardCoins?: number;
  tryFeatureChannel?: string;
}

export default function DiscordEmbedPreview({
  presetType,
  title,
  summary,
  bodyMarkdown,
  bannerUrl,
  videoUrl,
  rewardCoins = 0,
  tryFeatureChannel,
}: DiscordEmbedPreviewProps) {
  let borderColor = '#6366f1'; // Indigo
  let iconEmoji = '🚀';
  if (presetType === 'patch') {
    borderColor = '#3b82f6';
    iconEmoji = '🛠️';
  } else if (presetType === 'showcase') {
    borderColor = '#10b981';
    iconEmoji = '🎬';
  }

  const displayTitle = title ? `${iconEmoji} ${title}` : `${iconEmoji} Feature Update Title`;

  return (
    <div
      style={{
        backgroundColor: '#313338',
        borderRadius: '8px',
        padding: '1rem',
        color: '#dbdee1',
        fontFamily: 'gg sans, Noto Sans, Helvetica Neue, Helvetica, Arial, sans-serif',
        fontSize: '0.9rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {/* Bot Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            backgroundColor: '#5865f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            color: '#fff',
            fontSize: '1rem',
          }}
        >
          E
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontWeight: 600, color: '#f2f3f5' }}>ENOS Bot</span>
            <span
              style={{
                backgroundColor: '#5865f2',
                color: '#fff',
                fontSize: '0.625rem',
                fontWeight: 700,
                padding: '0.1rem 0.3rem',
                borderRadius: '3px',
                textTransform: 'uppercase',
              }}
            >
              ✓ BOT
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#949ba4' }}>Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      {/* Embed Container */}
      <div
        style={{
          borderLeft: `4px solid ${borderColor}`,
          backgroundColor: '#2b2d31',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          maxWidth: '520px',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f2f3f5', marginBottom: '0.4rem' }}>
          {displayTitle}
        </div>

        {summary && (
          <div style={{ fontStyle: 'italic', color: '#b5bac1', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            {summary}
          </div>
        )}

        <div style={{ whiteSpace: 'pre-wrap', color: '#dbdee1', fontSize: '0.875rem', lineHeight: '1.4' }}>
          {bodyMarkdown || 'Type body markdown to preview layout...'}
        </div>

        {bannerUrl && (
          <div style={{ marginTop: '0.75rem', borderRadius: '4px', overflow: 'hidden' }}>
            {/* eslint-disable-next-img-element */}
            <img
              src={bannerUrl}
              alt="Banner Preview"
              style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }}
              onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
            />
          </div>
        )}

        <div style={{ marginTop: '0.6rem', fontSize: '0.7rem', color: '#949ba4' }}>
          ENOS Bot Feature Showcase • Server Update System
        </div>
      </div>

      {/* Simulated Discord Button Row */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
        {tryFeatureChannel && (
          <div style={{ backgroundColor: '#2b2d31', color: '#5865f2', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            🚀 Try Feature Now
          </div>
        )}
        {videoUrl && (
          <div style={{ backgroundColor: '#2b2d31', color: '#5865f2', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            🎥 Watch Video Guide
          </div>
        )}
        {rewardCoins > 0 && (
          <div style={{ backgroundColor: '#248046', color: '#ffffff', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            🎁 Claim +{rewardCoins} Vault Coins
          </div>
        )}
        <div style={{ backgroundColor: '#4e5058', color: '#ffffff', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          💬 Send Feedback
        </div>
      </div>

      {/* Simulated Select Menu Dropdown */}
      <div style={{ marginTop: '0.5rem', backgroundColor: '#2b2d31', borderRadius: '4px', padding: '0.5rem 0.75rem', border: '1px solid #4e5058', color: '#949ba4', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📌 Select a feature to view guide, stats & commands...</span>
        <span>▼</span>
      </div>
    </div>
  );
}
