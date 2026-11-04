-- 020_add_11_operations_data.sql
-- 운영현황_11.xlsx의 추가 조사 11개 시설 정보 등록/동기화

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
  ('K0191', '운남주공6단지', '광주 광산구 목련로153번길 134', '정은진', '2026-10-29 00:00:00', 13, 12, 0, 25, 0, 25, 0, '에버온(13대), 파워큐브(12대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABq6pRPm8-oazhtY1Itp4nWgSFBum8dK9CxTPTWgERxQhZwyC8u8WftUSdZLCLWd58OmHkwclSiYbLZsawUE4CuvzoGbg==', 'gAAAAABq6pRPZr0uXawL3P4ApPUmbgo0FfEwKnMr4b6ivG3s6wPAQX4gA-AKJEnl_tAVvzJQmnjQ3o87a4t9Z2yF8MeU96z7DQ=='),
  ('K0465', '노상주차장(월곡동 538-1)', '광주 광산구 사암로 271', '정은진', '2026-10-29 00:00:00', 3, 0, 0, 0, 0, 0, 1, '미설치', 0, '', '', '', '정상운영', '', '', '', '전용주차구역 3면만 확인됨, 충전시설 1기 미설치', NULL, NULL),
  ('K0477', '한전KDN 광주전남지역본부', '광주광역시 광산구 소촌로 3', '정은진', '2026-10-29 00:00:00', 7, 0, 0, 7, 2, 5, 0, '한국전력공사(3대)', 4, '지상입구,지상(후문입구)', '한국전력공사', '17년11월', '미운영', '', '', '고장', '미운영 여부 전화 했으나 연락이 안됨.', 'gAAAAABq6pRPWvRrRHhOyYaLXA_ZACE4Mz6_FIakjSH92ylyTkQp4xi4_BLhpIfMbt58pc-MXemlrp5zB0kXMyZrd3C2AHQmYQ==', 'gAAAAABq6pRP5tdm5jXKld8vJHq3hX6ghmHN36LhW37TcRZ-0EesMdw7XIVjDhc0oRIB5qcgCkQQmFJvpKSkq-zguuVLUB49CA=='),
  ('K0341', '하남2 도시공사(다사로움 1차)', '광주 광산구 목련로21번길 45', '정은진', '2026-10-28 00:00:00', 0, 15, 21, 15, 0, 15, 0, '플러그링크(10대), GS차지비(5대)', 0, '', '', '', '정상운영', '', '', '', '21면 미설치->도시공사 협의 후 실사, 주차면적확보하고 11월 공사계획, 12월까지 완료예정', 'gAAAAABq6pRP2Q4U9lKbuVUACgnRvzmTm-XSD2hnSIkpAPNH__iD1YV-RpAooBZBItMRLNBpvlD3t7VSXG0uiCKUQ0NELVNXFA==', 'gAAAAABq6pRP4PLti6fi6W-1fTBi7OYbHkdTPeT_PkDyZoRUMf66DaTf2Dg3Aw1mCbYUAwfKbnCDkY-fzTJ495Jfal1AbaNuXQ=='),
  ('K0361', '하남2지구 중흥', '광주 광산구 목련로21번길 20', '정은진', '2026-10-28 00:00:00', 18, 3, 0, 21, 1, 20, 0, '에버온(18대), 한국전력공사(3대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABq6pRPC5ZQSpBOeu4Ozo2BqsGXZXDKBpYXTw0-LmZPhorO5GR1Tpo1pklM6M_1xtTYum-HMkzSgtXchWoGLQZTvntOwg==', 'gAAAAABq6pRPbwx5s6FyZ3L_CPmseCRt7MPTQTZh_4VxdIHpd5QDkYGv4WP7L11sr918RwDL8rt6cE0J18sIWJAqWzga-d4OFw=='),
  ('K0226', '다사로움2단지', '광주 광산구 목련로 15', '정은진', '2026-10-28 00:00:00', 10, 0, 0, 10, 0, 10, 0, '플러그링크(10대)', 0, '', '', '', '정상운영', '', '', '', '기존 지하4기 철거', 'gAAAAABq6pRPPTFlv-9nLf-LrWKoWLmKgOABsY0EgiXrUhv-Mac0ArqTVQZ34r5n3jPLDL2fy2Z43qWVB9lL5B5v9kHrZtmnDg==', 'gAAAAABq6pRP8Q_aVXw-zZAr0tfHp9OPbN9GBJ12ITQ2nPhlKj1OrSqlhKpIxEgam40-oR2WRwSf3_8q0aVxHwWp__gDeTDPdg=='),
  ('K0222', '운남주공8단지', '광주 광산구 목련로153번길 143', '정은진', '2026-10-27 00:00:00', 28, 10, 0, 38, 0, 38, 0, '에버온(28대), 파워큐브(10대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABq6pRPgW5hp7skutLr-LhHBQlj4ThQhYnHl4mSWd1hFpngxw6c99QPDrZDvfQEXYW6DxTGN-b2hSrkPbeUcK2xO9dtAA==', 'gAAAAABq6pRPrf2Sw6GR3kRQdlrlXgcg9pD46FB2P39aaMvRXZ9DT_LTfAe3GxZJHcnY8eiMpZ6rUFTaLh1yb2ephqCSbXveww=='),
  ('K0216', '부영 애시앙', '광주 광산구 목련로 41', '정은진', '2026-10-27 00:00:00', 24, 0, 0, 24, 0, 24, 0, '현대엔지니어링(24대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABq6pRPfGqkJdbpJwCFfPFN_aQ6GHFkOIJ6W1wWOsaR3IXlEXV0dQER2OMlu5UaZARHtZD91pkiAJeAmBdEBh33GW624g==', 'gAAAAABq6pRPDr6tiJ-R5rwLT1FPvCX7VJwn2u8QbjKduZbbuzHx4TvlUouaPqtEwaRHHUpivbmsaGdWaLjKRBhJBT3tDYEUVg=='),
  ('K0431', '산정빛여울채', '광주 광산구 용아로379번길 25-2', '정은진', '2026-10-27 00:00:00', 0, 3, 5, 3, 0, 3, 0, 'GS차지비(3대)', 0, '', '', '', '정상운영', '', '', '', '미설치 면수5면-> 서류 완료상태로 12월 안에 설치 완료할 예정, 전화로 안내하였습니다.(시정명령기간,등기우편확인)', 'gAAAAABq6pRPnniKD2ANBHixWAmvmV2vhad6piQ5Uel0aTmvW1OGeEYyvWOS9sy_wrX6CEHr-n6Hus12CkNeA-JIy_6wR5ZeRA==', 'gAAAAABq6pRPZRrhZzZZeC-_zSVE5Ym4y8vaZFjiKZrb5TYubROrY1ghK1K4LpoCzkNNOqypB9yt5f25MASE11GThKB2BlNFvA=='),
  ('K0159', '산정중학교', '광주 광산구 목련로22번길 31', '정은진', '2026-10-22 00:00:00', 1, 0, 0, 1, 0, 1, 0, '태성콘텍(1대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABq6pRPNQX8DOD5vZdb_Rldpma799QDUEdIMzpDiMEnVcV64bcGqgp1UIrnacvuZGVPC8etmJisjMrADPx7t80dA8_71Q==', 'gAAAAABq6pRPwQ9W32JFVyix9N5TOQWg0v72O6TqX5YcxaY3h_s8--smOlHxZJoxld63WQzrfaZH3-RxnvgrNWORDO0ZdueICg=='),
  ('K0241', '산정 셀트리움', '광주 광산구 목련로 42', '정은진', '2026-10-22 00:00:00', 15, 0, 0, 15, 0, 15, 0, '현대엔지니어링(15대)', 0, '', '', '', '정상운영', '', '', '', '', 'gAAAAABq6pRPxvXrLyh_3ixUo_pf2T0-sxYWadJM-QuxMswf3L0D6SfistcS-NljssAggRcIE2I2nZrtJmPKOGWnh1AaaiLqYw==', 'gAAAAABq6pRPneFZCIgd4YYPkqjqYBl_8HYJsupXldFUDiu5fH0geyaFDSuqOjiYkr3HUbDqSm28pM35ppv6OZtscJx0e-HlnA==');
