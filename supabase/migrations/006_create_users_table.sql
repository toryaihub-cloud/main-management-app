-- 006_create_users_table.sql
-- 사용자 계정 관리 및 권한 관리를 위한 영구 보존용 users 테이블 생성

CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,      -- 아이디 (예: ADMIN, USER1)
    password_hash TEXT NOT NULL,                -- 암호화/해시 처리된 비밀번호 (SHA256+Salt)
    name VARCHAR(100) NOT NULL,                 -- 사용자 이름/담당자명
    role VARCHAR(50) NOT NULL DEFAULT 'USER',   -- 권한 ('ADMIN' 또는 'USER')
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 관리자(ADMIN) 및 사용자(USER1) 초기 레코드 생성
INSERT INTO public.users (username, password_hash, name, role, created_at)
VALUES 
    ('ADMIN', '38a277ba1327f4fac5d6e94d755568a593b34c6b4f7eb7d03b3c07f03a9094f1', '최고 관리자', 'ADMIN', NOW()),
    ('USER1', '38a277ba1327f4fac5d6e94d755568a593b34c6b4f7eb7d03b3c07f03a9094f1', '일반 사용자 1', 'USER', NOW())
ON CONFLICT (username) DO NOTHING;

-- RLS 설정
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated/service_role" ON public.users;
CREATE POLICY "Allow all for authenticated/service_role" ON public.users
    FOR ALL USING (true) WITH CHECK (true);
