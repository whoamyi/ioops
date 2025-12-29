# State Persistence Fix - Testing Guide
## Date: 2025-12-29
## Issue: Page refresh reverting to photo capture after document submission

---

## 🐛 Bug That Was Fixed

**Issue:** After submitting documents, refreshing the page would go back to "Photo 1 of 3: Your ID Document" instead of staying on "Waiting for Review".

**Root Cause:** Frontend was using stale sessionStorage state instead of checking backend for current status.

**Fix:** Backend is now the single source of truth. Every page load fetches latest status from backend.

---

## ✅ How to Test the Fix

### Test 1: Document Submission State Persistence

**Steps:**
1. Open user portal: `http://localhost:8080/recipient-verification.html?token=VER-xxx`
2. Complete personal info form
3. Complete document info form
4. Capture all 3 photos
5. Click "Submit for Review"
6. **Verify you see:** "Waiting for Review" spinner with message
7. **Refresh the page (F5 or Ctrl+R)**
8. **Expected Result:** ✅ Still shows "Waiting for Review" spinner

**Before Fix:**
- ❌ Would show "Photo 1 of 3: Your ID Document" again
- ❌ Would require re-capturing all photos

**After Fix:**
- ✅ Shows "Waiting for Review" spinner
- ✅ Status persists across refreshes
- ✅ Backend status is used

---

### Test 2: Rejection State Persistence

**Steps:**
1. Continue from Test 1 (documents submitted)
2. Admin rejects ONE document (e.g., passport)
3. **Verify you see:** Document status cards with rejection
4. **Refresh the page**
5. **Expected Result:** ✅ Still shows document status cards with rejection

**Before Fix:**
- ❌ Might show old state
- ❌ Inconsistent behavior

**After Fix:**
- ✅ Shows current rejection status
- ✅ Cards persist across refreshes
- ✅ Rejection reasons still visible

---

### Test 3: Approval State Persistence

**Steps:**
1. Admin approves ALL documents
2. **Verify you see:** Payment form
3. **Refresh the page**
4. **Expected Result:** ✅ Still shows payment form

**Before Fix:**
- ❌ Might revert to earlier state

**After Fix:**
- ✅ Shows payment form
- ✅ Progress persists
- ✅ Can complete payment after refresh

---

### Test 4: Payment Submission State Persistence

**Steps:**
1. Submit payment receipt
2. **Verify you see:** "Payment Under Review" message
3. **Refresh the page**
4. **Expected Result:** ✅ Still shows "Payment Under Review"

**Before Fix:**
- ❌ Might show payment form again

**After Fix:**
- ✅ Shows waiting state
- ✅ No duplicate submissions
- ✅ Correct state displayed

---

## 🔍 Console Verification

After refreshing the page, check browser console:

```
[API] Loading verification from backend...
[API] Verification loaded: documents_submitted
[State] Transitioning from loading to waiting_approval
[Persistence] State saved
```

**Key Indicators:**
- ✅ `Loading verification from backend` appears FIRST
- ✅ Backend status is logged
- ✅ State transitions based on backend data
- ✅ State saved AFTER determining correct state

---

## 📊 State Flow After Fix

### On Page Load:
```
1. DOMContentLoaded event fires
2. loadVerification() called
3. Fetch from backend: GET /api/ioops/verification/{token}
4. Backend returns: { status: 'documents_submitted', ... }
5. determineStateFromVerification() analyzes status
6. Transition to WAITING_APPROVAL (no rejections yet)
7. Save state to sessionStorage
8. Render "Waiting for Review" spinner
```

### After Document Rejection:
```
1. Admin rejects document
2. Backend emits WebSocket event: document_rejected
3. Frontend receives event
4. loadVerification() called (fetches latest from backend)
5. Backend returns: { status: 'documents_submitted', passport_approved: false, ... }
6. determineStateFromVerification() sees rejection
7. Transition to REJECTED state
8. Render document status cards
9. Save state to sessionStorage
```

### After Refresh:
```
1. Page reloads
2. loadVerification() called
3. Fetch from backend (ALWAYS)
4. Backend returns current status
5. State determined from backend data
6. Correct state displayed
```

---

## 🎯 What Changed in the Code

### Before:
```javascript
async function loadVerification() {
  // Try to restore previous session first
  if (loadVerificationState()) {
    console.log('[Restore] Previous session restored successfully');
    renderState();
    return;  // ❌ Exits early with old state
  }

  // Only fetch backend if sessionStorage empty
  const response = await fetch(`${API_BASE}/verification/${token}`);
  verification = await response.json();
  determineStateFromVerification();
}
```

**Problem:** If sessionStorage had data, it would return early WITHOUT checking backend.

### After:
```javascript
async function loadVerification() {
  // ALWAYS fetch from backend first (source of truth)
  const response = await fetch(`${API_BASE}/verification/${token}`);
  verification = await response.json();

  // Determine state based on backend status
  determineStateFromVerification();

  // Save current state for faster subsequent renders
  saveVerificationState();
}
```

**Solution:** Backend is always checked first. SessionStorage is updated AFTER determining correct state.

---

## ✅ Success Criteria

The fix is working correctly when:

1. ✅ **After Document Submission:**
   - Submit docs → See "Waiting for Review"
   - Refresh → STILL see "Waiting for Review"
   - No reversion to photo capture

2. ✅ **After Document Rejection:**
   - Admin rejects → See status cards
   - Refresh → STILL see status cards
   - Rejection reasons persist

3. ✅ **After All Approved:**
   - All docs approved → See payment form
   - Refresh → STILL see payment form
   - No reversion to previous steps

4. ✅ **Console Messages:**
   - Always see "[API] Loading verification from backend..."
   - Backend status logged
   - State transitions logged
   - Persistence happens AFTER state determination

---

## 🐛 Troubleshooting

### Issue: Still reverting to old state after refresh

**Possible Causes:**
1. Backend not updating status correctly
2. Browser cache serving old JS file
3. Token mismatch

**Debug Steps:**
```javascript
// In browser console after refresh
console.log('Backend Status:', verification?.status);
console.log('Current State:', currentState);
console.log('Expected State based on status:');

if (verification?.status === 'documents_submitted') {
  if (verification.all_documents_approved) {
    console.log('Should be: STEP_2_PAYMENT');
  } else if (verification.passport_approved === false ||
             verification.proof_of_address_approved === false ||
             verification.selfie_approved === false) {
    console.log('Should be: REJECTED');
  } else {
    console.log('Should be: WAITING_APPROVAL');
  }
}
```

**Fix:**
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+F5)
- Verify backend is running
- Check Network tab for API call

---

### Issue: Backend returns wrong status

**Check:**
```sql
-- In database
SELECT token, status, all_documents_approved,
       passport_approved, proof_of_address_approved, selfie_approved
FROM ioops_verifications
WHERE token = 'VER-xxx';
```

**Expected After Document Submission:**
- `status` = `'documents_submitted'`
- `all_documents_approved` = `NULL` or `false`
- Individual approvals = `NULL` (pending)

---

## 📝 Summary

**What Was Broken:**
- SessionStorage was treated as source of truth
- Page refresh would use old cached state
- Users couldn't refresh without losing progress

**What Was Fixed:**
- Backend is now the source of truth
- Every page load fetches latest status
- State determined from backend data
- SessionStorage updated AFTER correct state set

**Impact:**
- Users can refresh at any time
- State persists correctly
- Progress is never lost
- State machine works across refreshes

**Testing:**
- Submit documents → Refresh → Still shows "Waiting for Review" ✅
- Get rejection → Refresh → Still shows rejection cards ✅
- Get approval → Refresh → Still shows payment form ✅

---

**Last Updated:** 2025-12-29
**Fix Applied:** Commit 38a735c
**Status:** ✅ FIXED - Ready for Testing
