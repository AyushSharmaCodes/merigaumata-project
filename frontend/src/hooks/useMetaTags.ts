import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CONFIG } from '@/config';

interface MetaTagsProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
  tags?: string[];
}

export function useMetaTags({
  title,
  description,
  image,
  url,
  type = 'website',
  author,
  publishedTime,
  tags,
}: MetaTagsProps) {
  const { t } = useTranslation();
  useEffect(() => {
    const fullUrl = url ? `${window.location.origin}${url}` : window.location.href;
    const defaultImage = CONFIG.DEFAULT_SOCIAL_IMAGE || "";

    // Update document title
    if (title) {
      document.title = `${title} | ${t('common.brandName')}`;
    }

    // Helper function to update or create meta tag
    const updateMetaTag = (selector: string, content: string, property?: string) => {
      if (!content) return;

      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement('meta');
        if (property) {
          element.setAttribute(property.includes(':') ? 'property' : 'name', property);
        }
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Update basic meta tags
    updateMetaTag('meta[name="description"]', description || '', 'description');
    updateMetaTag('meta[name="author"]', author || '', 'author');

    if (tags && tags.length > 0) {
      updateMetaTag('meta[name="keywords"]', tags.join(', '), 'keywords');
    }

    // Update Open Graph tags
    updateMetaTag('meta[property="og:title"]', title || '', 'og:title');
    updateMetaTag('meta[property="og:description"]', description || '', 'og:description');
    updateMetaTag('meta[property="og:type"]', type, 'og:type');
    updateMetaTag('meta[property="og:url"]', fullUrl, 'og:url');
    updateMetaTag('meta[property="og:image"]', image || defaultImage, 'og:image');
    updateMetaTag('meta[property="og:image:width"]', '1200', 'og:image:width');
    updateMetaTag('meta[property="og:image:height"]', '630', 'og:image:height');

    if (publishedTime) {
      updateMetaTag('meta[property="article:published_time"]', publishedTime, 'article:published_time');
    }

    if (author) {
      updateMetaTag('meta[property="article:author"]', author, 'article:author');
    }

    if (tags && tags.length > 0) {
      tags.forEach((tag, index) => {
        updateMetaTag(`meta[property="article:tag"][content="${tag}"]`, tag, 'article:tag');
      });
    }

    // Update Twitter Card tags
    updateMetaTag('meta[name="twitter:card"]', 'summary_large_image', 'twitter:card');
    updateMetaTag('meta[name="twitter:title"]', title || '', 'twitter:title');
    updateMetaTag('meta[name="twitter:description"]', description || '', 'twitter:description');
    updateMetaTag('meta[name="twitter:image"]', image || defaultImage, 'twitter:image');

    // Cleanup function to reset to defaults when component unmounts
    return () => {
      document.title = `${t('common.brandName')} - Honoring the Mother, Nurturing Your Life`;
    };
  }, [title, description, image, url, type, author, publishedTime, tags, t]);
}
