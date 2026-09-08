import {NextResponse} from "next/server";
export async function GET(){const id=process.env.TIENDANUBE_APP_ID;if(!id)return NextResponse.json({error:"Falta TIENDANUBE_APP_ID"},{status:500});return NextResponse.redirect(`https://www.tiendanube.com/apps/${id}/authorize`)}
