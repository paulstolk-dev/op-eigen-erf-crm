-- pg_cron aanzetten voor de wekelijkse omgevingsplan-poller. De cron-job zelf
-- (cron.schedule → net.http_post naar de research-service /poll) wordt apart
-- gezet zodra de service-URL + secret bekend zijn (bevat een secret, dus niet
-- in een gecommitte migratie).
create extension if not exists pg_cron;
