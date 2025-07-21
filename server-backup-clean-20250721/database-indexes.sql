-- DATABASE PERFORMANCE OPTIMIZATION: Critical Indexes for 1000 Concurrent Users
-- Run these indexes to dramatically improve query performance

-- CRITICAL: User-based queries (most frequent)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_user_id ON gigs (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_user_date ON gigs (user_id, date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_user_status ON gigs (user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_date ON gigs (date);

-- Goals indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_goals_user_id ON goals (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_monthly_goals_user_year_month ON monthly_goals (user_id, year, month);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_yearly_goals_user_year ON yearly_goals (user_id, year);

-- Expenses indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_user_id ON expenses (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date);

-- Authentication indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_replit_id ON users (replit_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_session_id ON user_sessions (session_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);

-- Password reset indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens (token);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_user_date_status ON gigs (user_id, date, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_date_status ON gigs (date, status);

-- PERFORMANCE BOOST: Partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_active_users ON gigs (user_id) WHERE status IN ('upcoming', 'pending payment', 'completed');
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active ON users (id) WHERE is_active = true AND is_deleted = false;

-- MEMORY OPTIMIZATION: Expression indexes for calculated fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gigs_total_amount ON gigs ((COALESCE(actual_pay, expected_pay) + COALESCE(tips, 0)));

-- SESSION CLEANUP: Index for automatic cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expire ON sessions (expire);

-- AUDIT LOG PERFORMANCE
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);

-- Update table statistics for query planner optimization
ANALYZE gigs;
ANALYZE users;
ANALYZE goals;
ANALYZE expenses;
ANALYZE monthly_goals;
ANALYZE yearly_goals;
ANALYZE user_sessions;
ANALYZE password_reset_tokens;