CREATE TABLE `imported_catalogues` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`result_json` text NOT NULL,
	`images_json` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
