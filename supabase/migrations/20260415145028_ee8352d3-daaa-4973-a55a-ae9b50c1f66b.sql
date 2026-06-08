
-- Assign roles for test accounts
-- Coach
UPDATE public.user_roles SET role = 'coach' WHERE user_id = 'b14b8646-ee07-4f2a-b6c2-86ecb85b555e';
UPDATE public.profiles SET role = 'coach' WHERE id = 'b14b8646-ee07-4f2a-b6c2-86ecb85b555e';

-- Admin
UPDATE public.user_roles SET role = 'admin' WHERE user_id = '3afcdf8e-592f-49cd-914e-a2f98f6044cf';
UPDATE public.profiles SET role = 'admin' WHERE id = '3afcdf8e-592f-49cd-914e-a2f98f6044cf';

-- Mark all test accounts as onboarding completed
UPDATE public.profiles SET onboarding_completed = true WHERE id IN (
  'f404f525-1ec2-4f43-abed-4a17b165d323',
  'b14b8646-ee07-4f2a-b6c2-86ecb85b555e',
  '3afcdf8e-592f-49cd-914e-a2f98f6044cf',
  '6d793759-871a-446b-9674-4d598cf19151'
);
