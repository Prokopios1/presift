const { execSync } = require('child_process');

try {
  execSync('npm run test src/__tests__/CampaignsPage.test.tsx -- --reporter=verbose', { stdio: 'inherit' });
} catch (e) {}
