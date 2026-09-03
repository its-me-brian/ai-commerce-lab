-- Migration 040: Auto-add new users to default workspace
-- Creates a trigger that automatically adds newly signed-up users
-- as members of the 'ws-default' workspace with 'owner' role.

-- First, create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the new user as owner of the default workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES ('ws-default', NEW.id, 'owner')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on auth.users
-- This fires AFTER a new user is created in Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically adds new users to the default workspace (ws-default) as owner';
