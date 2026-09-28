#!/data/data/com.termux/files/usr/bin/bash
set -e
echo "Building SaraVia on TestNet for production..."
npm run build
echo "Publishing to Netlify..."
npx --yes netlify-cli deploy --prod --dir=dist
echo "Deployment completed successfully!"
