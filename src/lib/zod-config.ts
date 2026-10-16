import { z } from "zod";

/**
 * Zod 4 probes `new Function("")` to decide whether it may compile faster parsers. Our
 * Content-Security-Policy has no 'unsafe-eval', so in the browser that probe is blocked and
 * logged as a CSP violation (harmless, Zod falls back by itself). Telling Zod up front to skip
 * the JIT in the browser keeps the console and the DevTools Issues panel clean. Server-side
 * validation keeps the JIT. Imported (for its side effect) by every validators/* module.
 */
if (typeof window !== "undefined") z.config({ jitless: true });
