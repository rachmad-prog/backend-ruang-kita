-- ============================================================
-- PostgreSQL version of booking_system database
-- Converted from MySQL/MariaDB dump (phpMyAdmin export)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ENUM types (MySQL ENUM -> PostgreSQL native ENUM type)
-- ------------------------------------------------------------
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE payment_status_enum AS ENUM ('unpaid', 'pending', 'paid', 'failed');
CREATE TYPE payment_txn_status AS ENUM ('pending', 'settlement', 'capture', 'deny', 'cancel', 'expire', 'failure');
CREATE TYPE user_role AS ENUM ('customer', 'admin');

-- ------------------------------------------------------------
-- Helper function to auto-update `updated_at` columns
-- (replaces MySQL's "ON UPDATE current_timestamp()")
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Table: rooms
-- ------------------------------------------------------------
CREATE TABLE rooms (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(150) NOT NULL,
  description    TEXT,
  capacity       INTEGER NOT NULL DEFAULT 1,
  price_per_day  NUMERIC(12,2) NOT NULL,
  image_url      VARCHAR(500),
  category       VARCHAR(50) DEFAULT 'Lainnya',
  location       VARCHAR(150),
  country        VARCHAR(100) DEFAULT 'Indonesia',
  rating         NUMERIC(2,1) DEFAULT 0.0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Table: users
-- ------------------------------------------------------------
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  password_hash   VARCHAR(255),
  role            user_role NOT NULL DEFAULT 'customer',
  provider        VARCHAR(20) NOT NULL DEFAULT 'local',
  google_id       VARCHAR(255) UNIQUE,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  otp_code        VARCHAR(255),
  otp_expires_at  TIMESTAMP,
  otp_attempts    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Table: bookings
-- ------------------------------------------------------------
CREATE TABLE bookings (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id        INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  start_time     TIMESTAMP NOT NULL,
  end_time       TIMESTAMP NOT NULL,
  status         booking_status NOT NULL DEFAULT 'pending',
  payment_status payment_status_enum NOT NULL DEFAULT 'unpaid',
  notes          VARCHAR(500),
  total_price    NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bookings_room_time ON bookings (room_id, start_time, end_time);
CREATE INDEX idx_bookings_user ON bookings (user_id);

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Table: payments
-- ------------------------------------------------------------
CREATE TABLE payments (
  id             SERIAL PRIMARY KEY,
  booking_id     INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  order_id       VARCHAR(100) NOT NULL UNIQUE,
  amount         NUMERIC(10,2) NOT NULL,
  status         payment_txn_status NOT NULL DEFAULT 'pending',
  payment_type   VARCHAR(50),
  transaction_id VARCHAR(100),
  snap_token     VARCHAR(255),
  raw_response   JSONB,
  paid_at        TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_booking ON payments (booking_id);
CREATE INDEX idx_payments_order_id ON payments (order_id);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Table: room_images
-- ------------------------------------------------------------
CREATE TABLE room_images (
  id         SERIAL PRIMARY KEY,
  room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  image_url  VARCHAR(500) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_room_images_room_id ON room_images (room_id);

-- ============================================================
-- DATA
-- ============================================================

-- rooms
INSERT INTO rooms (id, name, description, capacity, price_per_day, image_url, category, location, country, rating, is_active, created_at, updated_at) VALUES
(1, 'Meeting Room A', 'Ruang meeting kecil, cocok untuk diskusi tim (4-6 orang)', 6, 50000.00, NULL, 'Lainnya', NULL, 'Indonesia', 0.0, TRUE, '2026-07-02 15:04:58', '2026-07-02 15:04:58'),
(2, 'Meeting Room B', 'Ruang meeting besar dengan proyektor (10-15 orang)', 15, 120000.00, NULL, 'Lainnya', NULL, 'Indonesia', 0.0, TRUE, '2026-07-02 15:04:58', '2026-07-02 15:04:58'),
(3, 'Conference Hall', 'Aula konferensi kapasitas besar dengan sound system', 100, 500000.00, '/uploads/rooms/1783062295259-512669507.jpg', 'Lainnya', NULL, 'Indonesia', 0.0, TRUE, '2026-07-02 15:04:58', '2026-07-03 16:07:14'),
(4, 'Puncak', 'Meja kerja individu di area coworking', 2, 150000.00, NULL, 'Lainnya', 'CISARUA, KABUPATEN BOGOR, JAWA BARAT', 'Indonesia', 0.0, TRUE, '2026-07-02 15:04:58', '2026-07-03 16:26:39');

-- users
INSERT INTO users (id, name, email, password_hash, role, provider, google_id, email_verified, otp_code, otp_expires_at, otp_attempts, created_at, updated_at) VALUES
(2, 'Admin User', 'admin@example.com', '$2a$10$3ih6E98wbrtOU0tonSZoY.KqQpkAYRAoy82zNnyj7qA3MtXPV92Gy', 'admin', 'local', NULL, TRUE, NULL, NULL, 0, '2026-07-02 19:10:08', '2026-07-03 13:19:44'),
(3, 'Customer Demo', 'customer@example.com', '$2a$10$3ih6E98wbrtOU0tonSZoY.KqQpkAYRAoy82zNnyj7qA3MtXPV92Gy', 'customer', 'local', NULL, TRUE, NULL, NULL, 0, '2026-07-02 19:10:08', '2026-07-03 13:19:44'),
(10, 'rizki', 'rizkistore1205@gmail.com', '$2a$10$.KQ6M02AdRhX4zOV6CW7Q.YzTkkGdW66u38rj84zfCWOc7Rg88HB2', 'customer', 'local', '111141419627167644890', TRUE, NULL, NULL, 0, '2026-07-03 15:38:01', '2026-07-03 16:29:36'),
(11, 'rachmadinata', 'rachmadinata91@gmail.com', '$2a$10$Z2QLJXVS883RhX5YqMgiAuw1tpdWqvS8A9VsUj0x5NkdSRhyQW0fa', 'customer', 'local', NULL, TRUE, NULL, NULL, 0, '2026-07-03 17:11:16', '2026-07-03 17:12:01');

-- bookings
INSERT INTO bookings (id, user_id, room_id, start_time, end_time, status, payment_status, notes, total_price, created_at, updated_at) VALUES
(3, 3, 3, '2026-07-04 14:07:00', '2026-07-05 14:07:00', 'confirmed', 'pending', 'booking pertama', 12000000.00, '2026-07-03 14:07:39', '2026-07-03 14:17:32');

-- payments
INSERT INTO payments (id, booking_id, order_id, amount, status, payment_type, transaction_id, snap_token, raw_response, paid_at, created_at, updated_at) VALUES
(3, 3, 'BOOKING-3-1783062557781', 12000000.00, 'pending', NULL, NULL, 'a66d308b-3c5b-49fa-a6e3-f0f21412a468', NULL, NULL, '2026-07-03 14:09:18', '2026-07-03 14:09:18');

-- room_images
INSERT INTO room_images (id, room_id, image_url, sort_order, created_at) VALUES
(1, 3, '/uploads/rooms/1783062295259-512669507.jpg', 0, '2026-07-03 07:04:55'),
(2, 3, '/uploads/rooms/1783062311575-493776100.jpg', 1, '2026-07-03 07:05:11');

-- ============================================================
-- Reset SERIAL sequences to match max existing id (since explicit
-- ids were inserted above, like MySQL's AUTO_INCREMENT values)
-- ============================================================
SELECT setval(pg_get_serial_sequence('rooms', 'id'), (SELECT COALESCE(MAX(id), 1) FROM rooms));
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval(pg_get_serial_sequence('bookings', 'id'), (SELECT COALESCE(MAX(id), 1) FROM bookings));
SELECT setval(pg_get_serial_sequence('payments', 'id'), (SELECT COALESCE(MAX(id), 1) FROM payments));
SELECT setval(pg_get_serial_sequence('room_images', 'id'), (SELECT COALESCE(MAX(id), 1) FROM room_images));

COMMIT;
