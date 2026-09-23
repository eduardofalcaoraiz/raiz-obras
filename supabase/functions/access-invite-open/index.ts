import {createOpenHandler} from './handler.mjs';
Deno.serve(createOpenHandler({url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
