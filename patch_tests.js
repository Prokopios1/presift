const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('src/__tests__/*.test.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Insert mocks at the top after imports
  if (!content.includes('vi.mock(\'../contexts/AuthContext\'')) {
    const mockCode = `
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('../contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));
`;
    // Find the last import
    const importRegex = /^import .* from '.*';$/gm;
    let lastMatch;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      lastMatch = match;
    }
    
    if (lastMatch) {
      const insertIdx = lastMatch.index + lastMatch[0].length;
      content = content.slice(0, insertIdx) + '\n' + mockCode + content.slice(insertIdx);
    }
  }

  // Rewrite localStorage tests? Actually, if we mock useAuth to read from localStorage.getItem('presift_uid') inside the mock function, the tests that do localStorage.setItem('presift_uid', '...') will STILL pass because the mock returns it dynamically!
  // Wait, vi.fn() evaluated at call time? Yes!
  // Let's test if this works.

  fs.writeFileSync(file, content);
});
