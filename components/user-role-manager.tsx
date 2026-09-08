"use client";
import {useState} from "react";
import {updateUserRole} from "@/app/(dashboard)/configuracion/actions";

type User={id:string;full_name:string|null;role:string;active:boolean};
export default function UserRoleManager({users,currentUserId}:{users:User[];currentUserId?:string}){
 const [saving,setSaving]=useState<string|null>(null); const [message,setMessage]=useState("");
 async function change(user:User,role:string){if(role===user.role)return;if(!window.confirm(`¿Cambiar a ${user.full_name||"este usuario"} de ${user.role} a ${role}?`))return;setSaving(user.id);setMessage("");const fd=new FormData();fd.set("profile_id",user.id);fd.set("role",role);const r=await updateUserRole(fd);setMessage(r?.message||"");setSaving(null)}
 return <div><div className="divide-y divide-[#f2e6ec]">{users.map(u=><div key={u.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#3e2833]">{u.full_name||"Usuario"}{u.id===currentUserId?<span className="ml-2 text-[10px] font-black text-[#a83f6d]">VOS</span>:null}</p><p className="mt-0.5 text-[11px] text-[#8d7480]">{u.active?"Activo":"Inactivo"}</p></div><select disabled={saving===u.id} value={u.role} onChange={e=>change(u,e.target.value)} className="pt-input sm:w-44"><option value="ADMIN">ADMIN</option><option value="OPERADOR">OPERADOR</option></select></div>)}</div>{message&&<p className="border-t border-[#f2e6ec] px-5 py-3 text-xs font-bold text-[#6d5cff]">{message}</p>}</div>
}
