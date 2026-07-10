/**
 * Basic usage. Run with:
 *   WA_API_KEY=<your key> npx tsx examples/basic.ts
 */
import { WhatsAppDataClient } from '../src/index.js'

const client = new WhatsAppDataClient({
  apiKey: process.env.WA_API_KEY ?? '',
  // transport: 'rapidapi', // uncomment to use the RapidAPI hosts
})

async function main() {
  const number = process.env.WA_TEST_NUMBER ?? '59898297150'

  const profile = await client.getProfile(number, {
    telegram: true,
    includeCarrier: true,
  })
  console.log('exists:', profile.exists)
  console.log('about:', profile.about)
  console.log('country:', profile.countryCode)

  const carrier = await client.carrierLookup(number)
  console.log('carrier:', carrier.carrier, carrier.lineType)

  const devices = await client.getDeviceCount(number)
  console.log('devices:', devices.deviceCount)

  const breaches = await client.getPhoneBreaches(number)
  console.log('breaches found:', breaches.found)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
