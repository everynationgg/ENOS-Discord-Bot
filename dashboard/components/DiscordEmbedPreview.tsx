'use client';

import React, { useState } from 'react';

interface DropdownItem {
  id: string;
  label: string;
  description?: string;
  hero_image_url?: string;
  content_markdown?: string;
  try_channel_id?: string;
  try_button_label?: string;
  video_url?: string;
}

interface DiscordEmbedPreviewProps {
  presetType: string;
  titleSize?: string;
  title: string;
  bodySize?: string;
  summary?: string;
  bodyMarkdown: string;
  bannerUrl?: string;
  videoUrl?: string;
  rewardCoins?: number;
  tryFeatureChannel?: string;
  dropdownItems?: DropdownItem[];
}

export default function DiscordEmbedPreview({
  presetType,
  titleSize = 'h1',
  title,
  bodySize = 'normal',
  summary,
  bodyMarkdown,
  bannerUrl,
  videoUrl,
  rewardCoins = 0,
  tryFeatureChannel,
  dropdownItems = [],
}: DiscordEmbedPreviewProps) {
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    dropdownItems.length > 0 ? 0 : null
  );

  let borderColor = '#6366f1'; // Indigo
  let iconEmoji = '🚀';
  if (presetType === 'patch') {
    borderColor = '#3b82f6';
    iconEmoji = '🛠️';
  } else if (presetType === 'showcase') {
    borderColor = '#10b981';
    iconEmoji = '🎬';
  }

  let titleFontSize = '1.25rem';
  if (titleSize === 'h2') titleFontSize = '1.1rem';
  if (titleSize === 'h3') titleFontSize = '0.95rem';

  let bodyFontSize = '0.875rem';
  let bodyFontWeight = 400;
  if (bodySize === 'h2') {
    bodyFontSize = '1.05rem';
    bodyFontWeight = 700;
  } else if (bodySize === 'h3') {
    bodyFontSize = '0.95rem';
    bodyFontWeight = 600;
  }

  const selectedItem = selectedItemIndex !== null ? dropdownItems[selectedItemIndex] : null;

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
          <span style={{ fontSize: '0.72rem', color: '#949ba4' }}>
            Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Main Announcement Embed Container */}
      <div
        style={{
          borderLeft: `4px solid ${borderColor}`,
          backgroundColor: '#2b2d31',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          maxWidth: '520px',
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: titleFontSize,
            color: '#f2f3f5',
            marginBottom: '0.4rem',
          }}
        >
          {title ? `${iconEmoji} ${title}` : `${iconEmoji} Feature Update Title`}
        </div>

        {summary && (
          <div style={{ fontStyle: 'italic', color: '#b5bac1', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
            {summary}
          </div>
        )}

        <div
          style={{
            whiteSpace: 'pre-wrap',
            color: '#dbdee1',
            fontSize: bodyFontSize,
            fontWeight: bodyFontWeight,
            lineHeight: '1.4',
          }}
        >
          {bodyMarkdown || 'Type main patch notes to preview layout...'}
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

      {/* Interactive Dropdown Select Menu Simulator */}
      {dropdownItems.length > 0 && (
        <div style={{ marginTop: '0.5rem', maxWidth: '520px' }}>
          <label style={{ fontSize: '0.72rem', color: '#949ba4', display: 'block', marginBottom: '0.2rem' }}>
            📌 Select an item below to simulate Ephemeral Hero Photo popup:
          </label>
          <select
            style={{
              width: '100%',
              backgroundColor: '#2b2d31',
              color: '#dbdee1',
              border: '1px solid #4e5058',
              borderRadius: '4px',
              padding: '0.4rem 0.6rem',
              fontSize: '0.8rem',
            }}
            value={selectedItemIndex ?? 0}
            onChange={(e) => setSelectedItemIndex(Number(e.target.value))}
          >
            {dropdownItems.map((item, idx) => (
              <option key={idx} value={idx}>
                {item.label || `Option ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Simulated Ephemeral Hero Photo Card Popup */}
      {selectedItem && (
        <div
          style={{
            marginTop: '0.75rem',
            borderLeft: '4px solid #6366f1',
            backgroundColor: '#2b2d31',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            maxWidth: '520px',
            position: 'relative',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: '#949ba4', fontStyle: 'italic', marginBottom: '0.4rem' }}>
            🔒 Ephemeral Response (Only you can see this)
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f2f3f5', marginBottom: '0.3rem' }}>
            {selectedItem.label}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.8125rem', color: '#dbdee1' }}>
            {selectedItem.content_markdown || 'Dynamic item details will appear here...'}
          </div>

          {selectedItem.hero_image_url && (
            <div style={{ marginTop: '0.6rem', borderRadius: '4px', overflow: 'hidden' }}>
              {/* eslint-disable-next-img-element */}
              <img
                src={selectedItem.hero_image_url}
                alt="Hero Photo"
                style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', display: 'block' }}
                onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
              />
            </div>
          )}

          {/* Action Buttons inside Ephemeral Card */}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
            {(selectedItem.try_channel_id || tryFeatureChannel) && (
              <div style={{ backgroundColor: '#2b2d31', color: '#5865f2', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                {selectedItem.try_button_label || '🚀 Try Feature Now'}
              </div>
            )}
            {(selectedItem.video_url || videoUrl) && (
              <div style={{ backgroundColor: '#2b2d31', color: '#5865f2', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                🎥 Watch Video Guide
              </div>
            )}
            {rewardCoins > 0 && (
              <div style={{ backgroundColor: '#248046', color: '#ffffff', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                🎁 Claim +{rewardCoins} Coins
              </div>
            )}
            <div style={{ backgroundColor: '#4e5058', color: '#ffffff', padding: '0.35rem 0.65rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
              💬 Send Feedback
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
