import {createRemoteJWKSet,jwtVerify} from 'https://esm.sh/jose@5.9.6';
import {createWorker} from './handler.mjs';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
Deno.serve(createWorker({
 url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 // This is a public OAuth client identifier, not a credential.
 audience:Deno.env.get('INVITE_GOOGLE_AUDIENCE')||'1001890521083-61102hr2m2fbsj2jfr15l1ph929ush0d.apps.googleusercontent.com',
 verifyGoogle:async(token:string,audience:string)=>{
  const {payload}=await jwtVerify(token,keys,{audience,issuer:['https://accounts.google.com','accounts.google.com'],algorithms:['RS256'],clockTolerance:10});
  return payload;
 }
}));
