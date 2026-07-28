"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EstadoDeFormulario } from "@/lib/properties/acciones";
import {
  CURRENCIES,
  OPERATION_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type Currency,
  type OperationType,
  type PropertyStatus,
  type PropertyType,
  type ValoresDePropiedad,
} from "@/lib/properties/validacion";

/**
 * Formulario de alta/edicion de propiedades. Un solo componente para los dos
 * casos: la diferencia es la Server Action que recibe (`crearPropiedad` o
 * `actualizarPropiedad` ya "bindeada" con el id) y si hay valores iniciales.
 *
 * Los select son elementos NATIVOS (<select>), no el componente de shadcn
 * basado en Radix. Es deliberado por esta vez: este es el primer formulario
 * del proyecto con multiples campos de seleccion enviados por Server Action,
 * y no hay forma de probarlo en un navegador real desde este entorno (ver
 * las limitaciones de Codespaces ya documentadas). Un <select> nativo
 * participa en el FormData sin ninguna duda posible; el componente de Radix
 * queda disponible en src/components/ui/select.tsx para cuando haga falta
 * algo mas rico (busqueda, opciones con iconos) y se pueda probar en vivo.
 */

const ETIQUETA_TIPO: Record<PropertyType, string> = {
  HOUSE: "Casa",
  APARTMENT: "Departamento",
  LAND: "Terreno",
  COMMERCIAL: "Local comercial",
  OFFICE: "Oficina",
};

const ETIQUETA_OPERACION: Record<OperationType, string> = {
  SALE: "Venta",
  RENT: "Alquiler",
};

const ETIQUETA_ESTADO: Record<PropertyStatus, string> = {
  AVAILABLE: "Disponible",
  RESERVED: "Reservada",
  SOLD: "Vendida / alquilada",
};

const ETIQUETA_MONEDA: Record<Currency, string> = { ARS: "ARS", USD: "USD" };

const ESTILO_SELECT =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

const ESTADO_INICIAL: EstadoDeFormulario = {};

function BotonDeEnvio({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : texto}
    </Button>
  );
}

export function PropertyForm({
  accion,
  valoresIniciales,
  textoBoton,
}: {
  accion: (estadoPrevio: EstadoDeFormulario, formData: FormData) => Promise<EstadoDeFormulario>;
  valoresIniciales?: Partial<ValoresDePropiedad>;
  textoBoton: string;
}) {
  const [estado, ejecutar] = useActionState(accion, ESTADO_INICIAL);
  const v = valoresIniciales;
  const errores = estado.campos ?? {};

  return (
    <form action={ejecutar} className="flex flex-col gap-8">
      {estado.error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {estado.error}
        </p>
      )}

      <Seccion titulo="Datos básicos">
        <Campo
          etiqueta="Título"
          nombre="title"
          defaultValue={v?.title}
          error={errores.title}
          requerido
        />
        <CampoAncho>
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={v?.description ?? ""}
            rows={4}
          />
        </CampoAncho>
      </Seccion>

      <Seccion titulo="Clasificación">
        <CampoSelect
          etiqueta="Tipo de propiedad"
          nombre="propertyType"
          defaultValue={v?.propertyType ?? PROPERTY_TYPES[0]}
          opciones={PROPERTY_TYPES}
          etiquetas={ETIQUETA_TIPO}
          error={errores.propertyType}
        />
        <CampoSelect
          etiqueta="Operación"
          nombre="operationType"
          defaultValue={v?.operationType ?? OPERATION_TYPES[0]}
          opciones={OPERATION_TYPES}
          etiquetas={ETIQUETA_OPERACION}
          error={errores.operationType}
        />
        <CampoSelect
          etiqueta="Estado"
          nombre="status"
          defaultValue={v?.status ?? PROPERTY_STATUSES[0]}
          opciones={PROPERTY_STATUSES}
          etiquetas={ETIQUETA_ESTADO}
          error={errores.status}
        />
      </Seccion>

      <Seccion titulo="Precio">
        <Campo
          etiqueta="Precio"
          nombre="price"
          tipo="number"
          paso="0.01"
          defaultValue={v?.price ?? ""}
          error={errores.price}
        />
        <CampoSelect
          etiqueta="Moneda"
          nombre="currency"
          defaultValue={v?.currency ?? "ARS"}
          opciones={CURRENCIES}
          etiquetas={ETIQUETA_MONEDA}
          error={errores.currency}
        />
      </Seccion>

      <Seccion titulo="Ubicación">
        <CampoAncho>
          <Campo
            etiqueta="Calle y altura"
            nombre="addressStreet"
            defaultValue={v?.addressStreet}
            error={errores.addressStreet}
            requerido
          />
        </CampoAncho>
        <Campo
          etiqueta="Ciudad"
          nombre="addressCity"
          defaultValue={v?.addressCity}
          error={errores.addressCity}
          requerido
        />
        <Campo
          etiqueta="Provincia"
          nombre="addressProvince"
          defaultValue={v?.addressProvince}
          error={errores.addressProvince}
          requerido
        />
        <Campo
          etiqueta="Código postal"
          nombre="addressZip"
          defaultValue={v?.addressZip ?? ""}
          error={errores.addressZip}
        />
      </Seccion>

      <Seccion titulo="Características">
        <Campo
          etiqueta="Dormitorios"
          nombre="bedrooms"
          tipo="number"
          defaultValue={v?.bedrooms ?? ""}
          error={errores.bedrooms}
        />
        <Campo
          etiqueta="Baños"
          nombre="bathrooms"
          tipo="number"
          defaultValue={v?.bathrooms ?? ""}
          error={errores.bathrooms}
        />
        <Campo
          etiqueta="Cocheras"
          nombre="garageSpaces"
          tipo="number"
          defaultValue={v?.garageSpaces ?? ""}
          error={errores.garageSpaces}
        />
        <Campo
          etiqueta="Superficie total (m²)"
          nombre="totalArea"
          tipo="number"
          paso="0.01"
          defaultValue={v?.totalArea ?? ""}
          error={errores.totalArea}
        />
        <Campo
          etiqueta="Superficie cubierta (m²)"
          nombre="coveredArea"
          tipo="number"
          paso="0.01"
          defaultValue={v?.coveredArea ?? ""}
          error={errores.coveredArea}
        />
      </Seccion>

      <BotonDeEnvio texto={textoBoton} />
    </form>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-2 text-sm font-medium text-muted-foreground">{titulo}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function CampoAncho({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5 sm:col-span-2">{children}</div>;
}

function Campo({
  etiqueta,
  nombre,
  tipo = "text",
  paso,
  defaultValue,
  error,
  requerido,
}: {
  etiqueta: string;
  nombre: string;
  tipo?: string;
  paso?: string;
  defaultValue?: string | number | null;
  error?: string;
  requerido?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={nombre}>
        {etiqueta}
        {requerido && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={nombre}
        name={nombre}
        type={tipo}
        step={paso}
        defaultValue={defaultValue ?? ""}
        aria-invalid={Boolean(error)}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

function CampoSelect<T extends string>({
  etiqueta,
  nombre,
  defaultValue,
  opciones,
  etiquetas,
  error,
}: {
  etiqueta: string;
  nombre: string;
  defaultValue: T;
  opciones: readonly T[];
  etiquetas: Record<T, string>;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={nombre}>{etiqueta}</Label>
      <select id={nombre} name={nombre} defaultValue={defaultValue} className={ESTILO_SELECT}>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {etiquetas[opcion]}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
