#!/bin/bash
# Setup script to initialize Supabase storage bucket for issue photos

echo "🚀 SmartTrack Storage Bucket Setup"
echo "=================================="
echo ""
echo "This script will help you set up the inspection_photos storage bucket."
echo ""
echo "Steps:"
echo "1. Go to: https://app.supabase.com/project/[YOUR_PROJECT_ID]/storage/buckets"
echo "2. Click 'Create a new bucket'"
echo "3. Name it: inspection_photos"
echo "4. Toggle 'Public bucket' ON"
echo "5. Click 'Create bucket'"
echo ""
echo "OR run this SQL in the Supabase SQL Editor:"
echo "================================================"
cat supabase/migrations/20260531100000_create_inspection_photos_bucket.sql
echo "================================================"
echo ""
echo "After creating the bucket, test by running:"
echo "npm test"
