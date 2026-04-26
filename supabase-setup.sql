-- ============================================
-- AIライフプランナー - Supabase テーブル設定
-- ============================================
-- Supabaseダッシュボード > SQL Editor で実行してください

-- 1. categories テーブル
CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'task' CHECK (type IN ('task', 'routine', 'checklist')),
  parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. tasks テーブル
CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  memo TEXT,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  start_date TEXT,
  due_date TEXT,
  block TEXT CHECK (block IN ('morning', 'forenoon', 'afternoon', 'night')),
  parent_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  is_folder BOOLEAN DEFAULT FALSE,
  calendar_display TEXT CHECK (calendar_display IN ('bar', 'background')),
  reminder TEXT CHECK (reminder IN ('morning', 'day-before')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 3. routines テーブル
CREATE TABLE routines (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  block TEXT NOT NULL CHECK (block IN ('morning', 'forenoon', 'afternoon', 'night')),
  start_time TEXT,
  estimated_minutes INTEGER,
  days INTEGER[] NOT NULL DEFAULT '{}',
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. routine_completions テーブル
CREATE TABLE routine_completions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id BIGINT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (routine_id, date)
);

-- 5. reflections テーブル
CREATE TABLE reflections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  completed_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. user_profiles テーブル
CREATE TABLE user_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  wake_up_time TEXT NOT NULL DEFAULT '07:00',
  bed_time TEXT NOT NULL DEFAULT '23:00',
  time_mode TEXT DEFAULT 'fixed' CHECK (time_mode IN ('fixed', 'by-day', 'ai')),
  day_schedules JSONB,
  dreams TEXT,
  ideal_self TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. settings テーブル
CREATE TABLE user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  sound_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_by TEXT NOT NULL DEFAULT 'priority' CHECK (sort_by IN ('priority', 'dueDate', 'createdAt')),
  view_mode TEXT NOT NULL DEFAULT 'list' CHECK (view_mode IN ('list', 'grid')),
  setup_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. chat_messages テーブル
CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  actions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. check_lists テーブル
CREATE TABLE check_lists (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('packing', 'shopping')),
  color TEXT NOT NULL,
  category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. check_list_items テーブル
CREATE TABLE check_list_items (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id BIGINT NOT NULL REFERENCES check_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[],
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMPTZ
);

-- 11. purchase_history テーブル
CREATE TABLE purchase_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id BIGINT NOT NULL REFERENCES check_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- インデックス
-- ============================================
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_category_id ON tasks(category_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_routines_user_id ON routines(user_id);
CREATE INDEX idx_routine_completions_user_id ON routine_completions(user_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_check_lists_user_id ON check_lists(user_id);
CREATE INDEX idx_check_list_items_list_id ON check_list_items(list_id);

-- ============================================
-- RLS (Row Level Security) - ユーザー単位のアクセス制御
-- ============================================

-- 全テーブルでRLSを有効化
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;

-- 各テーブルのポリシー（自分のデータのみ読み書き可能）
-- categories
CREATE POLICY "Users can manage own categories" ON categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tasks
CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- routines
CREATE POLICY "Users can manage own routines" ON routines
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- routine_completions
CREATE POLICY "Users can manage own routine_completions" ON routine_completions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- reflections
CREATE POLICY "Users can manage own reflections" ON reflections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_profiles
CREATE POLICY "Users can manage own profile" ON user_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user_settings
CREATE POLICY "Users can manage own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- chat_messages
CREATE POLICY "Users can manage own chat_messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- check_lists
CREATE POLICY "Users can manage own check_lists" ON check_lists
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- check_list_items
CREATE POLICY "Users can manage own check_list_items" ON check_list_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- purchase_history
CREATE POLICY "Users can manage own purchase_history" ON purchase_history
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 12. push_subscriptions テーブル（プッシュ通知購読）
-- ※ user_idなし。サーバーサイドAPIルートからアクセスする設計
-- ============================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all push_subscriptions" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- 13. scheduled_notifications テーブル（スケジュール通知）
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notify_at TIMESTAMPTZ NOT NULL,
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'reminder',
  sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all scheduled_notifications" ON scheduled_notifications
  FOR ALL USING (true) WITH CHECK (true);
