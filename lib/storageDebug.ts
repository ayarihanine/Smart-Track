/**
 * Helper function to verify Supabase storage is configured correctly
 * Run this in your app to debug storage issues
 */

import { getSupabaseClient } from './supabase';

export async function verifyStorageSetup(): Promise<{
  success: boolean;
  bucketExists: boolean;
  canWrite: boolean;
  message: string;
}> {
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    return {
      success: false,
      bucketExists: false,
      canWrite: false,
      message: 'Supabase client not initialized. Check your environment variables.',
    };
  }

  try {
    // Try to list buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      return {
        success: false,
        bucketExists: false,
        canWrite: false,
        message: `Failed to list buckets: ${bucketsError.message}`,
      };
    }

    const bucketExists = buckets?.some(b => b.name === 'inspection_photos') || false;

    if (!bucketExists) {
      return {
        success: false,
        bucketExists: false,
        canWrite: false,
        message: 'The "inspection_photos" bucket does not exist. Please create it in Supabase Storage.',
      };
    }

    // Try to test write permissions with a small test file
    const testFileName = `test_${Date.now()}.txt`;
    const testBlob = new Blob(['test'], { type: 'text/plain' });

    const { error: uploadError } = await supabase.storage
      .from('inspection_photos')
      .upload(testFileName, testBlob, { upsert: true });

    if (uploadError) {
      return {
        success: false,
        bucketExists: true,
        canWrite: false,
        message: `Upload test failed: ${uploadError.message}. Check bucket policies.`,
      };
    }

    // Clean up test file
    await supabase.storage
      .from('inspection_photos')
      .remove([testFileName])
      .catch(() => {});

    return {
      success: true,
      bucketExists: true,
      canWrite: true,
      message: 'Storage is properly configured!',
    };
  } catch (err: any) {
    return {
      success: false,
      bucketExists: false,
      canWrite: false,
      message: `Unexpected error: ${err?.message || 'Unknown error'}`,
    };
  }
}
