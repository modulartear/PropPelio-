import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireTenantUser } from "@/lib/auth/session";
import { forTenant } from "@/lib/db";

export const metadata: Metadata = {
  title: "Propiedades",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservada",
  SOLD: "Vendida / alquilada",
};

const VARIANTE_ESTADO: Record<string, "default" | "secondary" | "outline"> = {
  AVAILABLE: "default",
  RESERVED: "secondary",
  SOLD: "outline",
};

const ETIQUETA_OPERACION: Record<string, string> = { SALE: "Venta", RENT: "Alquiler" };

function formatearPrecio(precio: unknown, moneda: string): string {
  if (precio === null || precio === undefined) return "Sin precio";
  const numero = Number(precio);
  return `${moneda} ${numero.toLocaleString("es-AR")}`;
}

/**
 * Listado de propiedades del tenant. `forTenant(tenant.id)` ya filtra por
 * tenantId — no hay `where: { tenantId }` a mano en ningun lado de este
 * archivo, y no hace falta: es justamente lo que evita la capa de acceso.
 */
export default async function ListadoDePropiedades() {
  const { tenant } = await requireTenantUser();
  const db = forTenant(tenant.id);

  const propiedades = await db.property.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      propertyType: true,
      operationType: true,
      status: true,
      price: true,
      currency: true,
      addressCity: true,
      addressProvince: true,
      _count: { select: { photos: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Propiedades</h1>
          <p className="text-sm text-muted-foreground">
            {propiedades.length === 0
              ? "Todavía no cargaste ninguna propiedad."
              : `${propiedades.length} propiedad${propiedades.length === 1 ? "" : "es"}.`}
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/propiedades/nueva">
            <Plus />
            Nueva propiedad
          </Link>
        </Button>
      </div>

      {propiedades.length === 0 ? (
        <Card>
          <CardHeader>
            <CardDescription>
              Cargá tu primera propiedad para que empiece a aparecer en tu panel.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {propiedades.map((propiedad) => (
            <Link key={propiedad.id} href={`/admin/propiedades/${propiedad.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{propiedad.title}</CardTitle>
                    <Badge variant={VARIANTE_ESTADO[propiedad.status]}>
                      {ETIQUETA_ESTADO[propiedad.status]}
                    </Badge>
                  </div>
                  <CardDescription>
                    {propiedad.addressCity}, {propiedad.addressProvince}
                  </CardDescription>
                  <CardDescription>
                    {ETIQUETA_OPERACION[propiedad.operationType]} ·{" "}
                    {formatearPrecio(propiedad.price, propiedad.currency)}
                  </CardDescription>
                  <CardDescription>
                    {propiedad._count.photos} foto{propiedad._count.photos === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
