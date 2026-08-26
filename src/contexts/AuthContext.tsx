import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  role: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const idTokenResult = await currentUser.getIdTokenResult();
          if (idTokenResult.claims.admin) {
            setRole('admin');
            setLoading(false);
            return;
          }

          // Primary: post-migration profile doc at users/{authUid}
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setRole(userDoc.data()?.role || 'recruiter');
          } else {
            // Fallback: legacy profile doc keyed by the old localStorage ID
            // (e.g. users/admin_prokopios, see scripts/bootstrap-admin.mjs),
            // which stores the auth UID as a field. Without this, admins whose
            // profile hasn't been migrated to users/{authUid} yet resolve to
            // 'recruiter' and get bounced away from /admin.
            const legacyQuery = await getDocs(
              query(collection(db, 'users'), where('authUid', '==', currentUser.uid))
            );
            const legacyDoc = legacyQuery.docs[0];
            setRole((legacyDoc?.data()?.role as string | undefined) || 'recruiter');
          }
        } catch (error) {
          console.error("Failed to fetch user role:", error);
          setRole(null);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
