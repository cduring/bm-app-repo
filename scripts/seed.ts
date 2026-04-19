import { createSeedClient } from './seed/supabase';
import { seedNiches } from './seed/niches';
import { seedProfiles } from './seed/profiles';
import { seedEvents } from './seed/events';
import { seedFollows } from './seed/follows';
import { seedRsvps } from './seed/rsvps';
import { seedPortfolio } from './seed/portfolio';
import { resetMockData } from './seed/reset';

async function main() {
  const shouldReset = process.argv.includes('--reset');
  const client = createSeedClient();

  const url = process.env.SUPABASE_URL!;
  console.log(`→ Seeding ${new URL(url).host}`);

  if (shouldReset) {
    console.log('[reset] clearing mock rows');
    await resetMockData(client);
  }

  console.log('[niches] upserting');
  const nicheMap = await seedNiches(client);
  console.log(`  ${nicheMap.size} niches mapped`);

  console.log('[profiles] upserting');
  await seedProfiles(client, nicheMap);

  console.log('[events] upserting');
  await seedEvents(client, nicheMap);

  console.log('[follows] seeding');
  await seedFollows(client);

  console.log('[rsvps] seeding');
  await seedRsvps(client);

  console.log('[portfolio] seeding');
  await seedPortfolio(client);

  console.log('\n✓ Seed complete');
}

main().catch((err) => {
  console.error('\n✗ Seed failed:');
  console.error(err);
  process.exit(1);
});
