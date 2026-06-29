-- Fix RLS policies for conversations and messages to allow companies to access their chats by company ID

BEGIN;

DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT USING (
    auth.uid()::text = ANY(participants::text[])
    OR EXISTS (
      SELECT 1 FROM public.companies 
      WHERE id::text = ANY(participants::text[]) 
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can insert conversations" ON public.conversations;
CREATE POLICY "Participants can insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid()::text = ANY(participants::text[])
    OR EXISTS (
      SELECT 1 FROM public.companies 
      WHERE id::text = ANY(participants::text[]) 
      AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = messages.conversation_id 
      AND (
        auth.uid()::text = ANY(participants::text[])
        OR EXISTS (
          SELECT 1 FROM public.companies WHERE id::text = ANY(participants::text[]) AND user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Participants can insert messages" ON public.messages;
CREATE POLICY "Participants can insert messages" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = conversation_id 
      AND (
        auth.uid()::text = ANY(participants::text[])
        OR EXISTS (
          SELECT 1 FROM public.companies WHERE id::text = ANY(participants::text[]) AND user_id = auth.uid()
        )
      )
    )
  );

COMMIT;
