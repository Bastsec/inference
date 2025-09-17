-- Create system_alerts table for monitoring and alerting
CREATE TABLE system_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service VARCHAR(50) NOT NULL, -- e.g., 'litellm', 'proxy', 'payments'
    severity VARCHAR(20) NOT NULL, -- e.g., 'info', 'warning', 'error', 'critical'
    message TEXT NOT NULL,
    details JSONB, -- Additional structured data about the alert
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create monitoring_logs table for tracking health checks over time
CREATE TABLE monitoring_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service VARCHAR(50) NOT NULL,
    check_type VARCHAR(50) NOT NULL, -- e.g., 'health', 'performance', 'sync_status'
    status VARCHAR(20) NOT NULL, -- e.g., 'success', 'warning', 'error'
    response_time_ms INTEGER,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_system_alerts_service ON system_alerts(service);
CREATE INDEX idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX idx_system_alerts_created_at ON system_alerts(created_at);
CREATE INDEX idx_system_alerts_resolved ON system_alerts(resolved);

CREATE INDEX idx_monitoring_logs_service ON monitoring_logs(service);
CREATE INDEX idx_monitoring_logs_check_type ON monitoring_logs(check_type);
CREATE INDEX idx_monitoring_logs_status ON monitoring_logs(status);
CREATE INDEX idx_monitoring_logs_created_at ON monitoring_logs(created_at);

-- Create RPC function to log monitoring data
CREATE OR REPLACE FUNCTION log_monitoring_check(
    p_service text,
    p_check_type text,
    p_status text,
    p_response_time_ms integer DEFAULT NULL,
    p_details jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    log_id uuid;
BEGIN
    INSERT INTO monitoring_logs (
        service, check_type, status, response_time_ms, details
    ) VALUES (
        p_service, p_check_type, p_status, p_response_time_ms, p_details
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Create RPC function to create system alerts
CREATE OR REPLACE FUNCTION create_system_alert(
    p_service text,
    p_severity text,
    p_message text,
    p_details jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    alert_id uuid;
BEGIN
    INSERT INTO system_alerts (
        service, severity, message, details
    ) VALUES (
        p_service, p_severity, p_message, p_details
    ) RETURNING id INTO alert_id;
    
    RETURN alert_id;
END;
$$ LANGUAGE plpgsql;

-- Create RPC function to resolve alerts
CREATE OR REPLACE FUNCTION resolve_system_alert(
    p_alert_id uuid,
    p_resolved_by uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE system_alerts
    SET resolved = TRUE,
        resolved_at = NOW(),
        resolved_by = p_resolved_by
    WHERE id = p_alert_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for recent monitoring summary
CREATE VIEW monitoring_summary AS
SELECT 
    service,
    check_type,
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE status = 'success') as successful_checks,
    COUNT(*) FILTER (WHERE status = 'error') as failed_checks,
    AVG(response_time_ms) as avg_response_time_ms,
    MAX(created_at) as last_check_at
FROM monitoring_logs 
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY service, check_type;

-- Create view for active alerts
CREATE VIEW active_alerts AS
SELECT 
    id,
    service,
    severity,
    message,
    details,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_since_created
FROM system_alerts 
WHERE resolved = FALSE
ORDER BY 
    CASE severity 
        WHEN 'critical' THEN 1
        WHEN 'error' THEN 2
        WHEN 'warning' THEN 3
        WHEN 'info' THEN 4
    END,
    created_at DESC;
