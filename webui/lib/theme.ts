/**
 * DPBuilder theme helpers.
 *
 * All component colors live in tailwind.config.ts under the `dpb` namespace.
 * This file provides the one thing Tailwind can't express as a utility class:
 * the gradient used on buttons and the logo mark.
 *
 * To change the accent gradient, update `dpb.grad-from` / `dpb.grad-to` in
 * tailwind.config.ts AND the `GRADIENT` value here.
 */

export const GRADIENT = 'linear-gradient(135deg, #6264a7, #7b83eb)'
