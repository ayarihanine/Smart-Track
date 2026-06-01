# 🚀 Populate Card Details - Quick Guide

## The Issue
The card details page is empty because test data hasn't been inserted into the database yet.

## The Solution
Run the Node.js script to automatically populate your database with realistic test data.

---

## ✅ Step 1: Run the Population Script

Open terminal in the smarttrack directory and run:

```bash
node populate_db.js
```

**Expected output:**
```
🚀 Starting database population...

📝 Inserting sensor events...
✅ Sensor events inserted successfully

📝 Inserting production history...
✅ Production history inserted successfully

🎉 Database population completed!

Test cards:
  - CARD-2026-001 (8 scans, completed)
  - CARD-2026-002 (5 scans, in progress)
  - CARD-2026-003 (4 scans, completed)
  - CARD-2026-004 (5 scans, in progress)

You can now view the card details page with populated production history!
```

---

## ✅ Step 2: Test in Your App

1. **Refresh/Restart your app**
   ```bash
   # If using Expo CLI:
   npm start
   ```

2. **Navigate to a card** 
   - Click any card from the dashboard
   - Or directly go to: `CARD-2026-001`

3. **View the Production History**
   - You should now see a timeline with scan events
   - Each event shows:
     - 📍 Location (machine name)
     - 👤 Operator name
     - ⏰ Timestamp
     - 📊 Event type
     - Scan counter badge showing total scans

---

## 📊 Test Cards Available

After running the script, these cards will have data:

| Card | Scans | Status | Purpose |
|------|-------|--------|---------|
| **CARD-2026-001** | 8 | Completed | Full production flow |
| **CARD-2026-002** | 5 | In Progress | Partial flow |
| **CARD-2026-003** | 4 | Completed | Quick completion |
| **CARD-2026-004** | 5 | In Progress | Active production |

---

## 🔧 What Changed

### API Updates (`lib/api.ts`)
- ✅ `getScanEvents()` now queries `production_history` first (has more detail)
- ✅ Falls back to `sensor_events` if no production history
- ✅ Added `mapDbProductionHistoryToScanEvent()` function
- ✅ Properly extracts `scannedBy` from metadata JSON

### Database Changes
- ✅ Inserts 40+ scan events across 4 test cards
- ✅ Inserts 20+ production history records with detailed metadata
- ✅ All timestamps are realistic and relative to current time

### UI Improvements (Already Applied)
- ✅ Timeline displays scanned operator names
- ✅ Location badges with icons
- ✅ Scan counter shows total events
- ✅ Proper event type labels

---

## ❌ Troubleshooting

### Script fails with "SUPABASE_URL not found"
**Solution:** Make sure environment variables are set in your `.env` or `.env.local` file:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### Page still shows "No History Found" after running script
**Solution:**
1. Refresh the app (force reload)
2. Navigate away and back to the card
3. Check browser console for any fetch errors
4. Verify the script ran without errors

### Data not showing in production history section
**Solution:**
1. Check that your card exists in `electronic_cards` table
2. Verify production_history has records for that card_id
3. Try a different card (e.g., CARD-2026-001)

---

## 🎯 What You'll See

### Before
```
Production History
0 events

[No History Found]
```

### After
```
Production History
8 scans

📌 Receiving · 👤 Ahmed
  ⏰ 31 May · 15:45

📌 NPM-DX-1 · 👤 Ahmed
  ⏰ 31 May · 15:42
  
... (more events)
```

---

## 📝 Notes

- Script uses `upsert` so it won't duplicate data on re-runs
- All timestamps are calculated relative to now (will be recent)
- Metadata is stored as JSON in the database
- Component insertions are ready to add to UI if needed

---

## ✨ Next Steps

After confirming the card details page works:
1. Review the improved UI styling
2. Test with different cards
3. Consider adding more test data
4. Customize metadata fields as needed

Enjoy! 🎉
