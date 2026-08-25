const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/__tests__/*.test.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('../contexts/AuthContext')) {
    const mockCode = `
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('../contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));
`;
    // Find first empty line or first describe
    const insertIdx = content.indexOf('describe(');
    if (insertIdx !== -1) {
      content = content.slice(0, insertIdx) + mockCode + '\n' + content.slice(insertIdx);
      fs.writeFileSync(file, content);
      console.log('patched ' + file);
    }
  }
});
