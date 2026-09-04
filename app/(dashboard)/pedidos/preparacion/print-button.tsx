"use client";
import { Icon } from "@/components/ui/icons";
export default function PrintButton(){return <button onClick={()=>window.print()} className="pt-button-primary no-print inline-flex items-center gap-2 px-4 py-2 text-sm"><Icon name="print" className="h-4 w-4"/>Imprimir / Guardar PDF</button>}
