UPDATE auto_promotions
SET is_active = true,
    frequency_type = 'hourly',
    frequency_value = 120,
    start_time = '00:00:00',
    end_time = '23:59:00',
    last_executed = NULL
WHERE id = 'ec9e6f3d-cf6b-4016-82cb-774e5bdd10ea';