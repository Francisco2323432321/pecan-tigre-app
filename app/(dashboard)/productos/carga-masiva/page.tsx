import PageHeader from "@/components/ui/page-header";
import InternalBulkImportClient from "./internal-bulk-import-client";

export default function CargaMasivaPage() {
  return (
    <main className="pt-page">
      <PageHeader
        eyebrow="Catálogo"
        title="Carga masiva propia"
        description="Cargá varios productos con nuestro formato interno. Podés pegar filas o subir un CSV; siempre se valida antes de confirmar."
      />
      <InternalBulkImportClient />
    </main>
  );
}
