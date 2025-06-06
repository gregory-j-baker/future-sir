import * as v from 'valibot';

import { Redacted } from '~/.server/utils/security-utils';

export type InteropApi = Readonly<v.InferOutput<typeof interopApi>>;

export const defaults = {
  INTEROP_ASSOCIATE_SIN_API_AUTH_HEADER: 'Ocp-Apim-Subscription-Key 00000000000000000000000000000000',
  INTEROP_ASSOCIATE_SIN_API_BASE_URL: 'http://localhost:3000/api',
  INTEROP_SIN_REG_API_AUTH_HEADER: 'Ocp-Apim-Subscription-Key 00000000000000000000000000000000',
  INTEROP_SIN_REG_API_BASE_URL: 'http://localhost:3000/api',
  INTEROP_SIN_SEARCH_API_AUTH_HEADER: 'Ocp-Apim-Subscription-Key 00000000000000000000000000000000',
  INTEROP_SIN_SEARCH_API_BASE_URL: 'http://localhost:3000/api',
} as const;

export const interopApi = v.object({
  INTEROP_PROXY_URL: v.optional(v.string()),
  INTEROP_ASSOCIATE_SIN_API_AUTH_HEADER: v.pipe(
    v.optional(v.string(), defaults.INTEROP_ASSOCIATE_SIN_API_AUTH_HEADER),
    v.transform(Redacted.make),
  ),
  INTEROP_ASSOCIATE_SIN_API_BASE_URL: v.optional(v.string(), defaults.INTEROP_ASSOCIATE_SIN_API_BASE_URL),
  INTEROP_SIN_REG_API_AUTH_HEADER: v.pipe(
    v.optional(v.string(), defaults.INTEROP_SIN_REG_API_AUTH_HEADER),
    v.transform(Redacted.make),
  ),
  INTEROP_SIN_REG_API_BASE_URL: v.optional(v.string(), defaults.INTEROP_SIN_REG_API_BASE_URL),
  INTEROP_SIN_SEARCH_API_AUTH_HEADER: v.pipe(
    v.optional(v.string(), defaults.INTEROP_SIN_SEARCH_API_AUTH_HEADER),
    v.transform(Redacted.make),
  ),
  INTEROP_SIN_SEARCH_API_BASE_URL: v.optional(v.string(), defaults.INTEROP_SIN_SEARCH_API_BASE_URL),
});
