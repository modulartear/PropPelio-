import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validarPropiedad } from "./validacion.ts";

function formularioValido(overrides: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    title: "Casa en el centro",
    propertyType: "HOUSE",
    operationType: "SALE",
    addressStreet: "San Martín 123",
    addressCity: "Córdoba",
    addressProvince: "Córdoba",
    ...overrides,
  };

  const fd = new FormData();
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe("validarPropiedad", () => {
  it("acepta el minimo de campos requeridos", () => {
    const r = validarPropiedad(formularioValido());
    assert.ok("valores" in r, JSON.stringify(r));
    if ("valores" in r) {
      assert.equal(r.valores.title, "Casa en el centro");
      assert.equal(r.valores.status, "AVAILABLE"); // default
      assert.equal(r.valores.currency, "ARS"); // default
      assert.equal(r.valores.price, null);
      assert.equal(r.valores.bedrooms, null);
    }
  });

  it("rechaza sin titulo", () => {
    const r = validarPropiedad(formularioValido({ title: "" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.title);
  });

  it("rechaza un tipo de propiedad invalido", () => {
    const r = validarPropiedad(formularioValido({ propertyType: "CASTILLO" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.propertyType);
  });

  it("rechaza una operacion invalida", () => {
    const r = validarPropiedad(formularioValido({ operationType: "TRUEQUE" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.operationType);
  });

  it("rechaza direccion incompleta", () => {
    for (const campo of ["addressStreet", "addressCity", "addressProvince"]) {
      const r = validarPropiedad(formularioValido({ [campo]: "" }));
      assert.ok("errores" in r, `${campo} vacio deberia fallar`);
    }
  });

  it("acepta un precio numerico y lo convierte", () => {
    const r = validarPropiedad(formularioValido({ price: "150000.50" }));
    assert.ok("valores" in r);
    if ("valores" in r) assert.equal(r.valores.price, 150000.5);
  });

  it("rechaza un precio no numerico", () => {
    const r = validarPropiedad(formularioValido({ price: "gratis" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.price);
  });

  it("rechaza un precio negativo", () => {
    const r = validarPropiedad(formularioValido({ price: "-100" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.price);
  });

  it("un precio vacio es valido (null), no un error", () => {
    const r = validarPropiedad(formularioValido({ price: "" }));
    assert.ok("valores" in r);
    if ("valores" in r) assert.equal(r.valores.price, null);
  });

  it("rechaza dormitorios no enteros", () => {
    const r = validarPropiedad(formularioValido({ bedrooms: "2.5" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.bedrooms);
  });

  it("rechaza dormitorios negativos", () => {
    const r = validarPropiedad(formularioValido({ bedrooms: "-1" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.bedrooms);
  });

  it("acepta superficies con decimales", () => {
    const r = validarPropiedad(formularioValido({ totalArea: "120.5", coveredArea: "95.25" }));
    assert.ok("valores" in r);
    if ("valores" in r) {
      assert.equal(r.valores.totalArea, 120.5);
      assert.equal(r.valores.coveredArea, 95.25);
    }
  });

  it("respeta un status y una moneda explicitos", () => {
    const r = validarPropiedad(formularioValido({ status: "RESERVED", currency: "USD" }));
    assert.ok("valores" in r);
    if ("valores" in r) {
      assert.equal(r.valores.status, "RESERVED");
      assert.equal(r.valores.currency, "USD");
    }
  });

  it("acumula todos los errores de un formulario, no solo el primero", () => {
    const r = validarPropiedad(formularioValido({ title: "", addressCity: "", price: "abc" }));
    assert.ok("errores" in r);
    if ("errores" in r) {
      assert.ok(r.errores.title);
      assert.ok(r.errores.addressCity);
      assert.ok(r.errores.price);
    }
  });

  it("recorta espacios de los campos de texto", () => {
    const r = validarPropiedad(formularioValido({ title: "  Casa linda  " }));
    assert.ok("valores" in r);
    if ("valores" in r) assert.equal(r.valores.title, "Casa linda");
  });

  it("un campo de texto opcional vacio queda en null, no en string vacio", () => {
    const r = validarPropiedad(formularioValido({ description: "" }));
    assert.ok("valores" in r);
    if ("valores" in r) assert.equal(r.valores.description, null);
  });

  it("acepta latitud y longitud negativas (a diferencia de dormitorios, aca es valido)", () => {
    const r = validarPropiedad(formularioValido({ latitude: "-34.6037", longitude: "-58.3816" }));
    assert.ok("valores" in r, JSON.stringify(r));
    if ("valores" in r) {
      assert.equal(r.valores.latitude, -34.6037);
      assert.equal(r.valores.longitude, -58.3816);
    }
  });

  it("lat/lng vacios son validos (null): la ubicacion en el mapa es opcional", () => {
    const r = validarPropiedad(formularioValido());
    assert.ok("valores" in r);
    if ("valores" in r) {
      assert.equal(r.valores.latitude, null);
      assert.equal(r.valores.longitude, null);
    }
  });

  it("rechaza latitud fuera de rango", () => {
    const r = validarPropiedad(formularioValido({ latitude: "200" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.latitude);
  });

  it("rechaza longitud fuera de rango", () => {
    const r = validarPropiedad(formularioValido({ longitude: "-200" }));
    assert.ok("errores" in r);
    if ("errores" in r) assert.ok(r.errores.longitude);
  });
});
