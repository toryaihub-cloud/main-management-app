-- 003_create_users_table.sql
-- 사용자 계정 관리 및 관리자 권한 관리를 위한 테이블 생성

CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL, -- 아이디 (예: ADMIN)
    password_hash TEXT NOT NULL, -- 암호화/해시 처리된 비밀번호
    name VARCHAR(100) NOT NULL, -- 사용자 이름
    role VARCHAR(50) NOT NULL DEFAULT 'USER', -- 권한 ('ADMIN' 또는 'USER')
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책 설정
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on users" ON public.users;
CREATE POLICY "Allow public select on users" ON public.users
    FOR SELECT USING (true);
