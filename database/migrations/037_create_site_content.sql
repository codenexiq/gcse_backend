-- The public website (home, blog, shop, about): content the visitors read, and the enquiries they send.
-- The starting content comes from `npm run db:seed-site`.

-- Blog posts shown on the home page and the Blog page. Each one links to the full article.
CREATE TABLE site_posts (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title        VARCHAR(200) NOT NULL,
  excerpt      VARCHAR(400) NOT NULL,
  tag          VARCHAR(60)  NOT NULL,
  author       VARCHAR(80)  NOT NULL,
  published_on DATE         NOT NULL,
  url          VARCHAR(300) NOT NULL,
  -- The flat colour of the cover card.
  color        ENUM('sky', 'rose', 'cream', 'lav') NOT NULL DEFAULT 'sky',
  is_featured  TINYINT(1)   NOT NULL DEFAULT 0,
  is_published TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- The Blog page lists published posts, newest first.
  KEY idx_site_posts_listing (is_published, published_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Revision packs in the resources shop. The lists (topics, what is included...) are stored as JSON text.
CREATE TABLE site_products (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug         VARCHAR(60)  NOT NULL,
  eyebrow      VARCHAR(160) NOT NULL,
  title        VARCHAR(160) NOT NULL,
  price        VARCHAR(20)  NOT NULL,
  lead         VARCHAR(600) NOT NULL,
  tags_title   VARCHAR(60)  NOT NULL,
  details      LONGTEXT     NOT NULL,
  note         VARCHAR(300) NOT NULL DEFAULT '',
  sort_order   INT UNSIGNED NOT NULL DEFAULT 0,
  is_published TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_site_products_slug (slug),
  KEY idx_site_products_listing (is_published, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE site_product_images (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  url        VARCHAR(300) NOT NULL,
  alt        VARCHAR(200) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_site_product_images_product (product_id, sort_order),
  CONSTRAINT fk_spi_product FOREIGN KEY (product_id) REFERENCES site_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The tutors on the About page.
CREATE TABLE site_team (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(80)  NOT NULL,
  subjects   VARCHAR(120) NOT NULL,
  icon       VARCHAR(20)  NOT NULL DEFAULT 'maths',
  color      ENUM('sky', 'rose', 'cream', 'lav') NOT NULL DEFAULT 'sky',
  -- Paragraphs of the biography, as JSON text.
  bio        LONGTEXT     NOT NULL,
  photo_url  VARCHAR(300) NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_site_team_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Video reviews (a clip of a student or parent) and written Google reviews.
CREATE TABLE site_reviews (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind         ENUM('video', 'google') NOT NULL,
  name         VARCHAR(80)  NOT NULL,
  about        VARCHAR(160) NOT NULL,
  body         TEXT         NULL,
  video_url    VARCHAR(300) NULL,
  poster_url   VARCHAR(300) NULL,
  sort_order   INT UNSIGNED NOT NULL DEFAULT 0,
  is_published TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_site_reviews_listing (kind, is_published, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- "Book a free consultation" messages from the contact form. Admins read them in the dashboard.
CREATE TABLE site_enquiries (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_name  VARCHAR(100) NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  email        VARCHAR(254) NOT NULL,
  phone        VARCHAR(40)  NULL,
  year_group   VARCHAR(20)  NOT NULL,
  subject      VARCHAR(40)  NOT NULL,
  message      TEXT         NULL,
  status       ENUM('new', 'contacted', 'closed') NOT NULL DEFAULT 'new',
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- The inbox: newest first, filtered by status.
  KEY idx_site_enquiries_inbox (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
