'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';

interface ImageUploaderProps {
  id: string;
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  helpText?: string;
  maxDimension?: number; // Optional max width/height to auto-resize (default 1200)
}

/**
 * Resizes an image client-side on a Canvas to compress payload < 500KB.
 * Returns a Blob ready for upload.
 */
async function optimizeImage(file: File, maxDim = 1200): Promise<Blob> {
  // SVG doesn't need scaling
  if (file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && file.size < 1048576) {
        resolve(file);
        return;
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Compress as JPEG to ensure payload stays under Vercel 4.5MB limit
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        0.82
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

export default function ImageUploader({
  id,
  label,
  value,
  onChange,
  placeholder = 'https://... or upload image below',
  helpText,
  maxDimension = 1200,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (.png, .jpg, .webp, .gif).');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      // 1. Client-side optimization/resizing
      const optimizedBlob = await optimizeImage(file, maxDimension);
      const formData = new FormData();
      const fileName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
      formData.append('file', optimizedBlob, fileName);

      // 2. Upload to /api/upload
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        if (res.status === 413 || responseText.includes('Request Entity Too Large')) {
          throw new Error('Image file is too large (exceeds 4.5MB upload limit). Please select a smaller file.');
        }
        throw new Error(`Upload server error (${res.status}): ${responseText.substring(0, 100)}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload image.');
      }

      // 3. Update field value with generated Supabase URL
      onChange(data.url);
    } catch (err: any) {
      console.error('[IMAGE UPLOAD ERROR]:', err);
      setErrorMessage(err?.message || 'Error uploading image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const onFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(e.target.files[0]);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <label htmlFor={id} className="form-label" style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem' }}>
        {label}
      </label>

      {/* Main Input + Upload Row */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: isDragging ? '2px dashed var(--accent, #6366f1)' : '1px solid var(--border-color, #334155)',
          borderRadius: '8px',
          padding: '0.75rem',
          backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary, #1e293b)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Text Input for Direct URL */}
          <input
            type="text"
            id={id}
            className="form-input"
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
            placeholder={placeholder}
            style={{
              flex: '1 1 250px',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #475569)',
              backgroundColor: 'var(--bg-primary, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.875rem',
            }}
          />

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileSelect}
            accept="image/*"
            style={{ display: 'none' }}
          />

          {/* Upload Button */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              borderRadius: '6px',
              backgroundColor: 'var(--accent, #6366f1)',
              color: '#ffffff',
              border: 'none',
              transition: 'opacity 0.2s',
            }}
          >
            {isUploading ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Uploading...
              </>
            ) : (
              <>
                📁 Upload Image
              </>
            )}
          </button>

          {/* Clear Button */}
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              title="Clear Image"
              style={{
                padding: '0.5rem 0.6rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color, #475569)',
                color: 'var(--text-muted, #94a3b8)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8125rem',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Drag and Drop Zone Hint */}
        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>💡 Tip: Paste direct URL or drag & drop image file directly into box</span>
        </div>

        {/* Thumbnail Preview */}
        {value && (
          <div style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
            {/* eslint-disable-next-img-element */}
            <img
              src={value}
              alt="Preview"
              style={{
                maxHeight: '48px',
                maxWidth: '90px',
                objectFit: 'contain',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: '#000',
              }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#10b981', wordBreak: 'break-all' }}>
              ✓ Image Ready
            </span>
          </div>
        )}
      </div>

      {/* Error Message Display */}
      {errorMessage && (
        <div style={{ marginTop: '0.4rem', color: '#f87171', fontSize: '0.8125rem' }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {helpText && (
        <span className="form-help" style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.78125rem', color: 'var(--text-muted, #94a3b8)' }}>
          {helpText}
        </span>
      )}
    </div>
  );
}
