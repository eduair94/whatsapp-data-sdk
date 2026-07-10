/**
 * Cache-first lookups to minimize cost, and streaming the whole database.
 * Run with:
 *   WA_API_KEY=<your key> npx tsx examples/cache-first.ts
 */
import { WhatsAppDataClient } from '../src/index.js'

const client = new WhatsAppDataClient({
  apiKey: process.env.WA_API_KEY ?? '',
  transport: 'rapidapi', // uses wp-data (live) + wp-data-db-only (cache)
})

async function main() {
  const numbers = ['59898297150', '14155552671', '972526658013']

  for (const number of numbers) {
    // Reads the DB-only host first; only pays for a live check on a miss.
    const res = await client.checkCached(number, { mode: 'cacheFirst' })
    console.log(`${number}: exists=${res.exists} (source=${res._source})`)
  }

  // Bulk downloads (MEGA tier only) — return a Google Drive link to the full data.
  try {
    const backup = await client.downloadEntireDatabase()
    console.log('DB backup drive folder:', backup.driveFolder.url)
    const leaks = await client.getLeakedNumbersInfo()
    console.log('Leaks drive folder:', leaks.driveFolder.url)
  } catch (err) {
    console.log('bulk download requires a MEGA-tier key:', (err as Error).message)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
