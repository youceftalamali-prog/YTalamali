<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy AuraPost AI

AuraPost AI is a full-stack product intelligence and growth-ops workspace with:
- Product import and normalization
- Product analyzer with AI and deterministic fallback
- AI Content Studio
- AI Video Studio
- Image Studio
- Social publishing
- Shopify sync and automation
- Analytics
- Billing
- Queue operations
- Workspace settings

## Local development

Prerequisites:
- Node.js 20+
- npm

Steps:
1. Install dependencies with `npm ci`
2. Copy `.env.example` to `.env.local` and fill in any live provider keys you want to use
3. Start the app with `npm run dev`
4. Open `http://localhost:3000`

Notes:
- The application works without external AI keys by using deterministic fallbacks for product analysis and content generation.
- Billing, Shopify, video providers, and social publishing all support sandbox behavior when live credentials are not configured.
- SQLite runs from `storage/aurapost.db` in development and `/tmp/aurapost.db` in production.

## Production build

1. Build the client and bundled server:
   `npm run build`
2. Start the production server:
   `NODE_ENV=production PORT=8080 npm start`

## Deployment

Container deployment assets are included:
- `Dockerfile`
- `.dockerignore`
- `cloudrun.yaml`
- `cloudbuild.yaml`
- `.env.example`

Typical Cloud Run flow:
1. Build the container image
2. Push the image to Artifact Registry
3. Deploy with `cloudbuild.yaml` or `gcloud run deploy`

Update the image reference placeholders in `cloudrun.yaml` before deploying.
