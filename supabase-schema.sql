-- SUPABASE PDF SERVICE SCHEMA
-- Creates tables for caching and managing PDF reports with audit trails

-- Reports bucket for PDF storage
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', true);

-- Report caching table for enterprise-grade performance
CREATE TABLE IF NOT EXISTS cached_reports (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('professional', 'simple', 'mobile')),
  period TEXT NOT NULL CHECK (period IN ('monthly', 'annual')),
  year INTEGER NOT NULL,
  month INTEGER NULL,
  pdf_url TEXT NULL,
  html_content TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Constraints
  CONSTRAINT valid_month CHECK (month IS NULL OR (month >= 1 AND month <= 12)),
  CONSTRAINT valid_year CHECK (year >= 2020 AND year <= 2030),
  CONSTRAINT has_content CHECK (pdf_url IS NOT NULL OR html_content IS NOT NULL)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cached_reports_user_id ON cached_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_cached_reports_expires_at ON cached_reports(expires_at);
CREATE INDEX IF NOT EXISTS idx_cached_reports_type_period ON cached_reports(report_type, period);
CREATE INDEX IF NOT EXISTS idx_cached_reports_user_period ON cached_reports(user_id, period, year);

-- Report generation audit log for tracking and debugging
CREATE TABLE IF NOT EXISTS report_generation_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  report_type TEXT NOT NULL,
  period TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NULL,
  generation_status TEXT NOT NULL CHECK (generation_status IN ('success', 'failed', 'cached')),
  error_message TEXT NULL,
  generation_time_ms INTEGER NULL,
  file_size_bytes INTEGER NULL,
  cached_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- JSON metadata for debugging
  request_metadata JSONB DEFAULT '{}',
  system_metadata JSONB DEFAULT '{}'
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_report_log_user_id ON report_generation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_report_log_created_at ON report_generation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_report_log_status ON report_generation_log(generation_status);

-- Report performance metrics for monitoring
CREATE TABLE IF NOT EXISTS report_performance_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_requests INTEGER DEFAULT 0,
  successful_generations INTEGER DEFAULT 0,
  failed_generations INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  avg_generation_time_ms NUMERIC(10,2) DEFAULT 0,
  total_data_size_bytes BIGINT DEFAULT 0,
  
  -- Performance benchmarks
  p50_generation_time_ms NUMERIC(10,2) DEFAULT 0,
  p95_generation_time_ms NUMERIC(10,2) DEFAULT 0,
  p99_generation_time_ms NUMERIC(10,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(date)
);

-- Index for daily metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_date ON report_performance_metrics(date);

-- Row Level Security (RLS) for report caching
ALTER TABLE cached_reports ENABLE ROW LEVEL SECURITY;

-- Users can only access their own cached reports
CREATE POLICY "Users can access their own cached reports" 
ON cached_reports FOR ALL 
USING (user_id = current_setting('app.current_user_id')::INTEGER);

-- Service role can access all reports for maintenance
CREATE POLICY "Service role full access to cached reports" 
ON cached_reports FOR ALL 
USING (current_setting('role') = 'service_role');

-- Audit log RLS (users can view their own logs, service role can view all)
ALTER TABLE report_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generation logs" 
ON report_generation_log FOR SELECT 
USING (user_id = current_setting('app.current_user_id')::INTEGER);

CREATE POLICY "Service role full access to generation logs" 
ON report_generation_log FOR ALL 
USING (current_setting('role') = 'service_role');

-- Performance metrics RLS (read-only for authenticated users, full access for service role)
ALTER TABLE report_performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view performance metrics" 
ON report_performance_metrics FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role full access to performance metrics" 
ON report_performance_metrics FOR ALL 
USING (current_setting('role') = 'service_role');

-- Storage policies for reports bucket
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('reports', 'pdfs/.gitkeep', '{}') ON CONFLICT DO NOTHING;

-- Allow authenticated users to read their own reports
CREATE POLICY "Users can read their own PDFs" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'reports' AND name LIKE 'pdfs/%' AND 
       (storage.foldername(name))[1]::INTEGER = current_setting('app.current_user_id')::INTEGER);

-- Allow service role to manage all files
CREATE POLICY "Service role can manage all reports" 
ON storage.objects FOR ALL 
USING (bucket_id = 'reports');

-- Cleanup function to remove expired cached reports
CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired cached reports
  DELETE FROM cached_reports 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup activity
  INSERT INTO report_generation_log (
    user_id, 
    report_type, 
    period, 
    year, 
    generation_status, 
    error_message,
    system_metadata
  ) VALUES (
    -1, -- System user
    'cleanup', 
    'system', 
    EXTRACT(YEAR FROM NOW())::INTEGER,
    'success',
    NULL,
    jsonb_build_object('deleted_count', deleted_count, 'cleanup_time', NOW())
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- This would be enabled in a production Supabase environment
-- SELECT cron.schedule('cleanup-expired-reports', '0 2 * * *', 'SELECT cleanup_expired_reports();');

-- Performance monitoring function
CREATE OR REPLACE FUNCTION update_daily_performance_metrics()
RETURNS VOID AS $$
DECLARE
  metric_date DATE := CURRENT_DATE;
  total_reqs INTEGER;
  success_count INTEGER;
  fail_count INTEGER;
  cache_hit_count INTEGER;
  avg_time NUMERIC;
  total_size BIGINT;
BEGIN
  -- Calculate daily metrics from log
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE generation_status = 'success'),
    COUNT(*) FILTER (WHERE generation_status = 'failed'),
    COUNT(*) FILTER (WHERE cached_used = true),
    AVG(generation_time_ms),
    SUM(file_size_bytes)
  INTO total_reqs, success_count, fail_count, cache_hit_count, avg_time, total_size
  FROM report_generation_log
  WHERE DATE(created_at) = metric_date;
  
  -- Insert or update daily metrics
  INSERT INTO report_performance_metrics (
    date, total_requests, successful_generations, failed_generations,
    cache_hits, cache_misses, avg_generation_time_ms, total_data_size_bytes
  ) VALUES (
    metric_date, total_reqs, success_count, fail_count,
    cache_hit_count, total_reqs - cache_hit_count, avg_time, COALESCE(total_size, 0)
  )
  ON CONFLICT (date) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    successful_generations = EXCLUDED.successful_generations,
    failed_generations = EXCLUDED.failed_generations,
    cache_hits = EXCLUDED.cache_hits,
    cache_misses = EXCLUDED.cache_misses,
    avg_generation_time_ms = EXCLUDED.avg_generation_time_ms,
    total_data_size_bytes = EXCLUDED.total_data_size_bytes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Create initial metrics for today
SELECT update_daily_performance_metrics();

-- Grant necessary permissions
GRANT ALL ON cached_reports TO authenticated, anon, service_role;
GRANT ALL ON report_generation_log TO authenticated, anon, service_role;
GRANT ALL ON report_performance_metrics TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_reports() TO service_role;
GRANT EXECUTE ON FUNCTION update_daily_performance_metrics() TO service_role;

-- Enable realtime for admin monitoring (optional)
-- ALTER publication supabase_realtime ADD TABLE report_performance_metrics;

COMMENT ON TABLE cached_reports IS 'Caches generated PDF and HTML reports for performance optimization';
COMMENT ON TABLE report_generation_log IS 'Audit trail for all report generation attempts with debugging metadata';
COMMENT ON TABLE report_performance_metrics IS 'Daily performance metrics for monitoring report generation system health';
COMMENT ON FUNCTION cleanup_expired_reports() IS 'Removes expired cached reports and logs cleanup activity';
COMMENT ON FUNCTION update_daily_performance_metrics() IS 'Calculates and stores daily performance metrics from generation logs';