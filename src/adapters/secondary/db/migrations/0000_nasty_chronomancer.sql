CREATE TABLE `feed_ingestion_sources` (
	`feed_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`owner_user_id` integer NOT NULL,
	`title` text,
	`description` text,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`feed_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `ingestion_sources`(`source_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feed_members` (
	`feed_id` integer PRIMARY KEY NOT NULL,
	`user_id` integer PRIMARY KEY NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`feed_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feed_posts` (
	`feed_id` integer NOT NULL,
	`post_id` integer NOT NULL,
	`owner_user_id` integer NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`feed_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `feeds` (
	`feed_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`owner_user_id` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_slug_unique` ON `feeds` (`slug`);--> statement-breakpoint
CREATE TABLE `ingestion_sources` (
	`source_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_url` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ingestion_sources_source_url_unique` ON `ingestion_sources` (`source_url`);--> statement-breakpoint
CREATE TABLE `posts` (
	`post_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`original_url` text NOT NULL,
	`textContent` text NOT NULL,
	`html_content` text,
	`title` text,
	`generated_summary` text,
	`embedding` text
);
--> statement-breakpoint
CREATE TABLE `user_post_interactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` integer NOT NULL,
	`user_id` integer NOT NULL,
	`post_id` integer NOT NULL,
	`interaction_type` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`post_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`user_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`hashed_password` text NOT NULL,
	`fullname` text,
	`created_at` integer NOT NULL,
	`user_embedding` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);