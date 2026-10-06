-- 018_add_7_operations_data.sql
-- 운영_정은진.xlsx의 추가 조사 7개 시설 정보 등록

INSERT INTO public.operations (
    facility_key, facility_name, address_doro,
    investigator, investigation_date, parking_ground_cnt,
    parking_underground_cnt, parking_uninstalled_cnt, charger_installed_cnt,
    charger_fast_cnt, charger_slow_cnt, charger_uninstalled_cnt,
    normal_operator_qty, unoperated_cnt, location,
    unoperated_operator, initial_install_date, operation_status,
    unoperated_reason, unoperated_date, note,
    complaint_and_plan, manager_name_encrypted, manager_contact_encrypted
) VALUES
  ('K0326', '신창부영5차', '광주 광산구 신창로71번길 16', '정은진', '2026-09-23 00:00:00', 20, 5, 0, 25, 0, 25, 0, '플러그링크(20대), GS차지비(5대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABqxEcmHF6rev-3y51yrNDKj4B_lwFz0e0A6e_fr6YvTfPftw_yLuby7k_F75yZpC895wJFuIhqOyTyISYOkfkgQHfeug==', 'gAAAAABqxEcmzWWS2XNClSYT8Xm2SFBQLRgMgWC-6gqSl3e2TfujdjXjeOerS1IB0AgmjiSvzR4nHWKuwQ2vuXFkukR7E_04JA=='),
  ('K0001', '신창동 마한유적 체험관', '광주 광산구 북문대로 400번길 52', '정은진', '2026-09-23 00:00:00', 4, 0, 0, 2, 2, 0, 0, '', 2, '지상(주차장안쪽)', 'LS일렉트릭', '21년9월', '미운영', '', '', '', '지상 2대 설치는 되있으나 처음부터 사용안했음. 새로운 업체 선정중', 'gAAAAABqxEcmWwRBtyF4LHBdOq8kkd1er9B2HRi0xqXvsdoFen9ww1itueyt19HpSecUNJOEkGT_KpTXUcdy9eBDt33iY4D9jQ==', 'gAAAAABqxEcm7oEkI6HmTfo67f36H7vCsMv4tHICNOiBaW7r9Hhf6qZS4KyWF85yprSQ2DcWk69o1sm3LHnN84fP4lCZTaQAGA=='),
  ('K0325', '신창 도시공사', '광주 광산구 왕버들로252번길 46', '정은진', '2026-09-22 00:00:00', 12, 0, 16, 12, 0, 12, 0, '현대엔지니어링(12대)', 0, '', '', '', '정상운영', '', '', '', '미설치면수 16면은 계획중에 있음. 내년 6월까지 예상.', 'gAAAAABqxEcm928iffVLwsVndGwq9AK0YTkAn9om3FcLRBhFFrkHeNlprXh0R02DW8j1x0DOL5d64r6YXQ8gXTohzouPaQaHPw==', 'gAAAAABqxEcmwNfwXfIpWEwOyuMesp6JZKRzYZihWrqIkB7crx_eN329hqfjkFhFBu7CgScWVCslO3oZAM_SLVgakSsBfzvL4g=='),
  ('K0096', '산들요양병원', '광주 광산구 풍영정길 227-1', '정은진', '2026-09-22 00:00:00', 2, 0, 0, 2, 0, 2, 0, 'GS차지비(2대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABqxEcmYCj7GnPb-lbThPLk0O-eWUELocfd4Ku83ekqUYSGtfyuJpncGPieocxfRUZQ6rm5Lgrche-KGCccY36ZMUFxfw==', 'gAAAAABqxEcmmv8N7Dg0sFMtPO5pZbsxjjqm6NoMyukgYWfrgfif5eKZmMBNEQywG5aKxrKIlF8Kd8HBOHm6IjoC4NiPLTq26Q=='),
  ('K0428', '모아미래도', '광주 광산구 북문대로419번길 27-7', '정은진', '2026-09-21 00:00:00', 5, 5, 0, 10, 0, 10, 0, 'GS차지비(5대), 플러그링크(5대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABqxEcmdYk1uU-5u7C94I8xiSpbM9_3lIeeq4pWBDYQQW0KMgESUM4zc3vwp4_71J5qrs0fr7NEMH0yDODhyhOGo_JVOw==', 'gAAAAABqxEcmSqfUhOMivExrL9ZdUsVWnqQt3bvdHY56NVbFBHedKeQHpGh7kqkWaq9vF9_ax4FancqxWon2YnxyLlJSuUFMgg=='),
  ('K0103', '광주보건대학', '광주 광산구 북문대로419번길 73', '정은진', '2026-09-21 00:00:00', 9, 0, 0, 9, 2, 7, 0, 'GS차지비(9대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABqxEcmLDXrFnL5WrdeuxyAGYKlC4p0-NBKEpyj6XuowfmQOHZCrzNJQCHqDXGREGe8n7ezs7IFcMpohNPntrIKUB09gA==', 'gAAAAABqxEcm-SJIaaJ-7KBHfRMQspz0po7ADw02YGyViHP3VO0slDaeYXTfNvQGRsY9znqcnnOsvQur-dXofdkYMXSEpaE92A=='),
  ('K0158', '성덕중학교', '광주 광산구 장덕로 65', '정은진', '2026-08-20 00:00:00', 1, 0, 0, 1, 0, 1, 0, '태성콘텍(1대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABqxEcmXR4adfEIdY9lWqbv8Zl8gUYFNlqNSD6vzv9FoXDgFkFT9xtKU_i7engW1nI2J-tX8jiqBhSo0Ymk004jfT8F0A==', 'gAAAAABqxEcmX7E96TGdjsvArcZdVqeusl1SghVUEgqIa2tgtPmjF1lD5j33vrvc34mxMEsPSjRBMm2JKt2hLxOLHRXu5870DQ==');
