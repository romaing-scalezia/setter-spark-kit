-- ============================================================
-- V1 -> V2 MIGRATION: Chieppa
-- V1: b09d851c-a8b6-4fb6-9b65-e27022a33127
-- V2: 5c740059-f0d5-4a45-8827-3f9dab1764d0
-- Generated 2026-07-28 -- Idempotent: ON CONFLICT (id) DO NOTHING
-- ============================================================

-- Disable auto-task triggers during backfill: historical task rows are
-- provided explicitly below and would otherwise conflict with the
-- trigger-generated 'auto'/'manual' task for the same (lead_id, task_type).
ALTER TABLE public.leads DISABLE TRIGGER trg_lead_status_task;
ALTER TABLE public.leads DISABLE TRIGGER trg_lead_manual_followup_task;

-- -- 1. PERSONAS (2 rows) --
INSERT INTO public.personas
  (id, name, description, target_type, sector, company_size, target_role,
   maturity_level, main_problems, objectives, frequent_objections,
   recommended_approach, coach_notes, created_by, created_at, updated_at)
VALUES
  ('b8d609b8-7604-430b-872a-03337f17037a', 'DSI/RSI de PME/ETI Industrie', 'DSI / RSI / Responsable IT de PME ou d''ETI française, généralement entre 35 et 55 ans, souvent dans une structure de 300 à 600 collaborateurs, qui porte la cybersécurité "par défaut" faute de RSSI interne.', 'PME', 'Industrie', '200+', 'DSI,RSI', NULL, 'Il porte la cybersécurité sans avoir ni le temps, ni le cadre, ni les ressources, ni la légitimité pour la piloter correctement.

Premier problème : il est responsable de la cybersécurité sans moyens, sans temps et sans gouvernance. Il sait ce qu''il faudrait faire, mais il n''a ni cadre, ni soutien, ni ressources pour le faire correctement.
Deuxième problème : il n''a aucune vision claire de son niveau réel de risque. Il avance au radar, avec la peur permanente d''un incident qu''il ne verrait pas venir.
Troisième problème : il subit les pressions du COMEX, des métiers, des audits, des clients et des assureurs sans pouvoir répondre de manière structurée. Il doit justifier, rassurer et prouver, mais sans matière, sans preuve tangible et sans plan d''ensemble
', NULL, NULL, 'CyberPilot GRC ne vend pas de la cybersécurité "de plus".
CyberPilot GRC vend la sortie du chaos invisible.
Le prospect n''achète pas un audit.
Il n''achète pas un outil.
Il n''achète pas un consultant ISO.
Il achète un copilote stratégique GRC qui l''aide à :
- reprendre le contrôle
- prioriser
- structurer
- convaincre sa direction
- sortir du rôle de pompier
- installer une gouvernance durable.
', NULL, '5c740059-f0d5-4a45-8827-3f9dab1764d0', '2026-04-23 05:33:44.30224+00', '2026-04-23 05:33:44.30224+00'),
  ('9bb3b390-d4ae-4c10-bfa6-3360028d2041', 'DSI/RSI de PME/ETI Tech/SaaS', NULL, 'SaaS', 'Tech / SaaS', '200+', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '5c740059-f0d5-4a45-8827-3f9dab1764d0', '2026-04-23 13:15:29.231022+00', '2026-04-23 13:15:29.231022+00')
ON CONFLICT (id) DO NOTHING;

-- -- 2. LEADS (12 rows) --
INSERT INTO public.leads
  (id, owner_id, setter_id, first_name, last_name, linkedin_url,
   status, source_type, outreach_type, company_name, job_title,
   notes, follow_up_date, loss_reason, disqualification_reason,
   coach_notes, custom_tags, campaign_tag,
   conversation_started_at, first_response_at, call_proposed_at,
   meeting_booked_at, closed_lost_at, unqualified_at,
   last_status_change_at, created_at, updated_at,
   reason_detail, persona_id, follow_up_level)
VALUES
  ('fd197633-4d71-4f5c-952d-4393158c4f31', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Thomas', 'Wagner', 'https://www.linkedin.com/in/thomas-wagner-527a1530', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'Lynxeo', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-23 12:02:39.225+00', NULL, NULL, NULL, NULL, NULL, '2026-04-23 12:02:39.083895+00', '2026-04-23 12:02:39.083895+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0),
  ('c300dd07-de72-4c52-87d5-e484a9eb47c9', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Magalie', 'Arnoux', 'https://www.linkedin.com/in/arnouxmagalie', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'TIVOLY Group', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-24 14:25:07.349+00', NULL, NULL, NULL, NULL, NULL, '2026-04-24 14:25:06.215337+00', '2026-04-24 14:25:06.215337+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0),
  ('a90149e2-9552-4583-af0e-af90ce074bae', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Nicolas', 'Lagardère', 'https://www.linkedin.com/in/nicolaslagardere', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'MECADAQ GROUP', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:22:01.679+00', NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:22:01.524528+00', '2026-04-23 13:22:01.524528+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0),
  ('ab8305c0-8303-406f-870d-eb04cb539974', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Woilide', 'Nagmar', 'https://www.linkedin.com/in/wnagmar', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'EA Pharma', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-24 14:33:22.587+00', NULL, NULL, NULL, NULL, NULL, '2026-04-24 14:33:20.831134+00', '2026-04-24 14:33:20.831134+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0),
  ('d2d02a18-4810-4ecb-90b4-a7859371b3e7', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Timothée', 'Saumet', 'https://www.linkedin.com/in/timsaumet', 'en_cours'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'Efalia ', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:14:25.492+00', '2026-04-24 12:46:17.06+00', NULL, NULL, NULL, NULL, '2026-04-24 12:46:17.059+00', '2026-04-23 13:14:25.33971+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0),
  ('5abeefdb-a315-4195-b3be-04d122ad82a1', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Christian', 'Boulanger', 'https://www.linkedin.com/in/christian-boulanger', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'Groupe Baudelet', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-24 12:59:46.669+00', NULL, NULL, NULL, NULL, NULL, '2026-04-24 12:59:45.080568+00', '2026-04-24 12:59:45.080568+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0),
  ('e4f976f8-cd1e-432c-a99a-f7baf1ef5a30', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Rodolphe', 'Oddoux', 'https://www.linkedin.com/in/rodolphe-o', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'Transports FATTON ', 'RSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:23:29.749+00', NULL, NULL, NULL, NULL, NULL, '2026-04-23 13:23:29.643739+00', '2026-04-23 13:23:29.643739+00', '2026-05-25 09:26:17.409709+00', NULL, NULL, 0),
  ('3e05b847-52f8-404a-a6ff-1a9a3f524384', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Guillaume', 'Morlet ', 'https://www.linkedin.com/in/guillaume-morlet', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'Macompta.fr', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-24 13:30:07.74+00', NULL, NULL, NULL, NULL, NULL, '2026-04-24 13:30:06.127841+00', '2026-04-24 13:30:06.127841+00', '2026-05-25 09:26:17.409709+00', NULL, '9bb3b390-d4ae-4c10-bfa6-3360028d2041', 0),
  ('06907596-e1c7-46a8-bd2b-f68279c941ea', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Jonathan', 'Ganem', 'https://www.linkedin.com/in/jonathanganem', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'EFICIA', 'Responsable Cybersécurité et Réseaux', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-24 13:40:44.239+00', NULL, NULL, NULL, NULL, NULL, '2026-04-24 13:40:42.554942+00', '2026-04-24 13:40:42.554942+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0),
  ('feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Vincent', 'Peigneux', 'https://www.linkedin.com/in/vincent-peigneux-99a87a36/?lipi=urn%3Ali%3Apage%3Ad_flagship3_feed%3BqLImXWwhS626T17wTfmz2Q%3D%3D', 'follow_up'::lead_status, 'manuel'::source_type_enum, 'autre'::outreach_type_enum, 'Chartreuse', 'RSI', NULL, '2026-06-15', NULL, NULL, NULL, NULL, NULL, '2026-04-23 05:49:56.172+00', NULL, NULL, NULL, NULL, NULL, '2026-04-29 12:35:52.317+00', '2026-04-23 05:49:56.80932+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 2),
  ('cf5675a7-3f98-4992-b32a-af06c3348885', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Marwan', 'Ben Rajeb', 'https://www.linkedin.com/in/marwan-ben-rajeb-442b553b/', 'rendez_vous_booke'::lead_status, 'manuel'::source_type_enum, 'autre'::outreach_type_enum, 'N4Brands', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-23 05:50:39.24+00', NULL, NULL, '2026-04-23 05:50:41.314+00', NULL, NULL, '2026-04-23 05:50:41.314+00', '2026-04-23 05:50:39.742759+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0),
  ('46a5ba1c-73ab-4bda-9b07-9916a0e5e5ce', '5c740059-f0d5-4a45-8827-3f9dab1764d0', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'Ludovic', 'LAJOIE', 'https://www.linkedin.com/in/lajoie-ludovic-lla', 'conversation_engagee'::lead_status, 'manuel'::source_type_enum, 'message_texte'::outreach_type_enum, 'Albingia', 'DSI', NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-23 11:50:46.49+00', NULL, NULL, NULL, NULL, NULL, '2026-04-23 11:50:46.902563+00', '2026-04-23 11:50:46.902563+00', '2026-05-25 09:26:17.409709+00', NULL, 'b8d609b8-7604-430b-872a-03337f17037a', 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.leads ENABLE TRIGGER trg_lead_status_task;
ALTER TABLE public.leads ENABLE TRIGGER trg_lead_manual_followup_task;

-- -- 3. LEAD EVENTS (21 rows) --
INSERT INTO public.lead_events
  (id, lead_id, user_id, event_type, old_value, new_value, metadata, created_at)
VALUES
  ('f1ecf1ed-163b-45d7-9223-0a6322e3d753', 'fd197633-4d71-4f5c-952d-4393158c4f31', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-23 12:02:39.200392+00'),
  ('48d8a520-148f-424c-b780-ed305a4895b3', 'c300dd07-de72-4c52-87d5-e484a9eb47c9', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-24 14:25:07.344313+00'),
  ('81ef15d3-d7cc-4421-aa45-3d3ba168fd96', 'a90149e2-9552-4583-af0e-af90ce074bae', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-23 13:22:01.691343+00'),
  ('502079ae-21e8-46bc-8beb-fc14fdbd183e', 'ab8305c0-8303-406f-870d-eb04cb539974', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-24 14:33:20.943836+00'),
  ('77313737-62b2-41cf-afc2-7984db5d29a8', 'd2d02a18-4810-4ecb-90b4-a7859371b3e7', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-23 13:14:25.492528+00'),
  ('458a3a14-d734-4044-b743-ae2acc0c1f2e', 'd2d02a18-4810-4ecb-90b4-a7859371b3e7', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'status_changed', 'conversation_engagee', 'en_cours', NULL, '2026-04-24 12:46:15.629771+00'),
  ('545888b3-1173-4fe5-9f2e-afeb55274013', '5abeefdb-a315-4195-b3be-04d122ad82a1', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-24 12:59:45.178711+00'),
  ('e62ed3f3-ce2b-4f15-9bf8-7820ea7c9d41', 'e4f976f8-cd1e-432c-a99a-f7baf1ef5a30', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-23 13:23:29.862355+00'),
  ('fb46edaf-7a4e-42be-a580-5f894e84e089', '3e05b847-52f8-404a-a6ff-1a9a3f524384', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-24 13:30:06.314284+00'),
  ('af767c92-2f01-4956-820a-d6aa31123569', '06907596-e1c7-46a8-bd2b-f68279c941ea', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-24 13:40:42.686507+00'),
  ('3f7b0591-b98c-4824-8ddf-cadfca1ec0dc', 'feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-23 05:49:57.128261+00'),
  ('c4df4cc4-8e3e-4446-b495-fe9bd10804a3', 'feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'status_changed', 'conversation_engagee', 'rendez_vous_booke', NULL, '2026-04-23 05:50:12.116743+00'),
  ('28689a24-372c-47e3-8617-d4984ed178ba', 'feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'note_added', NULL, 'Présentation CyberPilot GRC
en attente retour du DAF', NULL, '2026-04-23 05:52:10.549237+00'),
  ('ba153777-4900-4fb3-85b1-c78c80d94c0a', 'feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'note_added', NULL, 'Le DAF ne veut pas s engager sur 24mois
Beaucoup de projets en cours engagés pour le nouveau RSI
proposition pour une formule oneshot 18jours (3j/mois sur 6mois avec prog spe)', NULL, '2026-04-23 05:53:02.923515+00'),
  ('238de1cb-183b-409c-9a8b-14eec6f61ed2', 'feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'status_changed', 'rendez_vous_booke', 'follow_up', '{"disqualification_reason":null,"follow_up_date":"2026-04-28","loss_reason":null,"reason_detail":null}'::jsonb, '2026-04-23 13:08:40.201517+00'),
  ('b7d99b81-f4a1-4bb7-8771-d8f37d9ba5a8', 'feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'status_changed', 'follow_up', 'rendez_vous_booke', NULL, '2026-04-23 13:08:43.387385+00'),
  ('1612b357-987a-4a20-bf31-7bcebbbeb9a9', 'feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'status_changed', 'rendez_vous_booke', 'follow_up', '{"disqualification_reason":null,"follow_up_date":"2026-06-15","loss_reason":null,"reason_detail":null}'::jsonb, '2026-04-29 12:35:51.996992+00'),
  ('77413a87-ab3c-49bd-84ff-4c8af6cb31b2', 'cf5675a7-3f98-4992-b32a-af06c3348885', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-23 05:50:39.914508+00'),
  ('a20d3785-d2f1-434a-a09d-0d964407b667', 'cf5675a7-3f98-4992-b32a-af06c3348885', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'status_changed', 'conversation_engagee', 'rendez_vous_booke', NULL, '2026-04-23 05:50:41.919628+00'),
  ('4eeeef26-d5b6-4110-aec2-47d684b72ce5', 'cf5675a7-3f98-4992-b32a-af06c3348885', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'note_added', NULL, 'Présentation CyberPilot GRC
En attente date pour présentation au CODIR', NULL, '2026-04-23 05:51:35.826124+00'),
  ('27c68fee-0c7e-4c57-989d-9ae5e8db8acc', '46a5ba1c-73ab-4bda-9b07-9916a0e5e5ce', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'lead_created', NULL, 'conversation_engagee', NULL, '2026-04-23 11:50:47.343783+00')
ON CONFLICT (id) DO NOTHING;

-- -- 4. TASKS (10 rows) --
INSERT INTO public.tasks
  (id, lead_id, user_id, task_type, priority, due_date, status,
   snoozed_until, completed_at, source, created_at, updated_at)
VALUES
  ('ebb6e376-dccc-4c6a-8039-0cf3f6d14863', 'fd197633-4d71-4f5c-952d-4393158c4f31', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00'),
  ('17bc76f3-a943-4e63-b117-6923c494da3d', 'c300dd07-de72-4c52-87d5-e484a9eb47c9', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00'),
  ('43ebc9ae-d60b-458b-884f-384637be27f7', 'a90149e2-9552-4583-af0e-af90ce074bae', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00'),
  ('eab55b34-f30b-4abd-bd08-bc49ef937778', 'ab8305c0-8303-406f-870d-eb04cb539974', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00'),
  ('98c86288-882e-4aaa-bb4c-854d5c233877', '5abeefdb-a315-4195-b3be-04d122ad82a1', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00'),
  ('b8b86f18-4e25-4a61-b3f5-4e97dc0c162c', 'e4f976f8-cd1e-432c-a99a-f7baf1ef5a30', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00'),
  ('9dab83da-fa0e-4787-824b-1d748d4f0081', '3e05b847-52f8-404a-a6ff-1a9a3f524384', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00'),
  ('1d981209-3bb5-456f-b848-68cec7eb0532', '06907596-e1c7-46a8-bd2b-f68279c941ea', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00'),
  ('28535ea8-58d3-4875-956b-1bc1c9e18993', 'feed4f6b-3f0e-46cb-b9c6-4a235601ca81', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'manual_followup'::task_type, 'high'::task_priority, '2026-06-15', 'pending'::task_status, NULL, NULL, 'manual', '2026-04-29 12:35:51.814045+00', '2026-04-29 12:35:51.814045+00'),
  ('0fc0064e-4deb-4d05-a745-5db5e0921c86', '46a5ba1c-73ab-4bda-9b07-9916a0e5e5ce', '5c740059-f0d5-4a45-8827-3f9dab1764d0', 'conversation_followup'::task_type, 'medium'::task_priority, '2026-04-30', 'pending'::task_status, NULL, NULL, 'auto', '2026-04-28 16:59:33.471354+00', '2026-04-28 16:59:33.471354+00')
ON CONFLICT (id) DO NOTHING;
