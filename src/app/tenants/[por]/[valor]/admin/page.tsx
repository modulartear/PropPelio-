import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Panel",
};

/**
 * Dashboard del panel. Sub-etapa 3.1: solo el esqueleto visual.
 *
 * Los tres indicadores que pide el plan (propiedades activas, consultas
 * recientes, tasaciones pendientes) se conectan a datos reales en 3.2 y 3.3,
 * cuando existan las tablas de las que salen esos numeros. Mostrarlos en
 * cero ahora seria mentir; se marcan "Próximamente" en vez de fingir un dato.
 */
export default async function Dashboard() {
  const { usuario, tenant } = await requireTenantUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {usuario.name ?? usuario.email}
        </h1>
        <p className="text-sm text-muted-foreground">
          Panel de <span className="font-medium text-foreground">{tenant.name}</span>. Los módulos
          de gestión llegan en las próximas etapas de la Fase 3.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Placeholder titulo="Propiedades activas" />
        <Placeholder titulo="Consultas recientes" />
        <Placeholder titulo="Tasaciones pendientes" />
      </div>
    </div>
  );
}

function Placeholder({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{titulo}</CardDescription>
        <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
          —<Badge variant="outline">Próximamente</Badge>
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
