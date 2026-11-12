-- Educate Cloud: the complete database for a NEW, EMPTY database (tables + starting data).
-- Import this one file (phpMyAdmin > Import, or: mysql -u USER -p DBNAME < new_database.sql).
-- Then create the admin:  npm run tutor:create -- --name "Admin" --email you@example.com --role admin
-- It also records every migration as done, so `npm run db:migrate` will not run them again.

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

/*!999999\- enable the sandbox mode */ 
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `app_settings` (
  `setting_key` varchar(60) NOT NULL,
  `setting_value` text NOT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_attachment_chunks` (
  `attachment_id` int(10) unsigned NOT NULL,
  `seq` int(10) unsigned NOT NULL,
  `data` mediumblob NOT NULL,
  PRIMARY KEY (`attachment_id`,`seq`),
  CONSTRAINT `fk_cac_attachment` FOREIGN KEY (`attachment_id`) REFERENCES `chat_attachments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_attachments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned DEFAULT NULL,
  `staff_id` int(10) unsigned DEFAULT NULL,
  `group_id` int(10) unsigned DEFAULT NULL,
  `uploaded_by` int(10) unsigned NOT NULL,
  `message_id` int(10) unsigned DEFAULT NULL,
  `file_name` varchar(150) NOT NULL,
  `size` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_ca_student` (`student_id`),
  KEY `fk_ca_uploader` (`uploaded_by`),
  KEY `fk_ca_staff` (`staff_id`),
  KEY `idx_ca_group` (`group_id`),
  CONSTRAINT `fk_ca_group` FOREIGN KEY (`group_id`) REFERENCES `chat_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ca_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ca_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ca_uploader` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_clears` (
  `student_id` int(10) unsigned NOT NULL,
  `staff_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `cleared_id` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`student_id`,`staff_id`,`user_id`),
  KEY `fk_ccl_staff` (`staff_id`),
  KEY `fk_ccl_user` (`user_id`),
  CONSTRAINT `fk_ccl_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ccl_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ccl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_group_hides` (
  `message_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`message_id`,`user_id`),
  KEY `fk_cgh_user` (`user_id`),
  CONSTRAINT `fk_cgh_message` FOREIGN KEY (`message_id`) REFERENCES `chat_group_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cgh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_group_members` (
  `group_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `added_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`group_id`,`user_id`),
  KEY `idx_cgm_user` (`user_id`),
  CONSTRAINT `fk_cgm_group` FOREIGN KEY (`group_id`) REFERENCES `chat_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cgm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_group_messages` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `group_id` int(10) unsigned NOT NULL,
  `sender_id` int(10) unsigned NOT NULL,
  `body` varchar(2000) DEFAULT NULL,
  `attachment_id` int(10) unsigned DEFAULT NULL,
  `reply_to_id` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cgmsg_group_id` (`group_id`,`id`),
  KEY `fk_cgmsg_sender` (`sender_id`),
  KEY `fk_cgmsg_reply` (`reply_to_id`),
  CONSTRAINT `fk_cgmsg_group` FOREIGN KEY (`group_id`) REFERENCES `chat_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cgmsg_reply` FOREIGN KEY (`reply_to_id`) REFERENCES `chat_group_messages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cgmsg_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_group_reads` (
  `group_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  `read_id` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`group_id`,`user_id`),
  KEY `fk_cgr_user` (`user_id`),
  CONSTRAINT `fk_cgr_group` FOREIGN KEY (`group_id`) REFERENCES `chat_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cgr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `description` varchar(300) DEFAULT NULL,
  `created_by` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_cg_creator` (`created_by`),
  CONSTRAINT `fk_cg_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_message_hides` (
  `message_id` int(10) unsigned NOT NULL,
  `user_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`message_id`,`user_id`),
  KEY `fk_cmh_user` (`user_id`),
  CONSTRAINT `fk_cmh_message` FOREIGN KEY (`message_id`) REFERENCES `chat_messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cmh_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_messages` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned NOT NULL,
  `staff_id` int(10) unsigned NOT NULL,
  `sender_id` int(10) unsigned NOT NULL,
  `body` varchar(2000) DEFAULT NULL,
  `attachment_id` int(10) unsigned DEFAULT NULL,
  `reply_to_id` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_cm_student_id` (`student_id`,`id`),
  KEY `fk_cm_sender` (`sender_id`),
  KEY `idx_cm_pair_id` (`student_id`,`staff_id`,`id`),
  KEY `fk_cm_staff` (`staff_id`),
  KEY `fk_cm_reply` (`reply_to_id`),
  CONSTRAINT `fk_cm_reply` FOREIGN KEY (`reply_to_id`) REFERENCES `chat_messages` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_cm_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cm_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cm_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `chat_threads` (
  `student_id` int(10) unsigned NOT NULL,
  `staff_id` int(10) unsigned NOT NULL,
  `tutor_read_id` int(10) unsigned NOT NULL DEFAULT 0,
  `tutor_delivered_id` int(10) unsigned NOT NULL DEFAULT 0,
  `student_read_id` int(10) unsigned NOT NULL DEFAULT 0,
  `student_delivered_id` int(10) unsigned NOT NULL DEFAULT 0,
  `wiped_id` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`student_id`,`staff_id`),
  KEY `fk_ct_staff` (`staff_id`),
  CONSTRAINT `fk_ct_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ct_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `enrolments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` int(10) unsigned NOT NULL,
  `subject_id` varchar(40) NOT NULL,
  `level_id` varchar(40) NOT NULL,
  `tier` varchar(30) NOT NULL DEFAULT '',
  `board` varchar(40) NOT NULL DEFAULT '',
  `current_grade` varchar(30) NOT NULL DEFAULT '',
  `target_grade` varchar(30) NOT NULL DEFAULT '',
  `tutor_id` int(10) unsigned DEFAULT NULL,
  `group_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enrol` (`student_id`,`subject_id`,`level_id`),
  KEY `idx_enrol_tutor` (`tutor_id`),
  KEY `idx_enrol_group` (`group_id`),
  KEY `fk_en_subject` (`subject_id`),
  KEY `fk_en_level` (`level_id`),
  CONSTRAINT `fk_en_group` FOREIGN KEY (`group_id`) REFERENCES `session_groups` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_en_level` FOREIGN KEY (`level_id`) REFERENCES `levels` (`id`),
  CONSTRAINT `fk_en_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_en_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`),
  CONSTRAINT `fk_en_tutor` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `levels` (
  `id` varchar(40) NOT NULL,
  `name` varchar(80) NOT NULL,
  `short_name` varchar(30) NOT NULL,
  `years` text NOT NULL,
  `tiers` text NOT NULL,
  `boards` text NOT NULL,
  `grades` text NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `monthly_reports` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `enrolment_id` int(10) unsigned NOT NULL,
  `tutor_id` int(10) unsigned NOT NULL,
  `report_month` varchar(30) NOT NULL,
  `body` text NOT NULL,
  `status` enum('draft','ready','sent') NOT NULL DEFAULT 'draft',
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_mr_status` (`status`),
  KEY `fk_mr_enrol` (`enrolment_id`),
  KEY `fk_mr_tutor` (`tutor_id`),
  CONSTRAINT `fk_mr_enrol` FOREIGN KEY (`enrolment_id`) REFERENCES `enrolments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_mr_tutor` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plan_prices` (
  `plan_id` varchar(40) NOT NULL,
  `level_id` varchar(40) NOT NULL,
  `price` varchar(40) NOT NULL,
  PRIMARY KEY (`plan_id`,`level_id`),
  KEY `fk_pp_level` (`level_id`),
  CONSTRAINT `fk_pp_level` FOREIGN KEY (`level_id`) REFERENCES `levels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pp_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `plans` (
  `id` varchar(40) NOT NULL,
  `name` varchar(80) NOT NULL,
  `tagline` varchar(200) NOT NULL DEFAULT '',
  `live_classes` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `mocks` tinyint(1) NOT NULL DEFAULT 0,
  `popular` tinyint(1) NOT NULL DEFAULT 0,
  `features` text NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `schema_migrations` (
  `name` varchar(255) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `session_bookings` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `kind` enum('group','one') NOT NULL DEFAULT 'one',
  `group_id` int(10) unsigned DEFAULT NULL,
  `enrolment_id` int(10) unsigned DEFAULT NULL,
  `tutor_id` int(10) unsigned NOT NULL,
  `session_date` date NOT NULL,
  `start_time` time NOT NULL,
  `minutes` smallint(5) unsigned NOT NULL DEFAULT 60,
  `zoom_link` varchar(300) NOT NULL DEFAULT '',
  `logged` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_booking_group` (`group_id`,`session_date`,`start_time`),
  KEY `idx_booking_tutor` (`tutor_id`,`session_date`),
  KEY `fk_bk_enrol` (`enrolment_id`),
  CONSTRAINT `fk_bk_enrol` FOREIGN KEY (`enrolment_id`) REFERENCES `enrolments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bk_group` FOREIGN KEY (`group_id`) REFERENCES `session_groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_bk_tutor` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `session_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `subject_id` varchar(40) NOT NULL,
  `level_id` varchar(40) NOT NULL,
  `tutor_id` int(10) unsigned DEFAULT NULL,
  `day_of_week` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `start_time` time NOT NULL DEFAULT '17:00:00',
  `zoom_link` varchar(300) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `fk_sg_subject` (`subject_id`),
  KEY `fk_sg_level` (`level_id`),
  KEY `fk_sg_tutor` (`tutor_id`),
  CONSTRAINT `fk_sg_level` FOREIGN KEY (`level_id`) REFERENCES `levels` (`id`),
  CONSTRAINT `fk_sg_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`),
  CONSTRAINT `fk_sg_tutor` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_enquiries` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `parent_name` varchar(100) NOT NULL,
  `student_name` varchar(100) NOT NULL,
  `email` varchar(254) NOT NULL,
  `phone` varchar(40) DEFAULT NULL,
  `year_group` varchar(20) NOT NULL,
  `subject` varchar(40) NOT NULL,
  `message` text DEFAULT NULL,
  `status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_site_enquiries_inbox` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_posts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `excerpt` varchar(400) NOT NULL,
  `tag` varchar(60) NOT NULL,
  `author` varchar(80) NOT NULL,
  `published_on` date NOT NULL,
  `url` varchar(300) NOT NULL,
  `color` enum('sky','rose','cream','lav') NOT NULL DEFAULT 'sky',
  `is_featured` tinyint(1) NOT NULL DEFAULT 0,
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_site_posts_listing` (`is_published`,`published_on`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_product_images` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` int(10) unsigned NOT NULL,
  `url` varchar(300) NOT NULL,
  `alt` varchar(200) NOT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_site_product_images_product` (`product_id`,`sort_order`),
  CONSTRAINT `fk_spi_product` FOREIGN KEY (`product_id`) REFERENCES `site_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_products` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(60) NOT NULL,
  `eyebrow` varchar(160) NOT NULL,
  `title` varchar(160) NOT NULL,
  `price` varchar(20) NOT NULL,
  `lead` varchar(600) NOT NULL,
  `tags_title` varchar(60) NOT NULL,
  `details` longtext NOT NULL,
  `note` varchar(300) NOT NULL DEFAULT '',
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_site_products_slug` (`slug`),
  KEY `idx_site_products_listing` (`is_published`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_reviews` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `kind` enum('video','google') NOT NULL,
  `name` varchar(80) NOT NULL,
  `about` varchar(160) NOT NULL,
  `body` text DEFAULT NULL,
  `video_url` varchar(300) DEFAULT NULL,
  `poster_url` varchar(300) DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_site_reviews_listing` (`kind`,`is_published`,`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `site_team` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(80) NOT NULL,
  `subjects` varchar(120) NOT NULL,
  `icon` varchar(20) NOT NULL DEFAULT 'maths',
  `color` enum('sky','rose','cream','lav') NOT NULL DEFAULT 'sky',
  `bio` longtext NOT NULL,
  `photo_url` varchar(300) DEFAULT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_site_team_order` (`sort_order`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `strands` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `subject_id` varchar(40) NOT NULL,
  `level_id` varchar(40) NOT NULL,
  `name` varchar(100) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_strands_path` (`subject_id`,`level_id`,`position`),
  KEY `fk_strand_level` (`level_id`),
  CONSTRAINT `fk_strand_level` FOREIGN KEY (`level_id`) REFERENCES `levels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_strand_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `student_profiles` (
  `user_id` int(10) unsigned NOT NULL,
  `level_id` varchar(40) NOT NULL,
  `school_year` varchar(30) NOT NULL DEFAULT '',
  `plan_id` varchar(40) NOT NULL,
  `parent_name` varchar(100) NOT NULL DEFAULT '',
  `parent_email` varchar(254) NOT NULL DEFAULT '',
  `parent_phone` varchar(30) NOT NULL DEFAULT '',
  PRIMARY KEY (`user_id`),
  KEY `fk_sp_level` (`level_id`),
  KEY `fk_sp_plan` (`plan_id`),
  CONSTRAINT `fk_sp_level` FOREIGN KEY (`level_id`) REFERENCES `levels` (`id`),
  CONSTRAINT `fk_sp_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`),
  CONSTRAINT `fk_sp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subject_levels` (
  `subject_id` varchar(40) NOT NULL,
  `level_id` varchar(40) NOT NULL,
  PRIMARY KEY (`subject_id`,`level_id`),
  KEY `fk_sl_level` (`level_id`),
  CONSTRAINT `fk_sl_level` FOREIGN KEY (`level_id`) REFERENCES `levels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sl_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `subjects` (
  `id` varchar(40) NOT NULL,
  `name` varchar(80) NOT NULL,
  `icon` varchar(30) NOT NULL DEFAULT 'book',
  `color` varchar(9) NOT NULL DEFAULT '#2B6CB0',
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `topics` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `strand_id` int(10) unsigned NOT NULL,
  `name` varchar(120) NOT NULL,
  `position` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_topics_strand` (`strand_id`,`position`),
  CONSTRAINT `fk_topic_strand` FOREIGN KEY (`strand_id`) REFERENCES `strands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=83 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `tutor_subjects` (
  `user_id` int(10) unsigned NOT NULL,
  `subject_id` varchar(40) NOT NULL,
  PRIMARY KEY (`user_id`,`subject_id`),
  KEY `fk_ts_subject` (`subject_id`),
  CONSTRAINT `fk_ts_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_image_chunks` (
  `user_id` int(10) unsigned NOT NULL,
  `kind` enum('avatar','cover') NOT NULL,
  `seq` int(10) unsigned NOT NULL,
  `data` mediumblob NOT NULL,
  PRIMARY KEY (`user_id`,`kind`,`seq`),
  CONSTRAINT `fk_uic_image` FOREIGN KEY (`user_id`, `kind`) REFERENCES `user_images` (`user_id`, `kind`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_images` (
  `user_id` int(10) unsigned NOT NULL,
  `kind` enum('avatar','cover') NOT NULL,
  `mime` varchar(50) NOT NULL,
  `size` int(10) unsigned NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`,`kind`),
  CONSTRAINT `fk_ui_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `user_code` varchar(20) DEFAULT NULL,
  `username` varchar(30) DEFAULT NULL,
  `email` varchar(254) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `full_name` varchar(100) NOT NULL,
  `headline` varchar(100) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `bio` varchar(1000) DEFAULT NULL,
  `password_hash` varchar(100) DEFAULT NULL,
  `role` enum('student','tutor','admin') NOT NULL DEFAULT 'student',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `password_changed_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `chat_color` varchar(7) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_user_code` (`user_code`),
  KEY `idx_users_role_created` (`role`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

-- Starting data: levels, subjects, topics, plans and the website content
/*!999999\- enable the sandbox mode */ 
INSERT INTO `levels` (`id`, `name`, `short_name`, `years`, `tiers`, `boards`, `grades`, `position`) VALUES ('alevel','A-level','A-level','[\"Year 12\",\"Year 13\"]','[]','[\"AQA\",\"Edexcel\",\"OCR\"]','[\"E\",\"D\",\"C\",\"B\",\"A\",\"A*\"]',2),('gcse','GCSE','GCSE','[\"Year 10\",\"Year 11\"]','[\"Foundation\",\"Higher\"]','[\"AQA\",\"Edexcel\",\"OCR\"]','[\"1\",\"2\",\"3\",\"4\",\"5\",\"6\",\"7\",\"8\",\"9\"]',1),('ks3','Key Stage 3','KS3','[\"Year 7\",\"Year 8\",\"Year 9\"]','[]','[]','[\"Emerging\",\"Developing\",\"Secure\",\"Mastered\"]',0);
INSERT INTO `subjects` (`id`, `name`, `icon`, `color`, `position`) VALUES ('biology','Biology','biology','#B4475A',3),('chemistry','Chemistry','chemistry','#2E8B66',2),('english','English','english','#B5741C',4),('maths','Maths','maths','#2B6CB0',0),('physics','Physics','physics','#6B4FC9',1);
INSERT INTO `subject_levels` (`subject_id`, `level_id`) VALUES ('biology','alevel'),('biology','gcse'),('chemistry','alevel'),('chemistry','gcse'),('english','gcse'),('english','ks3'),('maths','alevel'),('maths','gcse'),('maths','ks3'),('physics','alevel'),('physics','gcse');
INSERT INTO `strands` (`id`, `subject_id`, `level_id`, `name`, `position`) VALUES (1,'maths','gcse','Number',0),(2,'maths','gcse','Algebra',1),(3,'maths','gcse','Ratio and proportion',2),(4,'maths','gcse','Geometry and measures',3),(5,'maths','gcse','Probability',4),(6,'maths','gcse','Statistics',5),(7,'physics','gcse','Energy',0),(8,'physics','gcse','Electricity',1),(9,'physics','gcse','Particle model',2),(10,'physics','gcse','Atomic structure',3),(11,'physics','gcse','Forces',4),(12,'physics','gcse','Waves',5),(13,'physics','gcse','Magnetism',6),(14,'chemistry','gcse','Atomic structure',0),(15,'chemistry','gcse','Bonding',1),(16,'chemistry','gcse','Quantitative chemistry',2),(17,'chemistry','gcse','Chemical changes',3),(18,'chemistry','gcse','Rates',4),(19,'biology','gcse','Cells',0),(20,'biology','gcse','Organisation',1),(21,'biology','gcse','Infection',2),(22,'biology','gcse','Bioenergetics',3),(23,'biology','gcse','Ecology',4),(24,'english','gcse','Reading',0),(25,'english','gcse','Writing',1),(26,'english','gcse','Literature',2),(27,'maths','ks3','Number',0),(28,'maths','ks3','Algebra',1),(29,'maths','ks3','Geometry',2),(30,'maths','alevel','Pure',0),(31,'maths','alevel','Statistics',1),(32,'maths','alevel','Mechanics',2),(33,'english','ks3','Reading',0),(34,'english','ks3','Writing',1),(35,'physics','alevel','Mechanics',0),(36,'physics','alevel','Electricity',1),(37,'chemistry','alevel','Physical',0),(38,'biology','alevel','Cells',0);
INSERT INTO `topics` (`id`, `strand_id`, `name`, `position`) VALUES (1,1,'Fractions',0),(2,1,'Percentages',1),(3,1,'Negative numbers',2),(4,1,'Indices and surds',3),(5,1,'Standard form',4),(6,2,'Expanding brackets',0),(7,2,'Factorising quadratics',1),(8,2,'Simultaneous equations',2),(9,2,'Rearranging formulae',3),(10,2,'Sequences',4),(11,3,'Ratio',0),(12,3,'Direct and inverse proportion',1),(13,3,'Compound interest',2),(14,4,'Area and volume',0),(15,4,'Pythagoras',1),(16,4,'Trigonometry',2),(17,4,'Circle theorems',3),(18,5,'Basic probability',0),(19,5,'Tree diagrams',1),(20,5,'Venn diagrams',2),(21,6,'Averages and range',0),(22,6,'Histograms',1),(23,6,'Box plots',2),(24,6,'Cumulative frequency',3),(25,7,'Energy stores',0),(26,7,'Work and power',1),(27,7,'Efficiency',2),(28,8,'Circuits',0),(29,8,'Resistance',1),(30,8,'Mains electricity',2),(31,9,'Density',0),(32,9,'Changes of state',1),(33,10,'Atoms and isotopes',0),(34,10,'Radioactive decay',1),(35,11,'Forces and motion',0),(36,11,'Newton\'s laws',1),(37,11,'Momentum',2),(38,12,'Wave properties',0),(39,12,'Electromagnetic spectrum',1),(40,13,'Magnets and fields',0),(41,13,'Motor effect',1),(42,14,'Atoms and the periodic table',0),(43,15,'Ionic and covalent bonding',0),(44,16,'Moles',0),(45,17,'Acids and alkalis',0),(46,17,'Reactivity',1),(47,18,'Rates of reaction',0),(48,19,'Cell structure',0),(49,19,'Cell division',1),(50,20,'Digestion',0),(51,20,'The heart',1),(52,21,'Pathogens',0),(53,22,'Photosynthesis',0),(54,22,'Respiration',1),(55,23,'Ecosystems',0),(56,24,'Language analysis',0),(57,24,'Structure',1),(58,25,'Descriptive writing',0),(59,25,'Persuasive writing',1),(60,26,'Poetry',0),(61,26,'Shakespeare',1),(62,27,'Place value',0),(63,27,'Fractions',1),(64,27,'Negative numbers',2),(65,28,'Expressions',0),(66,28,'Solving equations',1),(67,29,'Angles',0),(68,29,'Area and perimeter',1),(69,30,'Proof',0),(70,30,'Algebra and functions',1),(71,30,'Differentiation',2),(72,30,'Integration',3),(73,31,'Data presentation',0),(74,31,'Probability distributions',1),(75,32,'Kinematics',0),(76,32,'Forces and Newton\'s laws',1),(77,33,'Inference',0),(78,34,'Paragraphing',0),(79,35,'Motion',0),(80,36,'Circuits',0),(81,37,'Energetics',0),(82,38,'Cell structure',0);
INSERT INTO `plans` (`id`, `name`, `tagline`, `live_classes`, `mocks`, `popular`, `features`, `position`) VALUES ('intensive','Exam intensive','For mocks and exam season',2,1,0,'[\"Everything in Weekly class\",\"2 live classes a week\",\"Mock exams with marked feedback\"]',2),('self','Self-paced','Learn at your own pace',0,0,0,'[\"Diagnostic and personal learning map\",\"Lessons, notes and quizzes\",\"Progress you can see\"]',0),('weekly','Weekly class','Our most popular plan',1,0,1,'[\"Everything in Self-paced\",\"1 live small-group class a week (max 10)\",\"Monthly progress report for parents\"]',1);
INSERT INTO `plan_prices` (`plan_id`, `level_id`, `price`) VALUES ('intensive','alevel','£—/month'),('intensive','gcse','£—/month'),('intensive','ks3','£—/month'),('self','alevel','£—/month'),('self','gcse','£—/month'),('self','ks3','£—/month'),('weekly','alevel','£—/month'),('weekly','gcse','£—/month'),('weekly','ks3','£—/month');
INSERT INTO `app_settings` (`setting_key`, `setting_value`) VALUES ('welcome','Find your gaps. Follow your plan. Learn with a real teacher.');
INSERT INTO `site_posts` (`id`, `title`, `excerpt`, `tag`, `author`, `published_on`, `url`, `color`, `is_featured`, `is_published`, `created_at`) VALUES (1,'GCSE motivation for the student who feels tired of revising','At the start of GCSE season, motivation feels easy. Here is what to do when it runs out.','Study skills','Fatima','2026-05-22','https://educatecloud.co.uk/gcse-motivation-for-the-student-who-feels-tired-of-revising/','sky',0,1,'2026-11-11 16:37:22'),(2,'Exam stress and the support teenagers actually remember','“I’m fine” often means “I’m overwhelmed”. How parents can help in the weeks before exams.','For parents','Fatima','2026-05-22','https://educatecloud.co.uk/exam-stress-the-kind-of-support-teenagers-actually-remember/','rose',0,1,'2026-11-11 16:37:22'),(3,'What is education actually meant to do?','Two classrooms, two realities: what I noticed between the UK and Pakistan’s education systems.','From the founder','Zainab Abid','2026-04-27','https://educatecloud.co.uk/elementor-1065/','cream',1,1,'2026-11-11 16:37:22'),(4,'A 4-week GCSE revision plan before your exams','Exams coming up and not sure where to start? A week-by-week plan you can follow.','Revision','Fatima','2026-03-23','https://educatecloud.co.uk/a-4-week-gcse-revision-plan-before-your-exams/','lav',0,1,'2026-11-11 16:37:22'),(5,'Is it too late to improve your GCSE grades?','If your exams are close and you feel you should have started earlier, take a breath. Here is what still works.','Revision','Fatima','2026-03-23','https://educatecloud.co.uk/elementor-945/','sky',0,1,'2026-11-11 16:37:22'),(6,'How to create the perfect online learning space for your child','Success in online learning is about more than handing a child a laptop.','For parents','Zainab Abid','2026-01-08','https://educatecloud.co.uk/elementor-588/','cream',0,1,'2026-11-11 16:37:22'),(7,'Back to school: essentials prep for GCSE students','The start of a new school year is exciting. A checklist to start it well.','Study skills','Fatima','2026-01-06','https://educatecloud.co.uk/elementor-page-454/','lav',0,1,'2026-11-11 16:37:22'),(8,'Understanding studying difficulties and how to overcome them','What makes studying hard for some students, and practical ways to help.','For parents','Zainab Abid','2026-01-06','https://educatecloud.co.uk/elementor-page-425/','rose',0,1,'2026-11-11 16:37:22'),(9,'7 tips to study smarter','Running out of time before exams? Seven proven revision techniques.','Study skills','Zainab Abid','2025-09-22','https://educatecloud.co.uk/creative-class-library-for-science-students/','sky',0,1,'2026-11-11 16:37:22');
INSERT INTO `site_products` (`id`, `slug`, `eyebrow`, `title`, `price`, `lead`, `tags_title`, `details`, `note`, `sort_order`, `is_published`) VALUES (1,'physics','Digital resource pack · AQA GCSE Physics','GCSE Physics Complete Bundle','£20','Notes, PowerPoints and exam questions for all 8 AQA GCSE Physics topics. Over 200 pages of colourful notes with images, ready to use straight away.','All 8 topics','{\"tags\":[\"Energy\",\"Electricity\",\"Particle model of matter\",\"Atomic structure\",\"Forces\",\"Waves\",\"Magnetism and electromagnetism\",\"Space physics\"],\"included\":[\"Concise, clear GCSE Physics notes\",\"Topic-by-topic revision mats\",\"Topic-by-topic PowerPoints\",\"Exam-style practice questions with full mark schemes\",\"Progress checklists for every topic\",\"Written for the AQA specification\"],\"perfect\":[\"Mock exam preparation\",\"Last-minute revision\",\"Independent study\",\"Boosting weak topics\",\"Structured exam practice\"],\"why\":[\"No fluff, straight to the exam content\",\"Easy-to-understand explanations\",\"Exam tips and Higher-tier boxes\",\"Designed by an experienced GCSE tutor\"]}','Written for AQA Separate (Triple) Physics, for students aiming for grades 7 to 9.',1,1),(2,'maths','Digital resource bundle · Edexcel GCSE Maths','Top GCSE Maths Questions','£10','Exam-style questions modelled on the hardest questions in Edexcel GCSE Maths Papers 1, 2 and 3, each with a full model solution. Three digital booklets in one bundle.','3 booklets','{\"tags\":[\"Paper 1 (non-calculator)\",\"Paper 2 (calculator)\",\"Paper 3 (calculator)\"],\"included\":[\"The hardest types of question on each Edexcel paper\",\"Similar in style to real exam questions\",\"A full model solution for every question\",\"Paper 1, Paper 2 and Paper 3 booklets\",\"Instant digital access\"],\"perfect\":[\"Students aiming for grades 7 to 9\",\"Mock exam preparation\",\"Final weeks before the exam\",\"Practising the questions that catch people out\"],\"why\":[\"Focuses on the questions that lose the most marks\",\"Model solutions show every step\",\"Organised by paper, so it matches the real exams\",\"Made by an experienced GCSE Maths tutor\"]}','For Edexcel GCSE Maths.',2,1);
INSERT INTO `site_product_images` (`id`, `product_id`, `url`, `alt`, `sort_order`) VALUES (1,1,'/site/shop/physics-2.jpg','GCSE Physics Complete Bundle, picture 1',1),(2,1,'/site/shop/physics-3.jpg','GCSE Physics Complete Bundle, picture 2',2),(3,1,'/site/shop/physics-1.jpg','GCSE Physics Complete Bundle, picture 3',3),(4,2,'/site/shop/maths-1.jpg','Top GCSE Maths Questions, picture 1',1),(5,2,'/site/shop/maths-2.jpg','Top GCSE Maths Questions, picture 2',2),(6,2,'/site/shop/maths-3.jpg','Top GCSE Maths Questions, picture 3',3),(7,2,'/site/shop/maths-4.jpg','Top GCSE Maths Questions, picture 4',4),(8,2,'/site/shop/maths-5.jpg','Top GCSE Maths Questions, picture 5',5);
INSERT INTO `site_team` (`id`, `name`, `subjects`, `icon`, `color`, `bio`, `photo_url`, `sort_order`) VALUES (1,'Muhammad','Physics','physics','sky','[\"Muhammad is our dedicated Physics tutor, with a fascinating academic journey. Originally a pre-med student, he later discovered his passion for aviation and is now in pilot training, all while tutoring Physics, a subject he has always excelled in.\",\"His strong academic background and proven track record with students make him a reliable and relatable tutor. Learners appreciate his clarity, motivation and the real-world perspective he brings to physics.\",\"When he isn’t teaching, you’ll find him flying. Literally.\"]','/site/team/muhammad.jpg',1),(2,'Ayesha','Biology and Chemistry','biology','rose','[\"Ayesha is a friendly and dedicated Biology and Chemistry tutor who is currently studying for her MBBS, working towards her goal of becoming a doctor and contributing to medical research.\",\"She has a real passion for science, especially Biology and Chemistry, and loves helping students make sense of topics that can feel overwhelming at first.\",\"Outside tutoring and medical school, Ayesha is interested in research and the future of healthcare, and brings that curiosity into her lessons to make learning more meaningful. She offers flexible, student-friendly support and is committed to helping every learner reach their full potential.\"]','/site/team/ayesha.jpg',2);
INSERT INTO `site_reviews` (`id`, `kind`, `name`, `about`, `body`, `video_url`, `poster_url`, `sort_order`, `is_published`) VALUES (1,'video','Pavan Chundri','IGCSE Maths with Zainab · our first student from Qatar',NULL,'/site/reviews/pavan.mp4','/site/reviews/pavan.jpg',1,1),(2,'video','Jacob Pearce','Maths with Zainab, Physics with Muhammad',NULL,'/site/reviews/jacob.mp4','/site/reviews/jacob.jpg',2,1),(3,'video','Mehmona','Science with Muhammad',NULL,'/site/reviews/mehmona.mp4','/site/reviews/mehmona.jpg',3,1),(4,'google','Maria Mughal','Parent of a KS3 student · Science with Muhammad','We’ve had a great experience with Educate Cloud. My son has been having science tuition for the past couple of months and is still continuing his lessons. He genuinely enjoys them, which has made a big difference to his confidence and interest in the subject. We’ve already noticed an improvement in his performance at school.\n\nHis tutor, Muhammad, is very professional, patient, and friendly. He creates a supportive and engaging learning environment that really helps my son stay motivated.\n\nI would highly recommend Educate Cloud to anyone looking for quality tuition and dedicated tutors.',NULL,NULL,4,1),(5,'google','Eshal','GCSE and A-level Maths with Zainab','Zainab is such an amazing tutor! She is patient, supportive, and always explains things in a way that’s easy to understand. She creates a comfortable learning environment where I never feel afraid to ask questions, and she truly cares about her students and their progress. I’m so grateful for her help and would highly recommend her to anyone looking for a great tutor in GCSE and A Level Maths!',NULL,NULL,5,1),(6,'google','Aaron','Lessons with Zainab','Zainab is an amazing tutor who really cares. She quickly set up a personalised lesson plan and made learning fun and engaging. I’ve already learned more with her than I did at school. Highly recommend Educate Cloud if you want real progress!',NULL,NULL,6,1);

-- 039: teacher dashboard
-- Teacher dashboard: session logs, each student's learning map, and the work students do (read by the tutor).

-- What the diagnostic found out about a student in one subject.
ALTER TABLE enrolments
  ADD COLUMN diagnostic_done  TINYINT(1)   NOT NULL DEFAULT 0 AFTER target_grade,
  ADD COLUMN diagnostic_score TINYINT UNSIGNED NULL AFTER diagnostic_done,
  ADD COLUMN misconceptions   JSON         NULL AFTER diagnostic_score;

-- One log per booked session: what was covered and the homework set.
CREATE TABLE lesson_logs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id INT UNSIGNED NOT NULL,
  tutor_id   INT UNSIGNED NOT NULL,
  topic_id   INT UNSIGNED NULL,
  topic_name VARCHAR(160) NOT NULL DEFAULT '',
  note       TEXT         NOT NULL,
  homework   VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_log_booking (booking_id),
  CONSTRAINT fk_ll_booking FOREIGN KEY (booking_id) REFERENCES session_bookings (id) ON DELETE CASCADE,
  CONSTRAINT fk_ll_tutor   FOREIGN KEY (tutor_id)   REFERENCES users (id)            ON DELETE CASCADE,
  CONSTRAINT fk_ll_topic   FOREIGN KEY (topic_id)   REFERENCES topics (id)           ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Who was in the session.
CREATE TABLE lesson_log_attendance (
  log_id       INT UNSIGNED NOT NULL,
  enrolment_id INT UNSIGNED NOT NULL,
  present      TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (log_id, enrolment_id),
  CONSTRAINT fk_lla_log   FOREIGN KEY (log_id)       REFERENCES lesson_logs (id) ON DELETE CASCADE,
  CONSTRAINT fk_lla_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The learning map: N not started, P in progress, W needs work, M mastered. No row means not started.
CREATE TABLE enrolment_topic_status (
  enrolment_id INT UNSIGNED NOT NULL,
  topic_id     INT UNSIGNED NOT NULL,
  status       ENUM('N','P','W','M') NOT NULL DEFAULT 'N',
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (enrolment_id, topic_id),
  CONSTRAINT fk_ets_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id) ON DELETE CASCADE,
  CONSTRAINT fk_ets_topic FOREIGN KEY (topic_id)     REFERENCES topics (id)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Minutes a student studied on a day.
CREATE TABLE study_minutes (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrolment_id INT UNSIGNED NOT NULL,
  study_date   DATE         NOT NULL,
  minutes      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_sm_enrol (enrolment_id, study_date),
  CONSTRAINT fk_sm_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Quiz and practice scores.
CREATE TABLE learning_results (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrolment_id INT UNSIGNED NOT NULL,
  title        VARCHAR(160) NOT NULL,
  pct          TINYINT UNSIGNED NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lr_enrol (enrolment_id, created_at),
  CONSTRAINT fk_lr_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 040: teacher content
-- Teacher "Content" tab: the library of lessons, notes, quizzes and videos, and the learning routes built from them.

-- One item in the library, for one subject at one level (and one topic on its learning map).
CREATE TABLE content_items (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind       ENUM('lesson','notes','quiz','video') NOT NULL DEFAULT 'lesson',
  title      VARCHAR(160) NOT NULL,
  subject_id VARCHAR(40)  NOT NULL,
  level_id   VARCHAR(40)  NOT NULL,
  topic_id   INT UNSIGNED NULL,
  source     VARCHAR(255) NOT NULL DEFAULT '',
  published  TINYINT(1)   NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ci_path (subject_id, level_id),
  CONSTRAINT fk_ci_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_ci_level   FOREIGN KEY (level_id)   REFERENCES levels (id)   ON DELETE CASCADE,
  CONSTRAINT fk_ci_topic   FOREIGN KEY (topic_id)   REFERENCES topics (id)   ON DELETE SET NULL,
  CONSTRAINT fk_ci_user    FOREIGN KEY (created_by) REFERENCES users (id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The parts of an item, in order: a slide, a video, a multiple-choice question or a written question.
-- `data` holds the fields of that type (slide: title, body; mcq: question, options, correct, explain; ...).
CREATE TABLE content_blocks (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id  INT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  type     ENUM('slide','video','mcq','written') NOT NULL,
  data     JSON NOT NULL,
  PRIMARY KEY (id),
  KEY idx_cb_item (item_id, position),
  CONSTRAINT fk_cb_item FOREIGN KEY (item_id) REFERENCES content_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- A learning route: the order students work through items, with a week for each step.
CREATE TABLE learning_routes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(160) NOT NULL,
  subject_id  VARCHAR(40)  NOT NULL,
  level_id    VARCHAR(40)  NOT NULL,
  created_by  INT UNSIGNED NULL,
  assigned_at TIMESTAMP    NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_lrt_path (subject_id, level_id),
  CONSTRAINT fk_lrt_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_lrt_level   FOREIGN KEY (level_id)   REFERENCES levels (id)   ON DELETE CASCADE,
  CONSTRAINT fk_lrt_user    FOREIGN KEY (created_by) REFERENCES users (id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE route_steps (
  id       INT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_id INT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  item_id  INT UNSIGNED NOT NULL,
  week     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_rs_route (route_id, position),
  CONSTRAINT fk_rs_route FOREIGN KEY (route_id) REFERENCES learning_routes (id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_item  FOREIGN KEY (item_id)  REFERENCES content_items (id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Who sees a route: a whole group, or one student's subject.
CREATE TABLE route_audience (
  route_id     INT UNSIGNED NOT NULL,
  group_id     INT UNSIGNED NULL,
  enrolment_id INT UNSIGNED NULL,
  UNIQUE KEY uq_ra_group (route_id, group_id),
  UNIQUE KEY uq_ra_enrol (route_id, enrolment_id),
  CONSTRAINT fk_ra_route FOREIGN KEY (route_id)     REFERENCES learning_routes (id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_group FOREIGN KEY (group_id)     REFERENCES session_groups (id)  ON DELETE CASCADE,
  CONSTRAINT fk_ra_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 041: student dashboard
-- Student dashboard: which lessons, notes and quizzes a student has finished (for each of their subjects).
CREATE TABLE item_completions (
  enrolment_id INT UNSIGNED NOT NULL,
  item_id      INT UNSIGNED NOT NULL,
  score        TINYINT UNSIGNED NULL,
  completed_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (enrolment_id, item_id),
  CONSTRAINT fk_ic_enrol FOREIGN KEY (enrolment_id) REFERENCES enrolments (id)    ON DELETE CASCADE,
  CONSTRAINT fk_ic_item  FOREIGN KEY (item_id)      REFERENCES content_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 042: diagnostic questions and sign-up
-- Student dashboard, part 2: the diagnostic questions and sign-up consent.

-- Multiple-choice diagnostic questions for one subject at one level. A subject with none uses the "how confident are you" version.
CREATE TABLE diagnostic_questions (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id VARCHAR(40)  NOT NULL,
  level_id   VARCHAR(40)  NOT NULL,
  topic_id   INT UNSIGNED NOT NULL,
  position   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  question   TEXT         NOT NULL,
  options    JSON         NOT NULL,
  correct    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  mistakes   JSON         NULL,
  PRIMARY KEY (id),
  KEY idx_dq_path (subject_id, level_id, position),
  CONSTRAINT fk_dq_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE CASCADE,
  CONSTRAINT fk_dq_level   FOREIGN KEY (level_id)   REFERENCES levels (id)   ON DELETE CASCADE,
  CONSTRAINT fk_dq_topic   FOREIGN KEY (topic_id)   REFERENCES topics (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Whether the parent agreed to lesson recordings when signing up.
ALTER TABLE student_profiles ADD COLUMN recording_ok TINYINT(1) NOT NULL DEFAULT 0;

-- The starting questions (each goes to the topic of that name; nothing is added if the topic does not exist).

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 0, 'Work out $\\frac{3}{4} + \\frac{1}{6}$', '["$\\\\frac{11}{12}$", "$\\\\frac{4}{10}$", "$\\\\frac{4}{24}$", "$\\\\frac{1}{2}$"]', 0, '[null, "Adding the tops and the bottoms"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Fractions' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 1, 'Increase $80$ by $15\\%$', '["$95$", "$92$", "$12$", "$68$"]', 1, '["Adding the percentage as a number"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Percentages' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 2, 'Work out $2x^2$ when $x = -3$', '["$-18$", "$36$", "$18$", "$-36$"]', 2, '["Squaring negative numbers"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Negative numbers' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 3, 'Which is equal to $(x + 3)^2$?', '["$x^2 + 9$", "$x^2 + 6x + 9$", "$x^2 + 3x + 9$", "$2x + 6$"]', 1, '["Thinking $(a + b)^2 = a^2 + b^2$"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Expanding brackets' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 4, 'Factorise $x^2 + 5x + 6$', '["$(x + 5)(x + 1)$", "$(x + 6)(x - 1)$", "$(x + 2)(x + 3)$", "$x(x + 11)$"]', 2, '["Matching the sum but not the product"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Factorising quadratics' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 5, 'Solve $x + y = 10$ and $x - y = 4$', '["$x = 7,\\\\ y = 3$", "$x = 3,\\\\ y = 7$", "$x = 14,\\\\ y = -4$", "$x = 5,\\\\ y = 5$"]', 0, '[null, "Mixing up which letter is which"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Simultaneous equations' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 6, 'Make $x$ the subject of $y = 3x + 2$', '["$x = \\\\frac{y}{3} - 2$", "$x = \\\\frac{y - 2}{3}$", "$x = 3y - 2$", "$x = \\\\frac{y + 2}{3}$"]', 1, '["Undoing steps in the wrong order"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Rearranging formulae' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 7, 'A right-angled triangle has shorter sides $6$ cm and $8$ cm. How long is the longest side?', '["$14$ cm", "$10$ cm", "$48$ cm", "$100$ cm"]', 1, '["Adding the sides instead of the squares"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Pythagoras' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 8, 'Which ratio uses the opposite side and the hypotenuse?', '["$\\\\tan\\\\theta$", "$\\\\cos\\\\theta$", "$\\\\sin\\\\theta$", "None of these"]', 2, '["Choosing the wrong trig ratio", "Choosing the wrong trig ratio"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Trigonometry' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'maths', 'gcse', t.id, 9, 'The probability it rains is $0.3$. What is the probability it does not rain?', '["$0.3$", "$0.7$", "$1.3$", "$-0.3$"]', 1, '[]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'maths' AND s.level_id = 'gcse' AND t.name = 'Basic probability' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 0, 'Which is the unit of energy?', '["Watt", "Joule", "Newton", "Volt"]', 1, '["Confusing energy and power"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Energy stores' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 1, 'A kettle transfers $2000$ J in $10$ s. What is its power?', '["$200$ W", "$20\\\\,000$ W", "$2010$ W", "$0.005$ W"]', 0, '[null, "Multiplying instead of dividing"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Work and power' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 2, 'Using $V = IR$: what is $V$ when $I = 2$ A and $R = 6\\ \\Omega$?', '["$3$ V", "$8$ V", "$12$ V", "$4$ V"]', 2, '["Dividing instead of multiplying"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Resistance' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 3, 'Density is mass divided by…', '["volume", "weight", "area", "temperature"]', 0, '[]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Density' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 4, 'An object moves at a steady speed in a straight line. The resultant force is…', '["forwards", "zero", "backwards", "equal to its weight"]', 1, '["Thinking motion needs a resultant force"]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Newton''s laws' LIMIT 1;

INSERT INTO diagnostic_questions (subject_id, level_id, topic_id, position, question, options, correct, mistakes)
  SELECT 'physics', 'gcse', t.id, 5, 'Which wave has the shortest wavelength?', '["Radio", "Visible light", "Microwave", "Gamma"]', 3, '[]'
    FROM topics t JOIN strands s ON s.id = t.strand_id WHERE s.subject_id = 'physics' AND s.level_id = 'gcse' AND t.name = 'Electromagnetic spectrum' LIMIT 1;

INSERT INTO schema_migrations (name) VALUES
  ('001_create_users.sql'),
  ('002_create_subjects_and_topics.sql'),
  ('003_create_items.sql'),
  ('004_add_user_roles.sql'),
  ('005_rename_teacher_to_tutor.sql'),
  ('006_add_full_name_to_users.sql'),
  ('007_create_startup_options.sql'),
  ('008_create_startup_content.sql'),
  ('009_create_diagnostic_questions.sql'),
  ('010_create_student_workflow.sql'),
  ('011_add_results_screen.sql'),
  ('012_create_diagnostic_batches.sql'),
  ('013_create_monthly_reports.sql'),
  ('014_create_chat.sql'),
  ('015_chat_attachment_chunks.sql'),
  ('016_chat_delivered.sql'),
  ('017_chat_delete.sql'),
  ('018_chat_per_tutor.sql'),
  ('019_chat_message_hides.sql'),
  ('020_chat_reply.sql'),
  ('021_create_profiles.sql'),
  ('022_student_ids_and_status.sql'),
  ('023_student_profile_fields.sql'),
  ('024_user_ids_for_everyone.sql'),
  ('025_create_chat_groups.sql'),
  ('026_chat_color.sql'),
  ('027_create_lesson_logs.sql'),
  ('028_create_quizzes.sql'),
  ('029_create_quiz_diagrams.sql'),
  ('030_create_student_topic_status.sql'),
  ('031_create_groups.sql'),
  ('032_create_session_bookings.sql'),
  ('033_create_learning_map.sql'),
  ('034_create_lessons.sql'),
  ('035_create_learning_routes.sql'),
  ('036_create_practice_sets.sql'),
  ('037_create_site_content.sql'),
  ('038_new_design.sql'),
  ('039_teacher_dashboard.sql'),
  ('040_teacher_content.sql'),
  ('041_student_dashboard.sql'),
  ('042_diagnostic_and_signup.sql')
;

SET FOREIGN_KEY_CHECKS = 1;
