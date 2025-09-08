#!/usr/bin/env node

/**
 * Data Migration Script for Dutch Learning App
 *
 * Usage:
 *   node scripts/run-migration.js migrate_articles
 *   node scripts/run-migration.js migrate_images
 */

require('dotenv/config')

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration in .env file')
  process.exit(1)
}

const action = process.argv[2]

if (!action) {
  console.log('📖 Usage:')
  console.log(
    '  node scripts/run-migration.js migrate_missing   # ⭐ SMART: Fill only missing fields'
  )
  console.log(
    '  node scripts/run-migration.js migrate_articles  # Add articles to nouns'
  )
  console.log(
    '  node scripts/run-migration.js migrate_images    # Add images to words'
  )
  console.log('')
  console.log(
    '💡 Recommended: Use "migrate_missing" for automatic detection and filling of all missing fields'
  )
  process.exit(1)
}

async function runMigration(action) {
  try {
    console.log(`🚀 Starting migration: ${action}`)
    console.log('⏳ This may take a while...\n')

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/data-migration`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    console.log('📊 Migration Results:')
    console.log(`   Action: ${result.action}`)
    console.log(`   Processed: ${result.processed}`)
    console.log(`   Updated: ${result.updated}`)
    console.log(`   Errors: ${result.errors}\n`)

    if (result.details && result.details.length > 0) {
      console.log('📝 Details:')
      result.details.forEach(detail => {
        if (detail.includes('Error')) {
          console.log(`   ❌ ${detail}`)
        } else if (detail.includes('Updated') || detail.includes('Added')) {
          console.log(`   ✅ ${detail}`)
        } else {
          console.log(`   ℹ️  ${detail}`)
        }
      })
    }

    if (result.errors > 0) {
      console.log(`\n⚠️  Migration completed with ${result.errors} errors`)
      process.exit(1)
    } else {
      console.log('\n🎉 Migration completed successfully!')
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigration(action)
