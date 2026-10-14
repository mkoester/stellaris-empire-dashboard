import type { ServerInit } from '@sveltejs/kit/hooks';
import { start } from '#lib/server/app.ts';

export const init: ServerInit = start;
