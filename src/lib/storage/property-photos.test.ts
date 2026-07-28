import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hayLugarParaOtraFoto,
  MAX_BYTES_POR_FOTO,
  MAX_FOTOS_POR_PROPIEDAD,
  pathDeFoto,
  urlPublicaDeFoto,
  validarArchivo,
} from "./property-photos.ts";

describe("validarArchivo", () => {
  it("acepta jpg, png y webp dentro del limite", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      assert.equal(validarArchivo({ type, size: 1024 }), null);
    }
  });

  it("rechaza formatos no soportados", () => {
    assert.ok(validarArchivo({ type: "application/pdf", size: 1024 }));
    assert.ok(validarArchivo({ type: "image/gif", size: 1024 }));
    assert.ok(validarArchivo({ type: "image/svg+xml", size: 1024 }));
  });

  it("rechaza archivos mas grandes que el limite", () => {
    assert.ok(validarArchivo({ type: "image/jpeg", size: MAX_BYTES_POR_FOTO + 1 }));
  });

  it("acepta exactamente el limite", () => {
    assert.equal(validarArchivo({ type: "image/jpeg", size: MAX_BYTES_POR_FOTO }), null);
  });

  it("rechaza archivos vacios", () => {
    assert.ok(validarArchivo({ type: "image/jpeg", size: 0 }));
  });
});

describe("hayLugarParaOtraFoto", () => {
  it("permite hasta el limite", () => {
    assert.equal(hayLugarParaOtraFoto(0), true);
    assert.equal(hayLugarParaOtraFoto(MAX_FOTOS_POR_PROPIEDAD - 1), true);
  });

  it("bloquea en el limite y mas alla", () => {
    assert.equal(hayLugarParaOtraFoto(MAX_FOTOS_POR_PROPIEDAD), false);
    assert.equal(hayLugarParaOtraFoto(MAX_FOTOS_POR_PROPIEDAD + 1), false);
  });
});

describe("pathDeFoto", () => {
  it("arma <tenant>/<propiedad>/<id>.<ext> segun el mime", () => {
    const path = pathDeFoto("t1", "p1", "image/png");
    assert.match(path, /^t1\/p1\/[0-9a-f-]+\.png$/);
  });

  it("usa la extension correcta para cada mime soportado", () => {
    assert.match(pathDeFoto("t", "p", "image/jpeg"), /\.jpg$/);
    assert.match(pathDeFoto("t", "p", "image/webp"), /\.webp$/);
  });

  it("nunca usa un nombre de archivo provisto por el usuario", () => {
    // No hay parametro de nombre de archivo en la firma: es la garantia en si
    // misma. Este test documenta la intencion por si alguien lo agrega despues.
    assert.equal(pathDeFoto.length, 3);
  });

  it("rechaza un mime no soportado en vez de generar un path invalido", () => {
    assert.throws(() => pathDeFoto("t", "p", "application/pdf"));
  });

  it("dos llamadas seguidas no colisionan", () => {
    const a = pathDeFoto("t", "p", "image/png");
    const b = pathDeFoto("t", "p", "image/png");
    assert.notEqual(a, b);
  });
});

describe("urlPublicaDeFoto", () => {
  it("arma la URL publica del bucket", () => {
    const url = urlPublicaDeFoto("https://xyz.supabase.co", "t1/p1/abc.jpg");
    assert.equal(
      url,
      "https://xyz.supabase.co/storage/v1/object/public/property-photos/t1/p1/abc.jpg",
    );
  });
});
