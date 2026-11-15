import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const importedCatalogues = sqliteTable('imported_catalogues', {
  cacheKey: text('cache_key').primaryKey(),
  resultJson: text('result_json').notNull(),
  imagesJson: text('images_json').notNull(),
  expiresAt: integer('expires_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
