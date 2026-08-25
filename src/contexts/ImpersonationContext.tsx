import { createContext, useContext, useState, type ReactNode } from 'react';

interface ImpersonationContextType {
  targetId: string | null;
  setTargetId: (id: string | null) => void;
}

const ImpersonationContext = createContext<ImpersonationContextType>({ targetId: null, setTargetId: () => {} });

export const ImpersonationProvider = ({ children }: { children: ReactNode }) => {
  const [targetId, setTargetIdState] = useState<string | null>(() => {
    return sessionStorage.getItem('impersonatedId');
  });

  const setTargetId = (id: string | null) => {
    if (id) {
      sessionStorage.setItem('impersonatedId', id);
    } else {
      sessionStorage.removeItem('impersonatedId');
    }
    setTargetIdState(id);
  };

  return (
    <ImpersonationContext.Provider value={{ targetId, setTargetId }}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => useContext(ImpersonationContext);
