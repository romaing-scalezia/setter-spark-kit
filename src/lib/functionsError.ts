// supabase.functions.invoke() throws a generic "Edge Function returned a
// non-2xx status code" FunctionsHttpError on any 4xx/5xx response and leaves
// `data` null — the JSON body our functions return (e.g. { error: "..." })
// only lives on error.context, the raw Response. This reads it back out.
export async function parseFunctionErrorBody(error: unknown): Promise<Record<string, unknown> | null> {
  const context = (error as { context?: Response } | null)?.context;
  if (!(context instanceof Response)) return null;
  try {
    return await context.json();
  } catch {
    return null;
  }
}
