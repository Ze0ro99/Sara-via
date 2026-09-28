#!/data/data/com.termux/files/usr/bin/bash
set -e
echo "Building SaraVia Hologram & Radar Platform..."
npm run build
echo "Deploying production build to Netlify..."
npx --yes netlify-cli deploy --prod --dir=dist
echo "Deployment completed successfully!"
