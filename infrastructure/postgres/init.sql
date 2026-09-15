-- MeetingMind — khởi tạo database
--
-- Script này chỉ chạy MỘT LẦN, lúc volume postgres còn rỗng.
-- Muốn chạy lại: docker compose down -v
--
-- Mục tiêu: mỗi service có schema và tài khoản riêng, không service nào
-- ghi được vào schema của service khác. Xem ARCHITECTURE.md mục 3.2–3.3.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------- roles
CREATE ROLE mm_core        LOGIN PASSWORD 'mm_core_pass';
CREATE ROLE mm_integration LOGIN PASSWORD 'mm_integration_pass';
CREATE ROLE mm_ai          LOGIN PASSWORD 'mm_ai_pass';

-- -------------------------------------------------------------- schemas
CREATE SCHEMA core        AUTHORIZATION mm_core;
CREATE SCHEMA integration AUTHORIZATION mm_integration;
CREATE SCHEMA ai          AUTHORIZATION mm_ai;

-- Mỗi role mặc định làm việc trong schema của mình
ALTER ROLE mm_core        SET search_path = core, public;
ALTER ROLE mm_integration SET search_path = integration, public;
ALTER ROLE mm_ai          SET search_path = ai, public;

-- Cần cho kiểu `vector` và các extension khác đặt ở public
GRANT USAGE ON SCHEMA public TO mm_core, mm_integration, mm_ai;

-- Không service nào được đụng schema của service khác.
-- Dữ liệu xuyên service đi qua API/event, không qua SQL.
REVOKE ALL ON SCHEMA core        FROM mm_integration, mm_ai;
REVOKE ALL ON SCHEMA integration FROM mm_core, mm_ai;
REVOKE ALL ON SCHEMA ai          FROM mm_core, mm_integration;

-- Không cho tạo bảng mới trong public để tránh lặp lại tình trạng
-- bốn service cùng đổ bảng vào một chỗ.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
