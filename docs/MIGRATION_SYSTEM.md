# Data Migration System

## Overview

The Data Migration System is designed to update existing words in the database when new features are added to the app. This ensures that older words can benefit from new functionality without requiring users to re-add them.

## Architecture

### 1. Migration Edge Function

- **Location**: `supabase/functions/data-migration/index.ts`
- **Purpose**: Serverless function that handles data migrations
- **Security**: Uses Supabase Service Role Key for database access
- **Rate Limiting**: Built-in delays to avoid API limits

### 2. Migration Script

- **Location**: `scripts/run-migration.js`
- **Purpose**: Command-line interface for running migrations
- **Security**: Uses environment variables for configuration

## Available Migrations

### `migrate_articles`

Adds Dutch articles (de/het) to existing nouns that don't have articles.

- **Process**:
  1. Finds all nouns without articles
  2. Calls Gemini AI to determine the correct article
  3. Updates the database with the article

- **Usage**:
  ```bash
  node scripts/run-migration.js migrate_articles
  ```

### `migrate_images`

Adds associated images to existing words that don't have images.

- **Process**:
  1. Finds all words without images
  2. Uses primary English translation to search for images
  3. Gets images from Unsplash API (or Lorem Picsum fallback)
  4. Updates the database with image URLs

- **Usage**:
  ```bash
  node scripts/run-migration.js migrate_images
  ```

## Environment Requirements

The migration system requires the following environment variables:

```bash
# In .env file
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# In Supabase secrets
GEMINI_API_KEY=your_gemini_key
UNSPLASH_ACCESS_KEY=your_unsplash_key  # Optional, fallback used if missing
```

## Running Migrations

### Prerequisites

1. Ensure the Edge Function is deployed:

   ```bash
   npx supabase functions deploy data-migration
   ```

2. Set up environment variables in `.env`

3. Ensure API keys are set in Supabase secrets:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=your_key
   npx supabase secrets set UNSPLASH_ACCESS_KEY=your_key
   ```

### Execution

```bash
# Add articles to nouns
node scripts/run-migration.js migrate_articles

# Add images to words
node scripts/run-migration.js migrate_images
```

## Migration Results

Each migration provides detailed feedback:

- **Processed**: Number of words examined
- **Updated**: Number of words successfully updated
- **Errors**: Number of errors encountered
- **Details**: Specific information about each operation

Example output:

```
📊 Migration Results:
   Action: migrate_articles
   Processed: 2
   Updated: 1
   Errors: 0

📝 Details:
   ℹ️  Found 2 nouns without articles
   ✅ Updated verslag with article "het"
   ℹ️  No article determined for loop
```

## Adding New Migrations

To add a new migration type:

1. **Update the Edge Function** (`supabase/functions/data-migration/index.ts`):

   ```typescript
   else if (action === 'migrate_new_feature') {
     // Your migration logic here
   }
   ```

2. **Add helper functions** as needed for API calls or data processing

3. **Deploy the function**:

   ```bash
   npx supabase functions deploy data-migration
   ```

4. **Update the script documentation** in `scripts/run-migration.js`

5. **Test thoroughly** before running on production data

## Error Handling

The system includes comprehensive error handling:

- **API Rate Limits**: Built-in delays between operations
- **Database Errors**: Graceful handling with detailed error messages
- **Network Issues**: Retries and fallbacks for external APIs
- **Data Validation**: Checks before updating database

## Security Considerations

- **Service Role Key**: Used for bypassing RLS in migration context
- **API Key Management**: Stored securely in Supabase secrets
- **Input Validation**: All inputs are validated before processing
- **Audit Trail**: Detailed logging of all operations

## Best Practices

1. **Test First**: Always test migrations on a subset of data
2. **Backup**: Ensure database backups before major migrations
3. **Monitor**: Watch for rate limiting and API quotas
4. **Incremental**: Run migrations in small batches if possible
5. **Rollback Plan**: Have a plan to undo changes if needed

## Future Enhancements

Planned improvements:

- **Batch Processing**: Handle large datasets more efficiently
- **Resume Capability**: Continue from where migration stopped
- **Rollback Support**: Ability to undo migrations
- **Progress Tracking**: Real-time progress updates
- **Notification System**: Alerts when migrations complete

---

_Last updated: September 7, 2025_
