import { Facebook, Twitter, Linkedin, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
  className?: string;
}

export function SocialShare({ url, title, description, className = '' }: SocialShareProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
  const encodedUrl = encodeURIComponent(fullUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || '');

  const facebookShareBase = import.meta.env.VITE_SOCIAL_FACEBOOK_SHARE_URL;
  const twitterShareBase = import.meta.env.VITE_SOCIAL_TWITTER_SHARE_URL;
  const linkedinShareBase = import.meta.env.VITE_SOCIAL_LINKEDIN_SHARE_URL;
  const whatsappShareBase = import.meta.env.VITE_SOCIAL_WHATSAPP_SHARE_URL;

  const shareLinks = {
    facebook: `${facebookShareBase}?u=${encodedUrl}`,
    twitter: `${twitterShareBase}?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `${linkedinShareBase}?url=${encodedUrl}`,
    whatsapp: `${whatsappShareBase}?text=${encodedTitle}%20${encodedUrl}`,
  };

  const handleShare = (platform: string, link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer,width=600,height=600');
    toast({
      title: t('common.openingDialog'),
      description: t('common.sharingOn', { platform }),
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast({
        title: t('common.linkCopied'),
        description: t('common.linkCopiedDesc'),
      });
    } catch (err) {
      toast({
        title: t('common.failedToCopy'),
        description: t('common.failedToCopyDesc'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare(t('common.facebook'), shareLinks.facebook)}
          className="gap-2"
        >
          <Facebook className="h-4 w-4" />
          <span className="hidden sm:inline">{t('common.facebook')}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare(t('common.twitter'), shareLinks.twitter)}
          className="gap-2"
        >
          <Twitter className="h-4 w-4" />
          <span className="hidden sm:inline">{t('common.twitter')}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare(t('common.linkedin'), shareLinks.linkedin)}
          className="gap-2"
        >
          <Linkedin className="h-4 w-4" />
          <span className="hidden sm:inline">{t('common.linkedin')}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare(t('common.whatsapp'), shareLinks.whatsapp)}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">{t('common.whatsapp')}</span>
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={copyToClipboard}
          className="gap-2"
        >
          {t('common.copyLink')}
        </Button>
      </div>
    </div>
  );
}
