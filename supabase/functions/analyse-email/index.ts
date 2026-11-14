import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Retired: emails are now summarised on-device by Gemini Nano in the Chrome extension,
// so full email text is never sent to a server. Kept as a stub so nothing can use it.
Deno.serve(() => new Response(JSON.stringify({ error: "This function is retired. Use the DebtJet Chrome extension." }), { status: 410, headers: { "Content-Type": "application/json" } }));
