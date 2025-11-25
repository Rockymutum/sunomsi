# Push Notification Deployment Commands

# Run these commands one by one in your terminal

# 1. Login to Supabase (will open browser)
npx supabase login

# 2. Link your project (replace YOUR_PROJECT_REF with your actual project reference)
# Find it at: Supabase Dashboard → Settings → General → Reference ID
npx supabase link --project-ref YOUR_PROJECT_REF

# 3. Deploy the Edge Function
npx supabase functions deploy send-push-notification

# 4. After deployment, you'll get a URL like:
# https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification
# Copy this URL - you'll need it for the database configuration

# 5. Go to Supabase Dashboard → SQL Editor and run these commands:

# Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

# Configure database settings (replace with your actual values)
ALTER DATABASE postgres SET app.edge_function_url = 'https://YOUR_PROJECT.supabase.co/functions/v1/send-push-notification';
ALTER DATABASE postgres SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
ALTER DATABASE postgres SET app.supabase_project_ref = 'YOUR_PROJECT_REF';

# 6. Then run the trigger SQL file (add-push-notification-trigger.sql) in SQL Editor

# 7. Test by sending a message in your app!
