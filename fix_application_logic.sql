
-- Fix RLS for Tasks (ensure posters can update)
DROP POLICY IF EXISTS "Posters can update their own tasks" ON tasks;
CREATE POLICY "Posters can update their own tasks" ON tasks FOR UPDATE USING (auth.uid() = poster_id);

-- Fix RLS for Applications (ensure posters can update status)
DROP POLICY IF EXISTS "Posters can update applications for their tasks" ON applications;
CREATE POLICY "Posters can update applications for their tasks" ON applications FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM tasks 
    WHERE id = applications.task_id 
    AND poster_id = auth.uid()
  )
);

-- Function to notify poster on new application
CREATE OR REPLACE FUNCTION notify_poster_on_new_application()
RETURNS TRIGGER AS $$
DECLARE
  poster_id uuid;
  task_title text;
BEGIN
  -- Get task details
  SELECT t.poster_id, t.title INTO poster_id, task_title
  FROM tasks t
  WHERE t.id = NEW.task_id;

  -- Insert notification
  INSERT INTO notifications (user_id, type, task_id, sender_id, title, body, data)
  VALUES (
    poster_id,
    'application',
    NEW.task_id,
    NEW.worker_id,
    'New Application Received',
    'Someone applied for your task: ' || task_title,
    jsonb_build_object('taskId', NEW.task_id, 'workerId', NEW.worker_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new application
DROP TRIGGER IF EXISTS on_new_application ON applications;
CREATE TRIGGER on_new_application
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_poster_on_new_application();


-- Function to notify worker on application acceptance
CREATE OR REPLACE FUNCTION notify_worker_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  task_title text;
BEGIN
  -- Only run if status changed to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    -- Get task title
    SELECT title INTO task_title
    FROM tasks
    WHERE id = NEW.task_id;

    -- Insert notification
    INSERT INTO notifications (user_id, type, task_id, sender_id, title, body, data)
    VALUES (
      NEW.worker_id,
      'application',
      NEW.task_id,
      auth.uid(), -- The poster who accepted
      'Application Accepted! 🎉',
      'You have been hired for: ' || task_title,
      jsonb_build_object('taskId', NEW.task_id, 'status', 'accepted')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for application acceptance
DROP TRIGGER IF EXISTS on_application_approval ON applications;
CREATE TRIGGER on_application_approval
  AFTER UPDATE ON applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_worker_on_approval();
