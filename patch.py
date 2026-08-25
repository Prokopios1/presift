import glob
import os

files = glob.glob('src/__tests__/*.test.tsx')

mock_code = """
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: localStorage.getItem('presift_uid') || null } }))
}));
vi.mock('../contexts/ImpersonationContext', () => ({
  useImpersonation: vi.fn(() => ({ targetId: null, setTargetId: vi.fn() }))
}));
"""

for f in files:
    with open(f, 'r') as fp:
        content = fp.read()
    
    if 'useAuth' not in content:
        idx = content.find('\ndescribe(')
        if idx != -1:
            new_content = content[:idx] + '\n' + mock_code + '\n' + content[idx:]
            with open(f, 'w') as fp:
                fp.write(new_content)
            print("Patched", f)
