-- Per-artikel video-afleveringen: koppel content_queue aan een artikel, sla de
-- Veo-beeldlaag (b-roll) op en maak ruimte voor beide render-formaten (9:16 + 16:9).
alter table public.content_queue
  add column if not exists artikel_id uuid references public.artikelen(id) on delete set null,
  add column if not exists broll jsonb,          -- 3 shots met veo_prompt (bronprompts)
  add column if not exists broll_urls jsonb,      -- gegenereerde clip-URLs (na Veo)
  add column if not exists broll_status text not null default 'geen', -- geen|bezig|klaar|fout
  add column if not exists video_url_landscape text; -- 16:9 render (video_url = 9:16)

create index if not exists content_queue_artikel_id_idx on public.content_queue(artikel_id);
