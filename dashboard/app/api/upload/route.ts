import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET_NAME = 'enos-uploads';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No image file provided in upload request.' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Uploaded file must be a valid image.' },
        { status: 400 }
      );
    }

    // Ensure bucket exists in Supabase Storage
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const exists = buckets?.some((b) => b.name === BUCKET_NAME);
      if (!exists) {
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: 10485760, // 10MB limit
        });
      }
    } catch (err: any) {
      console.warn('[STORAGE BUCKET CHECK]:', err?.message || err);
    }

    // Prepare filename and buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filename, buffer, {
        contentType: file.type || 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('[STORAGE UPLOAD ERROR]:', uploadError);
      return NextResponse.json(
        { success: false, error: `Failed to store image: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to resolve public image URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
    });
  } catch (err: any) {
    console.error('[UPLOAD ROUTE EXCEPTION]:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error uploading file' },
      { status: 500 }
    );
  }
}
