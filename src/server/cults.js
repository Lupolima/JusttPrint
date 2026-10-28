'use strict';

/**
 * Cults (cults3d.com) model details, from its GraphQL API. Its pages are behind a Cloudflare
 * browser check a server cannot pass; the API answers with a Cults account's API key (made on
 * Cults under the account's API page; reading is enough), given as CULTS_USER and CULTS_KEY in the
 * environment. The API names a model's files but gives no download links, not even for free
 * models: their files are added by hand (Add Downloaded Files…).
 */

const TIMEOUT_MS = 20000;
const MAX_ANSWER_BYTES = 8 * 1024 * 1024;

// English: the designer's own words when they wrote in English (other languages are machine translations).
const FIELDS = `name(locale: EN) slug url(locale: EN) license { name } creator { nick url(locale: EN) }
  category { name(locale: EN) } subCategories { name(locale: EN) } tags(locale: EN) publishedAt updatedAt
  likesCount downloadsCount viewsCount description(locale: EN) details(locale: EN)
  illustrations { position imageUrl } videos { url } blueprints { fileName fileExtension position }`;

function keyError(message) {
  return Object.assign(new Error(message), { code: 'CULTS_KEY' });
}

/**
 * A Cults model by the name at the end of its link (the creation's slug), or null when Cults has
 * none. Throws `code: 'CULTS_KEY'` without an API key or when Cults refuses it.
 * @param {string} slug
 * @param {Function} fetchImpl
 */
async function creation(slug, fetchImpl) {
  const user = String(process.env.CULTS_USER || '').trim();
  const key = String(process.env.CULTS_KEY || '').trim();
  if (!user || !key)
    throw keyError("Cults needs an API key: set CULTS_USER (your Cults user name) and CULTS_KEY (an API key made on Cults) in JusttPrint's environment");
  const { readLimited, USER_AGENT } = require('./link-import');
  const response = await fetchImpl('https://cults3d.com/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': USER_AGENT,
      authorization: `Basic ${Buffer.from(`${user}:${key}`).toString('base64')}`
    },
    body: JSON.stringify({ query: `query JusttPrintCults($slug: String!) { creation(slug: $slug) { ${FIELDS} } }`, variables: { slug } }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = (await readLimited(response, MAX_ANSWER_BYTES)).toString('utf8');
  if (response.status === 401) throw keyError('Cults did not accept the API key: check CULTS_USER and CULTS_KEY');
  if (!response.ok) throw new Error(`Cults answered ${response.status}`);
  const body = JSON.parse(text);
  if (body.errors && body.errors.length) throw new Error(`Cults: ${body.errors[0].message}`);
  return (body.data && body.data.creation) || null;
}

module.exports = { creation };
