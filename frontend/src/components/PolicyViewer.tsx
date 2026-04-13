import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import DOMPurify from "dompurify";
import { policyService, PolicyType } from "@/services/policy.service";
import { contactInfoService } from "@/services/contact-info.service";
import { useTranslation } from "react-i18next";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

interface PolicyViewerProps {
    type: PolicyType;
    fallbackContent?: React.ReactNode;
}

export function PolicyViewer({ type, fallbackContent }: PolicyViewerProps) {
    const { t, i18n } = useTranslation();

    // Fetch policy data - include language in query key for automatic refetch
    const { data: policy, isLoading: policyLoading, error: policyError } = useQuery({
        queryKey: ['policy', type, i18n.language],
        queryFn: () => policyService.getPublic(type),
        retry: 1,
    });

    // Fetch contact info for the footer
    const { data: contactInfo } = useQuery({
        queryKey: ['contactInfo', i18n.language],
        queryFn: () => contactInfoService.getAll(false),
    });

    useRealtimeInvalidation(
        ["policies", "contact_content"],
        [["policy", type], ["contactInfo"]],
    );

    // Loading state
    if (policyLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#B85C3C]" />
            </div>
        );
    }

    // Error state or no data - show fallback
    if (policyError || !policy) {
        return <div>{fallbackContent}</div>;
    }

    // Get primary email and phone
    const primaryEmail = contactInfo?.emails?.find(e => e.is_primary && e.is_active)?.email || 'Not Available';
    const primaryPhone = contactInfo?.phones?.find(p => p.is_primary && p.is_active)?.number || 'Not Available';
    const address = contactInfo?.address;

    // Check if content already starts with a heading to avoid redundancy
    const hasInternalTitle = policy.contentHtml?.trim().toLowerCase().startsWith('<h1') ||
        policy.contentHtml?.trim().toLowerCase().startsWith('<h2');

    return (
        <div className="bg-[#FAF9F6] min-h-screen py-10 md:py-16 px-6 md:px-16 lg:px-24">
            <div className="w-full">
                {/* Header */}
                {!hasInternalTitle && (
                    <div className="pb-8 border-b border-[#E5E5E5] mb-12">
                        <h1 className="text-5xl md:text-6xl font-bold font-playfair text-[#1A1A1A] mb-6 tracking-tight">
                            {t(policy.title)}
                        </h1>
                        {policy.updatedAt && (
                            <p className="text-[13px] text-[#666666] font-bold tracking-widest uppercase">
                                {t('common.lastUpdated', {
                                    date: new Date(policy.updatedAt).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long'
                                    })
                                })}
                            </p>
                        )}
                    </div>
                )}

                {/* Content */}
                <article
                    className="
                                prose prose-slate
                                max-w-none
                                prose-lg
                                md:prose-xl
                                dark:prose-invert
                                prose-headings:font-playfair
                                prose-headings:font-bold
                                prose-headings:text-[#1A1A1A]
                                prose-headings:tracking-tight
                                prose-p:text-[#4A4A4A]
                                prose-p:leading-[1.8]
                                prose-li:text-[#4A4A4A]
                                prose-li:leading-[1.8]
                                prose-strong:text-[#1A1A1A]
                                prose-strong:font-bold
                                prose-a:text-[#B85C3C]
                                prose-a:no-underline
                                hover:prose-a:underline
                                prose-ul:list-none
                                prose-ol:list-decimal
                                [&_ul]:list-none
                                [&_ol]:list-decimal
                                [&_ul]:pl-0
                                [&_li]:relative
                                [&_ul>li]:pl-7
                                [&_ul>li]:mb-2
                                [&_ul>li::before]:content-['']
                                [&_ul>li::before]:absolute
                                [&_ul>li::before]:left-0
                                [&_ul>li::before]:top-[0.7em]
                                [&_ul>li::before]:w-2
                                [&_ul>li::before]:h-2
                                [&_ul>li::before]:bg-[#B85C3C]
                                [&_ul>li::before]:rounded-full
                                [&_ul>li::before]:transition-transform
                                hover:[&_ul>li::before]:scale-110
                            "
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(policy.contentHtml) }}
                />

                {/* Contact Information Box */}
                <div className="pt-12 border-t border-[#E5E5E5]">
                    <div className="bg-white border border-[#E5E5E5] rounded-md p-8 md:p-10 shadow-sm max-w-3xl">
                        <h3 className="text-2xl font-bold font-playfair text-[#1A1A1A] mb-6">
                            {t('common.brandName')}
                        </h3>
                        <div className="space-y-3 text-[16px] leading-relaxed text-[#4A4A4A]">
                            <p>
                                <span className="font-bold text-[#1A1A1A]">{t('common.emailLabel')}</span> {primaryEmail}
                            </p>
                            <p>
                                <span className="font-bold text-[#1A1A1A]">{t('common.phoneLabel')}</span> {primaryPhone}
                            </p>
                            <p>
                                <span className="font-bold text-[#1A1A1A]">{t('common.responseTimeLabel')}</span>{' '}
                                {type === 'terms' ? '7–14 business days' :
                                    type === 'shipping-refund' ? 'Within 2–3 business days' :
                                        'Within 2–3 business days'}
                            </p>
                            {address && (
                                <p>
                                    <span className="font-bold text-[#1A1A1A]">{t('common.addressLabel')}</span>{' '}
                                    {[
                                        address.address_line1,
                                        address.address_line2,
                                        address.city,
                                        address.state,
                                        address.pincode
                                    ].filter(Boolean).join(', ')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
