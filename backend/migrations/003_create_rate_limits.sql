-- Create rate limiting table for spam prevention
-- Tracks comment submission rates per user per blog

CREATE TABLE IF NOT EXISTS public.comment_rate_limits (
    -- Primary key
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Foreign keys
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    
    -- Rate tracking
    comment_count INTEGER DEFAULT 1 NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL, -- Calculated column, populated on insert
    
    -- Constraints
    CONSTRAINT valid_comment_count CHECK (comment_count > 0),
    UNIQUE(user_id, blog_id, window_start)
);

-- Create indexes
CREATE INDEX idx_rate_limits_user_blog ON public.comment_rate_limits(user_id, blog_id);
-- Removed partial index condition "WHERE window_end > now()" because now() is not immutable
CREATE INDEX idx_rate_limits_window ON public.comment_rate_limits(window_end);

-- Enable RLS
ALTER TABLE public.comment_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own rate limits"
ON public.comment_rate_limits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can manage rate limits"
ON public.comment_rate_limits FOR ALL
USING (true)
WITH CHECK (true);

-- Function to check if user has exceeded rate limit
CREATE OR REPLACE FUNCTION check_comment_rate_limit(
    p_user_id UUID,
    p_blog_id UUID,
    p_max_comments INTEGER DEFAULT 5
) RETURNS TABLE (
    is_allowed BOOLEAN,
    comments_remaining INTEGER,
    window_resets_at TIMESTAMP WITH TIME ZONE,
    current_count INTEGER
) AS $$
DECLARE
    v_current_count INTEGER;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_window_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get most recent active window for this user and blog
    SELECT comment_count, window_start, window_end
    INTO v_current_count, v_window_start, v_window_end
    FROM public.comment_rate_limits
    WHERE user_id = p_user_id
    AND blog_id = p_blog_id
    AND window_end > now()
    ORDER BY window_start DESC
    LIMIT 1;
    
    -- If no active window found, user is allowed
    IF NOT FOUND THEN
        RETURN QUERY SELECT 
            true,
            p_max_comments,
            NULL::TIMESTAMP WITH TIME ZONE,
            0;
        RETURN;
    END IF;
    
    -- Check if limit exceeded
    IF v_current_count >= p_max_comments THEN
        RETURN QUERY SELECT 
            false,
            0,
            v_window_end,
            v_current_count;
    ELSE
        RETURN QUERY SELECT 
            true,
            p_max_comments - v_current_count,
            v_window_end,
            v_current_count;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION increment_comment_rate_limit(
    p_user_id UUID,
    p_blog_id UUID
) RETURNS VOID AS $$
DECLARE
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_window_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Round down to nearest 5-minute window
    v_window_start := date_trunc('hour', now()) + 
                      (EXTRACT(minute FROM now())::INTEGER / 5) * INTERVAL '5 minutes';
    
    v_window_end := v_window_start + INTERVAL '5 minutes';
    
    -- Insert or update rate limit record
    INSERT INTO public.comment_rate_limits (user_id, blog_id, window_start, window_end, comment_count)
    VALUES (p_user_id, p_blog_id, v_window_start, v_window_end, 1)
    ON CONFLICT (user_id, blog_id, window_start)
    DO UPDATE SET comment_count = comment_rate_limits.comment_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old rate limit records
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete records older than 1 hour
    DELETE FROM public.comment_rate_limits
    WHERE window_end < (now() - INTERVAL '1 hour');
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON TABLE public.comment_rate_limits IS 'Rate limiting for comment submissions (5 comments per 5 minutes per user per blog)';
COMMENT ON COLUMN public.comment_rate_limits.window_start IS 'Start of the 5-minute rate limit window';
COMMENT ON COLUMN public.comment_rate_limits.window_end IS 'End of the 5-minute window (manually calculated as window_start + 5 minutes)';
COMMENT ON FUNCTION check_comment_rate_limit IS 'Check if user can post comment (returns allowed status, remaining count, and reset time)';
COMMENT ON FUNCTION increment_comment_rate_limit IS 'Increment comment count for current rate limit window';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Remove rate limit records older than 1 hour (should be run periodically)';
