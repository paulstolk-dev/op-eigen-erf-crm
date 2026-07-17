-- Kolommen die de publieke site (opeigenerf.nl, gemeenten.ts) opvraagt. Zonder
-- deze kolommen crasht de frontend-query en rendert er niets — ook niet als de
-- bestaande velden gevuld zijn. Alle nullable; redactioneel te vullen vanuit het CRM.
alter table public.gemeenten
  add column if not exists provincie text,
  add column if not exists karakter text,
  add column if not exists omgevingsplan_wijziging_datum date,
  add column if not exists welstand text,
  add column if not exists beschermd_gezicht text,
  add column if not exists mantelzorg_beleid text,
  add column if not exists mantelzorg_beleid_url text,
  add column if not exists loket_url text,
  add column if not exists contact_telefoon text,
  add column if not exists bron_urls text[];
