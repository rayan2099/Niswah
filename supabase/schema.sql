-- Supabase Schema for niswah app

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLE: users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_hash TEXT, -- hashed — never store plain email
  madhhab TEXT CHECK (madhhab IN ('HANAFI','MALIKI','SHAFII','HANBALI')),
  language TEXT DEFAULT 'en',
  birth_year INT,
  display_name TEXT,
  anonymous_mode BOOLEAN DEFAULT false,
  premium_status BOOLEAN DEFAULT false,
  premium_expires_at TIMESTAMPTZ,
  avg_cycle_length INT DEFAULT 28,
  avg_haid_duration INT DEFAULT 5,
  known_adah_days INT,
  adah_confidence INT DEFAULT 0,
  goal_flags JSONB DEFAULT '[]',
  conditions JSONB DEFAULT '[]',
  notification_prefs JSONB DEFAULT '{}',
  prayer_calculation_method TEXT DEFAULT 'MWL',
  location_lat FLOAT,
  location_lng FLOAT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: cycle_entries
CREATE TABLE cycle_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_logged TIMESTAMPTZ NOT NULL,
  fiqh_state TEXT CHECK (fiqh_state IN ('HAID','TAHARA','NIFAS','ISTIHADAH')),
  flow_intensity TEXT CHECK (flow_intensity IN ('none','spotting','light','medium','heavy')),
  blood_color TEXT CHECK (blood_color IN ('red','dark','brown','pink','other')),
  blood_thickness TEXT CHECK (blood_thickness IN ('thick','thin','normal')),
  kursuf_used BOOLEAN,
  discharge_internal BOOLEAN,
  is_predicted BOOLEAN DEFAULT false,
  prediction_confidence INT DEFAULT 0,
  ramadan_day INT,
  fasting_status TEXT CHECK (fasting_status IN ('obligatory','lifted','qadha')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: symptoms_log
CREATE TABLE symptoms_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_entry_id UUID REFERENCES cycle_entries(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  symptom_type TEXT NOT NULL,
  severity INT CHECK (severity BETWEEN 1 AND 5),
  body_location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TABLE: prayer_log
CREATE TABLE prayer_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  prayer_name TEXT CHECK (prayer_name IN ('fajr','dhuhr','asr','maghrib','isha')),
  scheduled_time TIMESTAMPTZ,
  status TEXT CHECK (status IN ('prayed','qadha_required','lifted','missed')),
  fiqh_state_at_time TEXT,
  period_started_after_prayer_entered BOOLEAN,
  notes TEXT
);

-- TABLE: adah_ledger
CREATE TABLE adah_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_number INT,
  haid_start TIMESTAMPTZ NOT NULL,
  haid_end TIMESTAMPTZ,
  haid_duration_hours FLOAT,
  tuhr_duration_days FLOAT,
  blood_color_pattern JSONB DEFAULT '[]',
  blood_thickness_pattern JSONB DEFAULT '[]',
  istihadah_episode BOOLEAN DEFAULT false,
  scholar_consulted BOOLEAN DEFAULT false,
  notes TEXT
);

-- TABLE: istihadah_episodes
CREATE TABLE istihadah_episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  madhhab_at_time TEXT,
  tamyiz_applied BOOLEAN DEFAULT false,
  blood_distinguishable BOOLEAN,
  reverted_to_adah BOOLEAN DEFAULT false,
  adah_days_used INT,
  notes TEXT
);

-- TABLE: nifas_records
CREATE TABLE nifas_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  birth_date TIMESTAMPTZ NOT NULL,
  madhhab_max_days INT CHECK (madhhab_max_days IN (40, 60)),
  expected_end DATE,
  actual_end DATE,
  breastfeeding_started BOOLEAN DEFAULT false,
  notes TEXT
);

-- TABLE: ramadan_records
CREATE TABLE ramadan_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hijri_year INT,
  total_missed_fasting INT DEFAULT 0,
  qadha_completed INT DEFAULT 0,
  qadha_schedule JSONB DEFAULT '[]'
);

-- TABLE: pregnancy_records
CREATE TABLE pregnancy_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lmp_date DATE,
  due_date DATE,
  current_week INT,
  birth_date DATE,
  nifas_id UUID REFERENCES nifas_records(id) ON DELETE SET NULL,
  weekly_notes JSONB DEFAULT '{}'
);

-- TABLE: secret_vault_entries
CREATE TABLE secret_vault_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content TEXT, -- AES-256 encrypted client-side
  entry_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptoms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE prayer_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE adah_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE istihadah_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nifas_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ramadan_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pregnancy_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_vault_entries ENABLE ROW LEVEL SECURITY;

-- Policies for users
CREATE POLICY "Users can only read their own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can only insert their own data" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can only update their own data" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can only delete their own data" ON users FOR DELETE USING (auth.uid() = id);

-- Policies for cycle_entries
CREATE POLICY "Users can only read their own cycle_entries" ON cycle_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own cycle_entries" ON cycle_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own cycle_entries" ON cycle_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own cycle_entries" ON cycle_entries FOR DELETE USING (auth.uid() = user_id);

-- Policies for symptoms_log
CREATE POLICY "Users can only read their own symptoms_log" ON symptoms_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own symptoms_log" ON symptoms_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own symptoms_log" ON symptoms_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own symptoms_log" ON symptoms_log FOR DELETE USING (auth.uid() = user_id);

-- Policies for prayer_log
CREATE POLICY "Users can only read their own prayer_log" ON prayer_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own prayer_log" ON prayer_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own prayer_log" ON prayer_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own prayer_log" ON prayer_log FOR DELETE USING (auth.uid() = user_id);

-- Policies for adah_ledger
CREATE POLICY "Users can only read their own adah_ledger" ON adah_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own adah_ledger" ON adah_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own adah_ledger" ON adah_ledger FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own adah_ledger" ON adah_ledger FOR DELETE USING (auth.uid() = user_id);

-- Policies for istihadah_episodes
CREATE POLICY "Users can only read their own istihadah_episodes" ON istihadah_episodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own istihadah_episodes" ON istihadah_episodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own istihadah_episodes" ON istihadah_episodes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own istihadah_episodes" ON istihadah_episodes FOR DELETE USING (auth.uid() = user_id);

-- Policies for nifas_records
CREATE POLICY "Users can only read their own nifas_records" ON nifas_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own nifas_records" ON nifas_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own nifas_records" ON nifas_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own nifas_records" ON nifas_records FOR DELETE USING (auth.uid() = user_id);

-- Policies for ramadan_records
CREATE POLICY "Users can only read their own ramadan_records" ON ramadan_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own ramadan_records" ON ramadan_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own ramadan_records" ON ramadan_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own ramadan_records" ON ramadan_records FOR DELETE USING (auth.uid() = user_id);

-- Policies for pregnancy_records
CREATE POLICY "Users can only read their own pregnancy_records" ON pregnancy_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own pregnancy_records" ON pregnancy_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own pregnancy_records" ON pregnancy_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own pregnancy_records" ON pregnancy_records FOR DELETE USING (auth.uid() = user_id);

-- Policies for secret_vault_entries
CREATE POLICY "Users can only read their own secret_vault_entries" ON secret_vault_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own secret_vault_entries" ON secret_vault_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own secret_vault_entries" ON secret_vault_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own secret_vault_entries" ON secret_vault_entries FOR DELETE USING (auth.uid() = user_id);
