import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';

export interface UploadState {
  isUploading: boolean;
  isStitching: boolean;
  error: string | null;
  publicUrl: string | null;
  analysis: any | null; // Stores the extracted Gemini JSON
}

export function useUploadImage() {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    isStitching: false,
    error: null,
    publicUrl: null,
    analysis: null,
  });

  const uploadImage = async (file: File): Promise<{publicUrl: string, analysis: any} | null> => {
    // 1. Validate file types
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setUploadState(prev => ({ ...prev, isUploading: false, error: 'Invalid file type. Only PNG, JPG, and JPEG are allowed.' }));
      return null;
    }

    // 2. Validate file size (e.g., 5MB limit)
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadState(prev => ({ ...prev, isUploading: false, error: `File size exceeds the ${MAX_SIZE_MB}MB limit.` }));
      return null;
    }

    setUploadState({ isUploading: true, isStitching: false, error: null, publicUrl: null, analysis: null });

    try {
      // 3. Generate unique file path
      const fileExt = file.name.split('.').pop();
      const uniqueFileName = `${Date.now()}_${uuidv4()}.${fileExt}`;
      const filePath = `uploads/${uniqueFileName}`;

      // 4. Upload the file to the grasp-moments bucket
      const { error: uploadError } = await supabase.storage
        .from('grasp-moments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // 5. Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('grasp-moments')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // 6. Begin "Stitching into Memory" Handshake
      setUploadState(prev => ({ ...prev, isUploading: false, isStitching: true, publicUrl }));

      const formData = new FormData();
      formData.append('image', file);
      formData.append('publicUrl', publicUrl);

      const ingestResponse = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (!ingestResponse.ok) {
        const errorBody = await ingestResponse.json().catch(() => null);
        const msg = errorBody?.error || ingestResponse.statusText || 'Unknown error';
        throw new Error(msg);
      }

      const ingestData = await ingestResponse.json();

      setUploadState(prev => ({
        ...prev,
        isStitching: false,
        analysis: ingestData.analysis,
      }));

      return { publicUrl, analysis: ingestData.analysis };
    } catch (error: any) {
      console.error('Error uploading image:', error);
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        isStitching: false,
        error: error.message || 'An unknown error occurred during upload or ingest.',
      }));
      return null;
    }
  };

  return { ...uploadState, uploadImage };
}
