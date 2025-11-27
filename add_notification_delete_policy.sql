-- Allow users to delete their own notifications
create policy "Users can delete their own notifications"
  on notifications for delete
  using (auth.uid() = user_id);
