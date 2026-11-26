# whatsapp-checker

Official alias of [`whatsapp-data-sdk`](https://www.npmjs.com/package/whatsapp-data-sdk), the TypeScript client for the [WhatsApp Data API by CheckLeaked](https://whatsapp.checkleaked.cc). It re-exports the SDK unchanged, so both names give you the same client.

New projects can install `whatsapp-data-sdk` directly. This package exists so that `npm install whatsapp-checker`, a name our older docs used, always installs the official client.

```bash
npm install whatsapp-checker
```

```ts
import { WhatsAppDataClient } from 'whatsapp-checker'

const client = new WhatsAppDataClient({ apiKey: process.env.WA_API_KEY! })
const profile = await client.getProfile('14155552671')
console.log(profile.exists, profile.about, profile.profilePic)
```

Full documentation: [whatsapp-data-sdk README](https://github.com/eduair94/whatsapp-data-sdk#readme). API keys: [whatsapp.checkleaked.cc](https://whatsapp.checkleaked.cc).

CheckLeaked is an independent service and is not affiliated with, endorsed by, or sponsored by WhatsApp or Meta.

## License

MIT
