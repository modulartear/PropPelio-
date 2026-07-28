"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { googleMapsEnv } from "@/lib/env";

type ValoresDeUbicacion = {
  addressStreet?: string | null;
  addressCity?: string | null;
  addressProvince?: string | null;
  addressZip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type CampoDeUbicacion =
  "addressStreet" | "addressCity" | "addressProvince" | "addressZip" | "latitude" | "longitude";

type ErroresDeUbicacion = Partial<Record<CampoDeUbicacion, string>>;

/** Buenos Aires. Centro inicial del mapa mientras no haya ninguna posición. */
const CENTRO_POR_DEFECTO = { lat: -34.6037, lng: -58.3816 };

/**
 * Ubicación de una propiedad: un buscador con autocompletado de Google
 * Places completa la dirección estructurada y las coordenadas; el mapa
 * muestra un pin que además se puede arrastrar a mano para corregirlo.
 *
 * El input de búsqueda NO tiene `name`: es solo una entrada de UI. Al elegir
 * una sugerencia completa los inputs reales (calle/ciudad/provincia/CP, con
 * su propio `name`, editables a mano si el autocompletado se equivoca) y dos
 * inputs ocultos de lat/lng — esos sí viajan en el FormData de la Server
 * Action, junto con el resto del formulario de la propiedad.
 *
 * Carga la Maps JavaScript API con `next/script` en vez de un paquete de
 * npm: es la única forma soportada de usar Places Autocomplete y el mapa
 * interactivo del lado del cliente, y evita sumar una dependencia para lo
 * que en el fondo es cargar un `<script>`.
 */
export function LocationField({
  valoresIniciales,
  errores,
}: {
  valoresIniciales?: ValoresDeUbicacion;
  errores?: ErroresDeUbicacion;
}) {
  const [scriptCargado, setScriptCargado] = useState(false);
  const [posicion, setPosicion] = useState<{ lat: number; lng: number } | null>(
    valoresIniciales?.latitude != null && valoresIniciales?.longitude != null
      ? { lat: valoresIniciales.latitude, lng: valoresIniciales.longitude }
      : null,
  );

  const busquedaRef = useRef<HTMLInputElement>(null);
  const calleRef = useRef<HTMLInputElement>(null);
  const ciudadRef = useRef<HTMLInputElement>(null);
  const provinciaRef = useRef<HTMLInputElement>(null);
  const cpRef = useRef<HTMLInputElement>(null);

  const mapaDivRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<google.maps.Map | null>(null);
  const marcadorRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { GOOGLE_MAPS_API_KEY } = googleMapsEnv();

  // Autocomplete: se conecta al input de busqueda una sola vez, apenas el
  // script terminó de cargar.
  useEffect(() => {
    if (!scriptCargado || !busquedaRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(busquedaRef.current, {
      fields: ["address_components", "geometry"],
    });
    autocompleteRef.current = autocomplete;

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const componentes = place.address_components ?? [];
      const obtener = (tipo: string) =>
        componentes.find((c) => c.types.includes(tipo))?.long_name ?? "";

      const calle = [obtener("route"), obtener("street_number")].filter(Boolean).join(" ");
      const ciudad =
        obtener("locality") || obtener("sublocality") || obtener("administrative_area_level_2");
      const provincia = obtener("administrative_area_level_1");
      const cp = obtener("postal_code");

      if (calleRef.current) calleRef.current.value = calle;
      if (ciudadRef.current) ciudadRef.current.value = ciudad;
      if (provinciaRef.current) provinciaRef.current.value = provincia;
      if (cpRef.current) cpRef.current.value = cp;

      const ubicacion = place.geometry?.location;
      if (ubicacion) {
        setPosicion({ lat: ubicacion.lat(), lng: ubicacion.lng() });
      }
    });

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [scriptCargado]);

  // El mapa tambien se crea una sola vez. La posicion inicial (si hay) se
  // toma del estado, no se vuelve a leer despues: los efectos de abajo son
  // los que lo mantienen sincronizado con el pin.
  useEffect(() => {
    if (!scriptCargado || !mapaDivRef.current || mapaRef.current) return;

    const centro = posicion ?? CENTRO_POR_DEFECTO;
    const mapa = new google.maps.Map(mapaDivRef.current, {
      center: centro,
      zoom: posicion ? 16 : 4,
      streetViewControl: false,
      mapTypeControl: false,
    });
    const marcador = new google.maps.Marker({
      position: centro,
      map: mapa,
      draggable: true,
      visible: Boolean(posicion),
    });
    marcador.addListener("dragend", () => {
      const pos = marcador.getPosition();
      if (pos) setPosicion({ lat: pos.lat(), lng: pos.lng() });
    });

    mapaRef.current = mapa;
    marcadorRef.current = marcador;
    // Solo depende de si el script cargo: la posicion inicial ya quedo
    // capturada arriba, y las actualizaciones posteriores las maneja el
    // efecto siguiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptCargado]);

  // Cada vez que la posicion cambia (autocompletado o arrastre del pin),
  // sincroniza el mapa y el marcador con el nuevo valor.
  useEffect(() => {
    if (!mapaRef.current || !marcadorRef.current || !posicion) return;
    mapaRef.current.setCenter(posicion);
    mapaRef.current.setZoom(16);
    marcadorRef.current.setPosition(posicion);
    marcadorRef.current.setVisible(true);
  }, [posicion]);

  return (
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="afterInteractive"
        onLoad={() => setScriptCargado(true)}
      />

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="ubicacion-busqueda">Buscar dirección</Label>
        <Input
          id="ubicacion-busqueda"
          ref={busquedaRef}
          placeholder="Empezá a escribir una dirección…"
          autoComplete="off"
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="addressStreet">
          Calle y altura<span className="text-destructive"> *</span>
        </Label>
        <Input
          id="addressStreet"
          name="addressStreet"
          ref={calleRef}
          defaultValue={valoresIniciales?.addressStreet ?? ""}
          aria-invalid={Boolean(errores?.addressStreet)}
        />
        {errores?.addressStreet && (
          <span className="text-xs text-destructive">{errores.addressStreet}</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="addressCity">
          Ciudad<span className="text-destructive"> *</span>
        </Label>
        <Input
          id="addressCity"
          name="addressCity"
          ref={ciudadRef}
          defaultValue={valoresIniciales?.addressCity ?? ""}
          aria-invalid={Boolean(errores?.addressCity)}
        />
        {errores?.addressCity && (
          <span className="text-xs text-destructive">{errores.addressCity}</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="addressProvince">
          Provincia<span className="text-destructive"> *</span>
        </Label>
        <Input
          id="addressProvince"
          name="addressProvince"
          ref={provinciaRef}
          defaultValue={valoresIniciales?.addressProvince ?? ""}
          aria-invalid={Boolean(errores?.addressProvince)}
        />
        {errores?.addressProvince && (
          <span className="text-xs text-destructive">{errores.addressProvince}</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="addressZip">Código postal</Label>
        <Input
          id="addressZip"
          name="addressZip"
          ref={cpRef}
          defaultValue={valoresIniciales?.addressZip ?? ""}
          aria-invalid={Boolean(errores?.addressZip)}
        />
        {errores?.addressZip && (
          <span className="text-xs text-destructive">{errores.addressZip}</span>
        )}
      </div>

      <input type="hidden" name="latitude" value={posicion?.lat ?? ""} readOnly />
      <input type="hidden" name="longitude" value={posicion?.lng ?? ""} readOnly />

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Ubicación en el mapa</Label>
        <div ref={mapaDivRef} className="h-64 w-full rounded-md border" />
        <p className="text-xs text-muted-foreground">
          Se completa sola al elegir una dirección de la lista. Se puede arrastrar el pin para
          ajustarla.
        </p>
        {(errores?.latitude || errores?.longitude) && (
          <span className="text-xs text-destructive">Ubicación inválida.</span>
        )}
      </div>
    </>
  );
}
