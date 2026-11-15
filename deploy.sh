#!/usr/bin/env bash
# Build the web app and publish web/dist to the gh-pages branch (GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/web"
npm run build
cd dist
touch .nojekyll
rm -rf .git
git init -q -b gh-pages
git -c core.autocrlf=false add -A
git -c user.name="kaushikvinoba" commit -q -m "Deploy Horizon Line build"
git push -q -f https://github.com/kaushikvinoba/horizon-line.git gh-pages
echo "Deployed: https://kaushikvinoba.github.io/horizon-line/"
