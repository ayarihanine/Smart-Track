# Photo Upload Fix - Troubleshooting Guide

## Issue
"Network request failed" error when trying to upload photos in the issue report feature.

## Root Causes & Solutions

### 1. **RLS Policy Mismatch** (Most Common)
The storage bucket had overly restrictive Row-Level Security (RLS) policies.

**Fixed:** Updated `supabase/migrations/20260531100000_create_inspection_photos_bucket.sql` to include:
- ✅ Policy for authenticated users (`auth.role() = 'authenticated'`)
- ✅ Fallback policy for anon users (`auth.role() = 'anon'`)
- ✅ Public SELECT access for viewing photos

### 2. **Bucket Does Not Exist**
The migration needs to be run to create the `inspection_photos` bucket.

**To Fix:**
1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy and paste the content from `supabase/migrations/20260531100000_create_inspection_photos_bucket.sql`
4. Execute the query
5. Verify: Storage → Buckets → should see `inspection_photos`

### 3. **Network/CORS Issues**
React Native might have network restrictions.

**To Fix:**
- Verify your `.env.local` has correct Supabase URL and key:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  ```
- Restart the development server after changing env vars

### 4. **User Not Authenticated**
The app now checks authentication status and provides fallback policies.

**To Fix:**
- Ensure user is logged in before attempting upload
- The app will warn in console if not authenticated: `"User not authenticated - photo upload will use anon role"`

## New Error Messages

The improved error handling now provides specific feedback:

| Error | Meaning | Solution |
|-------|---------|----------|
| `403 - Permission denied` | RLS policies need update | Run migration or check policies |
| `404 - Bucket not found` | `inspection_photos` bucket doesn't exist | Run migration in Supabase |
| `Network error` | Connection issue | Check internet connection |
| `Failed to fetch image` | Can't read photo from device | Check file permissions |

## Testing the Fix

1. **Run the migration** (if not already done)
2. **Test upload** in the app:
   - Dashboard → Menu icon → "Report Issue"
   - Take or select a photo
   - Should upload successfully
3. **Check logs** in browser console:
   - Look for: `"Photo uploaded successfully: operator_..."`
   - This confirms the fix worked

## Console Logs to Help Debugging

If upload still fails, check the console for:
```
"Uploading to inspection_photos bucket: operator_username_123456.jpg"
"Storage upload error details: { statusCode: 403, ... }"
```

This information helps identify the exact cause.

## Files Modified

1. ✅ `supabase/migrations/20260531100000_create_inspection_photos_bucket.sql`
   - Added anon upload policy
   - Better error handling structure

2. ✅ `app/(tabs)/index.tsx`
   - Added auth check before upload
   - Detailed error logging
   - Status code-specific error messages
