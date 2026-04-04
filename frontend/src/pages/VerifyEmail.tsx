import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/errorUtils';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const token = searchParams.get('token');

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage(t('verifyEmail.invalidLink'));
            return;
        }

        const verifyEmail = async () => {
            try {
                const response = await apiClient.get(`/auth/verify-email?token=${token}`);
                if (response.data.success) {
                    setStatus('success');
                    setMessage(response.data.message || t('verifyEmail.successMsg'));
                } else {
                    setStatus('error');
                    setMessage(response.data.error || t('verifyEmail.failedMsg'));
                }
            } catch (error: unknown) {
                setStatus('error');
                setMessage(getErrorMessage(error, t, 'verifyEmail.errorMsg'));
            }
        };

        verifyEmail();
    }, [token]);

    const handleGoToLogin = () => {
        navigate('/', { state: { openAuth: true } });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4">
                        {status === 'loading' && (
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="w-8 h-8 text-red-600" />
                            </div>
                        )}
                    </div>
                    <CardTitle className="text-2xl">
                        {status === 'loading' && t('verifyEmail.loadingTitle')}
                        {status === 'success' && t('verifyEmail.successTitle')}
                        {status === 'error' && t('verifyEmail.errorTitle')}
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                        {message}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    {status === 'success' && (
                        <Button onClick={handleGoToLogin} className="w-full">
                            {t('verifyEmail.continueLogin')}
                        </Button>
                    )}
                    {status === 'error' && (
                        <div className="space-y-3">
                            <Button onClick={handleGoToLogin} variant="outline" className="w-full">
                                {t('verifyEmail.goHome')}
                            </Button>
                            <p className="text-sm text-muted-foreground">
                                <Mail className="inline-block w-4 h-4 mr-1" />
                                {t('verifyEmail.contactSupport')}
                            </p>
                        </div>
                    )}
                    {status === 'loading' && (
                        <p className="text-sm text-muted-foreground">
                            {t('verifyEmail.loadingDesc')}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
