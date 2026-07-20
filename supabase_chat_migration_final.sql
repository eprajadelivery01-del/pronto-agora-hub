BEGIN;

-- 1. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NULL, -- Reference to orders, but nullable for general support
    participants UUID[] NOT NULL DEFAULT '{}', -- Array of user_ids or company_ids
    topic VARCHAR,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE
);

-- 3. Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Conversations Policies
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations" ON public.conversations
  FOR SELECT USING (
    auth.uid() = ANY(participants)
    OR EXISTS (
      SELECT 1 FROM public.companies 
      WHERE id = ANY(participants) 
      AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Participants can insert conversations" ON public.conversations;
CREATE POLICY "Participants can insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (
    auth.uid() = ANY(participants)
    OR EXISTS (
      SELECT 1 FROM public.companies 
      WHERE id = ANY(participants) 
      AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;
CREATE POLICY "Participants can update conversations" ON public.conversations
  FOR UPDATE USING (
    auth.uid() = ANY(participants)
    OR EXISTS (
      SELECT 1 FROM public.companies 
      WHERE id = ANY(participants) 
      AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Messages Policies
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = messages.conversation_id 
      AND (
        auth.uid() = ANY(participants)
        OR EXISTS (
          SELECT 1 FROM public.companies WHERE id = ANY(participants) AND user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
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
        auth.uid() = ANY(participants)
        OR EXISTS (
          SELECT 1 FROM public.companies WHERE id = ANY(participants) AND user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
        )
      )
    )
  );

-- Realtime setup
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

COMMIT;
