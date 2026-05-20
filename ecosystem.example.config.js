// PM2 process file (sample).
// 実運用ではこれをコピーして `ecosystem.config.js` を作成してください。
// 実ファイル `ecosystem.config.js` は .gitignore で除外されます。
module.exports = {
  apps: [{
    name: 'your-app-name',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3001',
    cwd: '/path/to/your/app',
    env: {
      NODE_ENV: 'production',
      PORT: '3001',
      // AUTH_URL: 'https://example.com',
      // NEXTAUTH_URL: 'https://example.com',
      // AUTH_TRUST_HOST: 'true',
      // NEXT_PUBLIC_SITE_URL: 'https://example.com',
    },
  }],
}
