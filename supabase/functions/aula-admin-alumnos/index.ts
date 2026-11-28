import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const project = "invest-capital-aula";
const url = Deno.env.get("SUPABASE_URL")!;
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization", "Access-Control-Allow-Methods": "GET, OPTIONS", "Cache-Control": "no-store" };
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, {headers});
  if (req.method !== "GET") return json({},405);
  const token = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({},401);
  try {
    const {payload} = await jwtVerify(token, keys, {algorithms:["RS256"], issuer:"https://securetoken.google.com/"+project, audience:project, requiredClaims:["sub","exp","iat","auth_time"]});
    const fb = payload.firebase as {sign_in_provider?:string} | undefined;
    if (!payload.sub || payload.email !== "investcapital8310@gmail.com" || payload.email_verified !== true || fb?.sign_in_provider !== "google.com") return json({},403);
  } catch { return json({},401); }
  const params = new URL(req.url).searchParams;
  const page = Number(params.get("pagina") || "1");
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return json({},400);
  const alumno = params.get("alumno");
  if (alumno !== null && !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(alumno)) return json({},400);
  const offset = (page-1)*50;
  const path = alumno === null ? "/auth/v1/admin/users?page="+page+"&per_page=50" :
    "/rest/v1/aula_solicitudes?select=id,tipo,importe,creada&alumno=eq."+alumno+"&order=creada.desc,id.desc&limit=50&offset="+offset;
  try {
    const upstream = await fetch(url+path,{headers:{apikey:secret,Authorization:"Bearer "+secret}});
    if (!upstream.ok) return json({},502);
    const data = await upstream.json();
    const rows = alumno === null ? data.users.map((u: {id:string,email?:string,user_metadata?:{registro_nombre?:unknown},created_at:string,email_confirmed_at?:string})=>({
      id:u.id,correo:u.email||"",nombre:typeof u.user_metadata?.registro_nombre==="string"?u.user_metadata.registro_nombre.slice(0,150):"",alta:u.created_at,confirmada:Boolean(u.email_confirmed_at)
    })) : data;
    return json({rows,mas:rows.length===50});
  } catch { return json({},502); }
});