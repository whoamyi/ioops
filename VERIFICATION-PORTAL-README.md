# IOOPS Verification Portal

## Overview

This is the recipient verification portal for IOOPS. Recipients access this page via a secure verification link sent to them by email. The portal is intentionally not linked from the main IOOPS website to keep it private and accessible only to recipients.

## File Structure

```
ioops/
├── recipient-verification.html    # Main verification portal page
├── css/
│   └── recipient-verification.css # IOOPS-branded styling (blue & gold)
└── js/
    └── recipient-verification.js  # Client-side logic and API integration
```

## How It Works

1. **Access**: Recipients receive an email with a verification URL:
   ```
   https://ioops.org/recipient-verification.html?token=VER-abc123...
   ```

2. **Flow**: The portal guides recipients through 4 steps:
   - **Step 1**: Submit personal information and identity document details
   - **Step 2**: Confirm escrow deposit to SecureHold International Trust
   - **Step 3**: "Generate" security release code (actually reveals pre-generated code)
   - **Step 4**: Display code with instructions to use it on Meridian tracking

3. **Backend Integration**: The portal calls the tracking-project backend API:
   ```
   https://meridian-tracking.fly.dev/api/ioops/verification/{token}
   ```

## Key Features

✅ **Token-Based Security**: Unique verification token per recipient
✅ **Pre-Generated Codes**: Security codes exist before recipient "generates" them
✅ **Progress Tracking**: Portal remembers progress and resumes from last step
✅ **IOOPS Branding**: Blue (#1a1a2e) and gold (#d4af37) theme matching emails
✅ **Responsive Design**: Works on desktop and mobile
✅ **Hidden Portal**: Not linked from main site, only accessible via email

## API Endpoints Used

- `GET /api/ioops/verification/:token` - Load verification session
- `POST /api/ioops/verification/:token/submit-info` - Submit recipient info
- `POST /api/ioops/verification/:token/confirm-escrow` - Confirm deposit
- `POST /api/ioops/verification/:token/generate-code` - Reveal security code

## Development

For local development, update the API base URL in `js/recipient-verification.js`:

```javascript
const API_BASE = 'http://localhost:3000/api/ioops';
```

## Testing

1. Ensure tracking-project backend is running
2. Create a verification record in the database
3. Get the verification token
4. Visit: `http://localhost:3000/recipient-verification.html?token=VER-...`
5. Test the complete 4-step flow

## Deployment

This portal deploys as part of the ioops project to Vercel/Netlify. The file `recipient-verification.html` will be accessible at:

```
https://ioops.org/recipient-verification.html?token=...
```

## Next Steps

1. ✅ Frontend portal created
2. ⏳ Database schema needs to be run in Neon Console
3. ⏳ Update verification email to include token and portal URL
4. ⏳ Test end-to-end flow with Sonia
5. ⏳ Deploy both projects to production

## Security Notes

- Portal validates token on every API call
- No verification token = error message shown
- All form submissions validated on backend
- Pre-generated codes prevent timing attacks
- Complete audit trail in database