
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE tablename IN ('returns', 'return_items');

SELECT 
    relname, 
    relrowsecurity, 
    relforcerowsecurity 
FROM pg_class 
WHERE relname IN ('returns', 'return_items');
