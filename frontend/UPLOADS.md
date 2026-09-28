# File and Profile Photo Uploads

Chat attachments and custom profile photos are uploaded directly from the browser to Cloudinary using an unsigned upload preset. Multiple files and folder contents are sent as individual attachments; folder-relative names are preserved. The cloud name and preset are public configuration values, not API secrets.

## Configure local development

Create `frontend/.env.local` with the Cloudinary **cloud name** (not API key or API secret) and unsigned preset name:

```env
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name
REACT_APP_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

Restart the frontend dev server after changing this file. `.env.local` is ignored by Git.

## Configure Vercel

In the Vercel project, add both variables under **Settings > Environment Variables** for Production (and Preview if needed), then redeploy. CRA reads these variables at build time, so an existing deployment will not pick them up until rebuilt.

In Cloudinary, create an unsigned upload preset and allow the resource types needed by your app: image, video, audio, and raw for documents. Chat uploads are limited to 15 MB; profile images are limited to 10 MB. The uploader uses Cloudinary's `auto` resource type for media and `raw` for other files.

The previous hard-coded value `c-86564d8be2f45cd32567657acca041` returned `Unknown API key`; replace it with the actual Cloudinary cloud name from the Cloudinary dashboard. Never put a Cloudinary API secret in frontend environment variables.
