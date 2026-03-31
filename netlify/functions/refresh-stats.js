// netlify/functions/refresh-stats.js
// Runs daily at 2 AM ET (7 AM UTC) via Netlify Scheduled Functions.
// Busts the Next.js ISR cache for the stats API route so fresh data
// is served on the next page load.

const { schedule } = require('@netlify/functions');

const handler = async () => {
  const baseUrl = process.env.URL || process.env.DEPLOY_URL;

  if (!baseUrl) {
    console.error('[refresh-stats] No URL env var set');
    return { statusCode: 500 };
  }

  try {
    // Trigger a revalidation of the stats API route
    // In production, you'd call Next.js on-demand revalidation endpoint
    const res = await fetch(`${baseUrl}/api/revalidate?secret=${process.env.REVALIDATE_SECRET}`);
    console.log('[refresh-stats] Revalidation status:', res.status);
    return { statusCode: 200, body: 'Stats refreshed' };
  } catch (err) {
    console.error('[refresh-stats] Error:', err);
    return { statusCode: 500 };
  }
};

exports.handler = schedule('0 7 * * *', handler);
