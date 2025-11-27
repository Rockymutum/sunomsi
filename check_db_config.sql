
SELECT policyname, cmd, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'tasks';

SELECT tgname 
FROM pg_trigger 
WHERE tgrelid = 'notifications'::regclass;
