import { Button } from '@/components/ui/button';
import { useI18n } from '@/contexts/I18nContext';
import { Globe } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useI18n();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-2 ${className}`}
          onClick={() => setLanguage(language === 'en' ? 'gr' : 'en')}
        >
          <Globe className="w-4 h-4" />
          <span className="font-semibold uppercase">{language}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {language === 'en' ? 'Switch to Greek' : 'Αλλαγή σε Αγγλικά'}
      </TooltipContent>
    </Tooltip>
  );
}
