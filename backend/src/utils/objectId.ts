import { z } from 'zod';
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectId });
