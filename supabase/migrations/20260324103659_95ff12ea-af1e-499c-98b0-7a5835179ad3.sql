
-- ==========================================
-- ENUMS
-- ==========================================
CREATE TYPE public.app_role AS ENUM ('user', 'coach', 'admin');
CREATE TYPE public.lead_status AS ENUM (
  'conversation_engagee', 'en_cours', 'appel_propose',
  'follow_up', 'rendez_vous_booke', 'ferme_perdu', 'non_qualifie'
);
CREATE TYPE public.content_type AS ENUM ('script', 'objection', 'recommendation', 'coach_note');

-- ==========================================
-- PROFILES
-- ==========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER ROLES (separate table, never on profiles)
-- ==========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- COACH ASSIGNMENTS
-- ==========================================
CREATE TABLE public.coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, user_id)
);

ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- LEADS
-- ==========================================
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  linkedin_url TEXT,
  status lead_status NOT NULL DEFAULT 'conversation_engagee',
  company_name TEXT,
  job_title TEXT,
  source_type TEXT DEFAULT 'manuel',
  campaign_tag TEXT,
  outreach_type TEXT,
  notes TEXT,
  follow_up_date DATE,
  loss_reason TEXT,
  disqualification_reason TEXT,
  coach_notes TEXT,
  custom_tags TEXT[],
  conversation_started_at TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  call_proposed_at TIMESTAMPTZ,
  meeting_booked_at TIMESTAMPTZ,
  closed_lost_at TIMESTAMPTZ,
  unqualified_at TIMESTAMPTZ,
  last_status_change_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- LEAD EVENTS (for KPI calculation)
-- ==========================================
CREATE TABLE public.lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- COACHING CONTENTS
-- ==========================================
CREATE TABLE public.coaching_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type content_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[],
  is_global BOOLEAN NOT NULL DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coaching_contents ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SECURITY DEFINER FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_coach_of(_coach_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_assignments
    WHERE coach_id = _coach_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_coached_user_ids(_coach_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.coach_assignments WHERE coach_id = _coach_id
$$;

-- ==========================================
-- UPDATED_AT TRIGGER FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coaching_contents_updated_at BEFORE UPDATE ON public.coaching_contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- AUTO-CREATE PROFILE + DEFAULT ROLE ON SIGNUP
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- RLS POLICIES: PROFILES
-- ==========================================
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Coaches can view their students profiles" ON public.profiles
  FOR SELECT USING (public.is_coach_of(auth.uid(), id));

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ==========================================
-- RLS POLICIES: USER_ROLES
-- ==========================================
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- RLS POLICIES: COACH_ASSIGNMENTS
-- ==========================================
CREATE POLICY "Coaches can view own assignments" ON public.coach_assignments
  FOR SELECT USING (auth.uid() = coach_id);

CREATE POLICY "Users can view own assignment" ON public.coach_assignments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage assignments" ON public.coach_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- RLS POLICIES: LEADS
-- ==========================================
CREATE POLICY "Users can view own leads" ON public.leads
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Coaches can view their students leads" ON public.leads
  FOR SELECT USING (public.is_coach_of(auth.uid(), owner_id));

CREATE POLICY "Admins can view all leads" ON public.leads
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own leads" ON public.leads
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own leads" ON public.leads
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Coaches can update coach_notes on their students leads" ON public.leads
  FOR UPDATE USING (public.is_coach_of(auth.uid(), owner_id));

CREATE POLICY "Users can delete own leads" ON public.leads
  FOR DELETE USING (auth.uid() = owner_id);

-- ==========================================
-- RLS POLICIES: LEAD_EVENTS
-- ==========================================
CREATE POLICY "Users can view own lead events" ON public.lead_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Coaches can view their students lead events" ON public.lead_events
  FOR SELECT USING (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "Admins can view all lead events" ON public.lead_events
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own lead events" ON public.lead_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- RLS POLICIES: COACHING_CONTENTS
-- ==========================================
CREATE POLICY "Users can view global contents" ON public.coaching_contents
  FOR SELECT USING (is_global = true);

CREATE POLICY "Users can view contents targeted to them" ON public.coaching_contents
  FOR SELECT USING (auth.uid() = target_user_id);

CREATE POLICY "Users can view own contents" ON public.coaching_contents
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Coaches can view contents they created" ON public.coaching_contents
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Coaches can view contents of their students" ON public.coaching_contents
  FOR SELECT USING (public.is_coach_of(auth.uid(), target_user_id));

CREATE POLICY "Admins can view all contents" ON public.coaching_contents
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can create contents" ON public.coaching_contents
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'coach') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can create own contents" ON public.coaching_contents
  FOR INSERT WITH CHECK (auth.uid() = owner_id AND target_user_id IS NULL);

CREATE POLICY "Coaches can update their contents" ON public.coaching_contents
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all contents" ON public.coaching_contents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_leads_owner ON public.leads(owner_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_follow_up_date ON public.leads(follow_up_date);
CREATE INDEX idx_lead_events_lead ON public.lead_events(lead_id);
CREATE INDEX idx_lead_events_user ON public.lead_events(user_id);
CREATE INDEX idx_lead_events_type ON public.lead_events(event_type);
CREATE INDEX idx_lead_events_created ON public.lead_events(created_at);
CREATE INDEX idx_coaching_contents_type ON public.coaching_contents(type);
CREATE INDEX idx_coaching_contents_target ON public.coaching_contents(target_user_id);
CREATE INDEX idx_coach_assignments_coach ON public.coach_assignments(coach_id);
