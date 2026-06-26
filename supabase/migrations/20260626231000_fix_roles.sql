INSERT INTO public.user_roles (user_id, role) VALUES 
('e6eddfb8-e947-4d09-8aa7-8e3fd8717804', 'company'), 
('11b1c53e-bf77-4761-bf88-861af5ff3ac3', 'driver') 
ON CONFLICT (user_id, role) DO NOTHING;
