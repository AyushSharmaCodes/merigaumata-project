ALTER TABLE public.contact_messages
ADD COLUMN IF NOT EXISTS subject TEXT;

CREATE INDEX IF NOT EXISTS idx_contact_messages_subject
    ON public.contact_messages(subject);

COMMENT ON COLUMN public.contact_messages.subject IS 'Structured contact form subject line supplied by the sender';
