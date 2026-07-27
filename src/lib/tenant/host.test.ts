import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { busquedaDeTenant, esCampoDeBusqueda, normalizarHost, resolverHost } from "./host.ts";

/**
 * Tests de la resolucion de host.
 *
 * De esta funcion sale a que inmobiliaria pertenece cada request. Un error de
 * clasificacion significa servirle a un cliente el contenido de otro.
 */

const DEV = "localhost:3000";
const PROD = "proppelio.com";

describe("normalizarHost", () => {
  it("pasa a minusculas", () => {
    assert.equal(normalizarHost("TENANT-A.Localhost:3000"), "tenant-a.localhost:3000");
  });

  it("saca el www.", () => {
    assert.equal(normalizarHost("www.proppelio.com"), "proppelio.com");
  });

  it("saca espacios sobrantes", () => {
    assert.equal(normalizarHost("  proppelio.com  "), "proppelio.com");
  });

  it("conserva el puerto", () => {
    // En desarrollo el puerto es parte de la identidad del host.
    assert.equal(normalizarHost("localhost:3000"), "localhost:3000");
  });
});

describe("resolverHost", () => {
  describe("dominio raiz", () => {
    it("reconoce la raiz en produccion", () => {
      assert.deepEqual(resolverHost("proppelio.com", PROD), { tipo: "raiz" });
    });

    it("reconoce la raiz con www", () => {
      assert.deepEqual(resolverHost("www.proppelio.com", PROD), { tipo: "raiz" });
    });

    it("reconoce la raiz en desarrollo", () => {
      assert.deepEqual(resolverHost("localhost:3000", DEV), { tipo: "raiz" });
    });
  });

  describe("subdominios", () => {
    it("extrae el subdominio en desarrollo", () => {
      assert.deepEqual(resolverHost("tenant-a.localhost:3000", DEV), {
        tipo: "subdominio",
        subdominio: "tenant-a",
      });
    });

    it("extrae el subdominio en produccion", () => {
      assert.deepEqual(resolverHost("inmobiliaria-lopez.proppelio.com", PROD), {
        tipo: "subdominio",
        subdominio: "inmobiliaria-lopez",
      });
    });

    it("es indiferente a mayusculas", () => {
      assert.deepEqual(resolverHost("Tenant-A.LOCALHOST:3000", DEV), {
        tipo: "subdominio",
        subdominio: "tenant-a",
      });
    });

    it("rechaza subdominios anidados", () => {
      // `a.b.proppelio.com` no puede ser un tenant: son de un solo nivel.
      const r = resolverHost("a.b.proppelio.com", PROD);
      assert.equal(r.tipo, "invalido");
    });

    it("rechaza subdominios reservados", () => {
      for (const s of ["api", "admin", "app", "auth"]) {
        const r = resolverHost(`${s}.proppelio.com`, PROD);
        assert.equal(r.tipo, "invalido", `${s} deberia estar reservado`);
      }
    });

    it("www no se confunde con un tenant llamado www", () => {
      // normalizarHost saca el www., asi que cae en la raiz.
      assert.deepEqual(resolverHost("www.proppelio.com", PROD), { tipo: "raiz" });
    });
  });

  describe("dominios propios", () => {
    it("clasifica un dominio ajeno como custom", () => {
      assert.deepEqual(resolverHost("inmobiliariax.com.ar", PROD), {
        tipo: "dominio-custom",
        dominio: "inmobiliariax.com.ar",
      });
    });

    it("saca el www de un dominio custom", () => {
      assert.deepEqual(resolverHost("www.inmobiliariax.com.ar", PROD), {
        tipo: "dominio-custom",
        dominio: "inmobiliariax.com.ar",
      });
    });

    it("un dominio que solo TERMINA parecido no es subdominio", () => {
      // "noesproppelio.com" no es subdominio de "proppelio.com": el chequeo
      // exige el punto separador, no un simple endsWith.
      assert.deepEqual(resolverHost("noesproppelio.com", PROD), {
        tipo: "dominio-custom",
        dominio: "noesproppelio.com",
      });
    });
  });

  describe("entradas invalidas", () => {
    it("host ausente", () => {
      assert.equal(resolverHost(null, PROD).tipo, "invalido");
      assert.equal(resolverHost(undefined, PROD).tipo, "invalido");
      assert.equal(resolverHost("", PROD).tipo, "invalido");
    });
  });
});

describe("busquedaDeTenant", () => {
  it("un subdominio se busca por el campo subdomain", () => {
    assert.deepEqual(busquedaDeTenant({ tipo: "subdominio", subdominio: "tenant-a" }), {
      por: "subdomain",
      valor: "tenant-a",
    });
  });

  it("un dominio propio se busca por el campo customDomain", () => {
    assert.deepEqual(busquedaDeTenant({ tipo: "dominio-custom", dominio: "inmobiliariax.com" }), {
      por: "customDomain",
      valor: "inmobiliariax.com",
    });
  });

  it("la raiz y lo invalido no generan busqueda", () => {
    assert.equal(busquedaDeTenant({ tipo: "raiz" }), null);
    assert.equal(busquedaDeTenant({ tipo: "invalido", motivo: "x" }), null);
  });

  it("encadena con resolverHost", () => {
    const r = resolverHost("tenant-b.localhost:3000", DEV);
    assert.deepEqual(busquedaDeTenant(r), { por: "subdomain", valor: "tenant-b" });
  });
});

describe("esCampoDeBusqueda", () => {
  it("acepta solo los dos campos validos", () => {
    assert.equal(esCampoDeBusqueda("subdomain"), true);
    assert.equal(esCampoDeBusqueda("customDomain"), true);
  });

  it("rechaza cualquier otra cosa que llegue por la URL", () => {
    // El segmento viene de una URL reescrita: si alguien la pide a mano con
    // otro valor, no puede convertirse en un campo de busqueda arbitrario.
    for (const v of ["id", "name", "", "__proto__", "tenantId"]) {
      assert.equal(esCampoDeBusqueda(v), false, `${v} no deberia ser valido`);
    }
  });
});
