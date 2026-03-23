-- Create function to get event registration stats in bulk
CREATE OR REPLACE FUNCTION get_event_registration_stats(event_ids UUID[])
RETURNS TABLE(event_id UUID, total_count BIGINT, cancelled_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        er.event_id,
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE er.status = 'cancelled') as cancelled_count
    FROM public.event_registrations er
    WHERE er.event_id = ANY(event_ids)
    GROUP BY er.event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
