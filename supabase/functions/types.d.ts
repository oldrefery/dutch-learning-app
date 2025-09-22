// Deno global types for Supabase Edge Functions
declare global {
  namespace Deno {
    interface Env {
      get(key: string): string | undefined
    }

    const env: Env

    function serve(
      handler: (request: Request) => Response | Promise<Response>,
      options?: { port?: number; hostname?: string }
    ): Promise<void>
  }

  const Deno: typeof Deno
}

export {}
