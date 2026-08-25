import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export const ImpersonationBanner = () => {
  const navigate = useNavigate();
  const { targetId, setTargetId } = useImpersonation();
  
  if (!targetId) return null;

  const handleReturnToAdmin = () => {
    setTargetId(null);
    navigate('/admin');
  };

  return (
    <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between sticky top-0 z-50">
      <div className="text-sm font-medium">
        Viewing as Recruiter (ID: {targetId})
      </div>
      <Button 
        variant="secondary" 
        size="sm" 
        onClick={handleReturnToAdmin}
        className="h-8 bg-white text-orange-600 hover:bg-orange-50"
      >
        Return to Admin
      </Button>
    </div>
  );
};
