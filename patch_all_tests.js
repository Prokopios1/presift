const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/__tests__/*.test.tsx');

const mockCode = `
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('../contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));
`;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  if (!content.includes('AuthContext')) {
    const insertIdx = content.indexOf('\ndescribe(');
    if (insertIdx !== -1) {
      content = content.slice(0, insertIdx) + '\n' + mockCode + '\n' + content.slice(insertIdx);
      fs.writeFileSync(file, content);
      console.log('patched ' + file);
    } else {
        const importIdx = content.lastIndexOf('import ');
        const newlineIdx = content.indexOf('\n', importIdx);
        content = content.slice(0, newlineIdx) + '\n' + mockCode + '\n' + content.slice(newlineIdx);
        fs.writeFileSync(file, content);
        console.log('patched ' + file + ' (fallback)');
    }
  }
});
