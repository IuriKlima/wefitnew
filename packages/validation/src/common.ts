import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const nonEmptyTrimmedString = z.string().trim().min(1);
