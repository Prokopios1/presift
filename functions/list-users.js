const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'presift' });
const db = admin.firestore();
async function run() {
  const users = await db.collection('users').get();
  users.forEach(doc => {
    console.log(doc.id, doc.data().company, doc.data().name);
  });
}
run().catch(console.error);
