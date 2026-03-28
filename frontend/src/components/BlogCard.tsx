import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLocalizedContent } from "@/utils/localizationUtils";
import { Calendar, User } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Blog } from '@/types';

interface BlogCardProps {
  blog: Blog;
}

export const BlogCard = ({ blog }: BlogCardProps) => {
  const { t, i18n } = useTranslation();
  return (
    <Link to={`/blog/${blog.id}`} className="block h-full">
      <Card className="group hover:shadow-elevated transition-all duration-500 h-full flex flex-col border-none bg-white rounded-[2rem] overflow-hidden">
        {blog.image && (
          <div className="relative overflow-hidden aspect-[16/10]">
            <img
              src={blog.image}
              alt={getLocalizedContent(blog, i18n.language, 'title')}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2C1810]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="absolute top-4 left-4">
              <span className="bg-white/90 backdrop-blur-md text-[#2C1810] text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                {t("nav.journal")}
              </span>
            </div>
          </div>
        )}

        <CardHeader className="p-6 pb-2">
          <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#B85C3C] mb-3">
            <Calendar className="h-3 w-3" />
            <span>{new Date(blog.date).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <h3 className="font-playfair text-xl font-bold text-[#2C1810] line-clamp-2 group-hover:text-[#B85C3C] transition-colors duration-300 leading-snug">
            {getLocalizedContent(blog, i18n.language, 'title')}
          </h3>
        </CardHeader>

        <CardContent className="px-6 pb-6 flex-1">
          <p className="text-sm text-muted-foreground font-light line-clamp-2 italic leading-relaxed">
            "{getLocalizedContent(blog, i18n.language, 'excerpt')}"
          </p>
        </CardContent>

        <CardFooter className="px-6 pb-8 pt-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#2C1810]/40 group-hover:text-[#B85C3C] transition-colors duration-300">
            <span>{t("nav.readInvestigation")}</span>
            <div className="h-[1px] w-4 bg-current transition-all duration-300 group-hover:w-8" />
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
};
