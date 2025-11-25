-- Add webhook to call Edge Function when notification is created
-- This triggers push notifications to be sent to user devices

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to call Edge Function for push notifications
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  function_url TEXT;
  service_role_key TEXT;
  payload JSONB;
BEGIN
  -- REPLACE THESE WITH YOUR ACTUAL VALUES
  function_url := 'https://jwnfltfrzkujvlzwkwff.supabase.co/functions/v1/send-push-notification';
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3bmZsdGZyemt1anZsendrd2ZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDcyMDUyNCwiZXhwIjoyMDc2Mjk2NTI0fQ.9c-wws81Fku4cbVjKE3j-W4SA3BLkx1T7kz5lNAFrNQ';

  -- Build payload
  payload := jsonb_build_object(
    'notification_id', NEW.id,
    'user_id', NEW.user_id,
    'type', NEW.type,
    'title', NEW.title,
    'body', NEW.body,
    'data', NEW.data
  );

  -- Call Edge Function asynchronously using pg_net extension
  PERFORM
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := payload
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call Edge Function after notification insert
DROP TRIGGER IF EXISTS trigger_send_push_notification ON notifications;
CREATE TRIGGER trigger_send_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_push_notification();

COMMENT ON FUNCTION trigger_push_notification() IS 'Calls Edge Function to send push notifications to user devices';
