#!/data/data/com.termux/files/usr/bin/bash
set -e
echo "Building SaraVia platform with Vite..."
npm run build
echo "Deploying production build to Netlify..."
npx --yes netlify-cli deploy --prod --dir=dist
echo "Deployment to Netlify completed successfully!"
