-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 03, 2026 at 12:20 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `booking_system`
--

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `room_id` int(11) NOT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `status` enum('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  `payment_status` enum('unpaid','pending','paid','failed') NOT NULL DEFAULT 'unpaid',
  `notes` varchar(500) DEFAULT NULL,
  `total_price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `user_id`, `room_id`, `start_time`, `end_time`, `status`, `payment_status`, `notes`, `total_price`, `created_at`, `updated_at`) VALUES
(3, 3, 3, '2026-07-04 14:07:00', '2026-07-05 14:07:00', 'confirmed', 'pending', 'booking pertama', 12000000.00, '2026-07-03 14:07:39', '2026-07-03 14:17:32');

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `booking_id` int(11) NOT NULL,
  `order_id` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('pending','settlement','capture','deny','cancel','expire','failure') NOT NULL DEFAULT 'pending',
  `payment_type` varchar(50) DEFAULT NULL,
  `transaction_id` varchar(100) DEFAULT NULL,
  `snap_token` varchar(255) DEFAULT NULL,
  `raw_response` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`raw_response`)),
  `paid_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`id`, `booking_id`, `order_id`, `amount`, `status`, `payment_type`, `transaction_id`, `snap_token`, `raw_response`, `paid_at`, `created_at`, `updated_at`) VALUES
(3, 3, 'BOOKING-3-1783062557781', 12000000.00, 'pending', NULL, NULL, 'a66d308b-3c5b-49fa-a6e3-f0f21412a468', NULL, NULL, '2026-07-03 14:09:18', '2026-07-03 14:09:18');

-- --------------------------------------------------------

--
-- Table structure for table `rooms`
--

CREATE TABLE `rooms` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `capacity` int(11) NOT NULL DEFAULT 1,
  `price_per_day` decimal(12,2) NOT NULL,
  `image_url` varchar(500) DEFAULT NULL,
  `category` varchar(50) DEFAULT 'Lainnya',
  `location` varchar(150) DEFAULT NULL,
  `country` varchar(100) DEFAULT 'Indonesia',
  `rating` decimal(2,1) DEFAULT 0.0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `rooms`
--

INSERT INTO `rooms` (`id`, `name`, `description`, `capacity`, `price_per_day`, `image_url`, `category`, `location`, `country`, `rating`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Meeting Room A', 'Ruang meeting kecil, cocok untuk diskusi tim (4-6 orang)', 6, 50000.00, NULL, 'Lainnya', NULL, 'Indonesia', 0.0, 1, '2026-07-02 15:04:58', '2026-07-02 15:04:58'),
(2, 'Meeting Room B', 'Ruang meeting besar dengan proyektor (10-15 orang)', 15, 120000.00, NULL, 'Lainnya', NULL, 'Indonesia', 0.0, 1, '2026-07-02 15:04:58', '2026-07-02 15:04:58'),
(3, 'Conference Hall', 'Aula konferensi kapasitas besar dengan sound system', 100, 500000.00, '/uploads/rooms/1783062295259-512669507.jpg', 'Lainnya', NULL, 'Indonesia', 0.0, 1, '2026-07-02 15:04:58', '2026-07-03 16:07:14'),
(4, 'Puncak', 'Meja kerja individu di area coworking', 2, 150000.00, NULL, 'Lainnya', 'CISARUA, KABUPATEN BOGOR, JAWA BARAT', 'Indonesia', 0.0, 1, '2026-07-02 15:04:58', '2026-07-03 16:26:39');

-- --------------------------------------------------------

--
-- Table structure for table `room_images`
--

CREATE TABLE `room_images` (
  `id` int(11) NOT NULL,
  `room_id` int(11) NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `room_images`
--

INSERT INTO `room_images` (`id`, `room_id`, `image_url`, `sort_order`, `created_at`) VALUES
(1, 3, '/uploads/rooms/1783062295259-512669507.jpg', 0, '2026-07-03 07:04:55'),
(2, 3, '/uploads/rooms/1783062311575-493776100.jpg', 1, '2026-07-03 07:05:11');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role` enum('customer','admin') NOT NULL DEFAULT 'customer',
  `provider` varchar(20) NOT NULL DEFAULT 'local',
  `google_id` varchar(255) DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT 0,
  `otp_code` varchar(255) DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL,
  `otp_attempts` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `provider`, `google_id`, `email_verified`, `otp_code`, `otp_expires_at`, `otp_attempts`, `created_at`, `updated_at`) VALUES
(2, 'Admin User', 'admin@example.com', '$2a$10$3ih6E98wbrtOU0tonSZoY.KqQpkAYRAoy82zNnyj7qA3MtXPV92Gy', 'admin', 'local', NULL, 1, NULL, NULL, 0, '2026-07-02 19:10:08', '2026-07-03 13:19:44'),
(3, 'Customer Demo', 'customer@example.com', '$2a$10$3ih6E98wbrtOU0tonSZoY.KqQpkAYRAoy82zNnyj7qA3MtXPV92Gy', 'customer', 'local', NULL, 1, NULL, NULL, 0, '2026-07-02 19:10:08', '2026-07-03 13:19:44'),
(10, 'rizki', 'rizkistore1205@gmail.com', '$2a$10$.KQ6M02AdRhX4zOV6CW7Q.YzTkkGdW66u38rj84zfCWOc7Rg88HB2', 'customer', 'local', '111141419627167644890', 1, NULL, NULL, 0, '2026-07-03 15:38:01', '2026-07-03 16:29:36'),
(11, 'rachmadinata', 'rachmadinata91@gmail.com', '$2a$10$Z2QLJXVS883RhX5YqMgiAuw1tpdWqvS8A9VsUj0x5NkdSRhyQW0fa', 'customer', 'local', NULL, 1, NULL, NULL, 0, '2026-07-03 17:11:16', '2026-07-03 17:12:01');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_bookings_room_time` (`room_id`,`start_time`,`end_time`),
  ADD KEY `idx_bookings_user` (`user_id`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `order_id` (`order_id`),
  ADD KEY `idx_payments_booking` (`booking_id`),
  ADD KEY `idx_payments_order_id` (`order_id`);

--
-- Indexes for table `rooms`
--
ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `room_images`
--
ALTER TABLE `room_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_room_images_room_id` (`room_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `idx_users_google_id` (`google_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `rooms`
--
ALTER TABLE `rooms`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `room_images`
--
ALTER TABLE `room_images`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `bookings`
--
ALTER TABLE `bookings`
  ADD CONSTRAINT `fk_bookings_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_bookings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_payments_booking` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `room_images`
--
ALTER TABLE `room_images`
  ADD CONSTRAINT `room_images_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
