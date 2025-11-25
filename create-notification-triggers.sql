-- Function to notify user about new message
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name
  FROM profiles
  WHERE user_id = NEW.sender_id;

  -- Create notification for receiver
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'message',
    'New Message',
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    jsonb_build_object('chatId', NEW.sender_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new messages
DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Function to notify about new comment
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  commenter_name TEXT;
  task_owner_id UUID;
BEGIN
  -- Get commenter name
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Get task owner
  SELECT poster_id INTO task_owner_id
  FROM tasks
  WHERE id = NEW.task_id;

  -- Don't notify if commenting on own task
  IF task_owner_id != NEW.user_id THEN
    -- Create notification for task owner
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      task_owner_id,
      'comment',
      'New Comment',
      COALESCE(commenter_name, 'Someone') || ' commented on your task',
      jsonb_build_object('taskId', NEW.task_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new comments
DROP TRIGGER IF EXISTS trigger_notify_new_comment ON comments;
CREATE TRIGGER trigger_notify_new_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_comment();

-- Function to notify about new application
CREATE OR REPLACE FUNCTION notify_new_application()
RETURNS TRIGGER AS $$
DECLARE
  applicant_name TEXT;
  task_owner_id UUID;
BEGIN
  -- Get applicant name
  SELECT full_name INTO applicant_name
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- Get task owner
  SELECT poster_id INTO task_owner_id
  FROM tasks
  WHERE id = NEW.task_id;

  -- Create notification for task owner
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    task_owner_id,
    'application',
    'New Application',
    COALESCE(applicant_name, 'Someone') || ' applied to your task',
    jsonb_build_object('taskId', NEW.task_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new applications
DROP TRIGGER IF EXISTS trigger_notify_new_application ON applications;
CREATE TRIGGER trigger_notify_new_application
  AFTER INSERT ON applications
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_application();

COMMENT ON FUNCTION notify_new_message() IS 'Creates notification when new message is sent';
COMMENT ON FUNCTION notify_new_comment() IS 'Creates notification when someone comments on a task';
COMMENT ON FUNCTION notify_new_application() IS 'Creates notification when someone applies to a task';
