const fs = require('fs');
const content = fs.readFileSync('src/__tests__/RegisterPage.test.tsx', 'utf8');
const newContent = content.replace(/await waitFor\(\(\) => \{/g, 'console.log("MOCKS:", createUserWithEmailAndPasswordMock.mock.calls, registerRecruiterMock.mock.calls); await waitFor(() => {');
fs.writeFileSync('src/__tests__/RegisterPage.test.tsx', newContent);
