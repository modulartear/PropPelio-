import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizarSubdominio, validarSubdominio } from "./subdominio.ts";

/**
 * Un subdominio invalido no es un problema estetico: pasa a ser parte de una
 * URL publica y de un certificado SSL, y no se puede cambiar sin romper los
 * links que la inmobiliaria ya repartio.
 */

describe("normalizarSubdominio", () => {
  it("pasa a minusculas", () => {
    assert.equal(normalizarSubdominio("InmobiliariaLopez"), "inmobiliarialopez");
  });

  it("saca acentos, que en DNS no existen", () => {
    assert.equal(normalizarSubdominio("Inmobiliaria López"), "inmobiliaria-lopez");
    assert.equal(normalizarSubdominio("Piñeyro"), "pineyro");
  });

  it("convierte separadores en guiones", () => {
    assert.equal(normalizarSubdominio("del sur propiedades"), "del-sur-propiedades");
    assert.equal(normalizarSubdominio("del_sur.propiedades"), "del-sur-propiedades");
  });

  it("colapsa guiones repetidos", () => {
    assert.equal(normalizarSubdominio("del---sur"), "del-sur");
    assert.equal(normalizarSubdominio("del   sur"), "del-sur");
  });

  it("saca guiones de los extremos", () => {
    assert.equal(normalizarSubdominio("-lopez-"), "lopez");
    assert.equal(normalizarSubdominio("  lopez  "), "lopez");
  });

  it("descarta simbolos", () => {
    assert.equal(normalizarSubdominio("López & Cía. S.A."), "lopez-cia-s-a");
  });

  it("es idempotente", () => {
    // Se aplica en cada tecla mientras el usuario escribe: aplicarla dos veces
    // tiene que dar lo mismo que una.
    const una = normalizarSubdominio("Inmobiliaria López & Cía.");
    assert.equal(normalizarSubdominio(una), una);
  });
});

describe("validarSubdominio", () => {
  it("acepta uno valido", () => {
    assert.equal(validarSubdominio("inmobiliaria-lopez"), null);
    assert.equal(validarSubdominio("lopez123"), null);
  });

  it("rechaza el vacio", () => {
    assert.ok(validarSubdominio(""));
  });

  it("rechaza los demasiado cortos", () => {
    assert.ok(validarSubdominio("ab"));
    assert.equal(validarSubdominio("abc"), null);
  });

  it("rechaza los que exceden el limite de una etiqueta DNS", () => {
    assert.equal(validarSubdominio("a".repeat(63)), null);
    assert.ok(validarSubdominio("a".repeat(64)));
  });

  it("rechaza guiones en los extremos", () => {
    // `-lopez.dominio.com` no es un host valido.
    assert.ok(validarSubdominio("-lopez"));
    assert.ok(validarSubdominio("lopez-"));
  });

  it("rechaza caracteres que no van en un host", () => {
    for (const v of ["lopez cia", "lópez", "lopez_cia", "lopez.cia", "lopez/admin"]) {
      assert.ok(validarSubdominio(v), `${v} deberia rechazarse`);
    }
  });

  it("rechaza los reservados por la plataforma", () => {
    for (const v of ["www", "api", "admin", "app", "auth"]) {
      assert.ok(validarSubdominio(v), `${v} deberia estar reservado`);
    }
  });

  it("el motivo es un mensaje para mostrarle al usuario", () => {
    // Devuelve el motivo y no un booleano: poder decir QUE esta mal es la
    // diferencia entre un formulario usable y uno que solo dice que no.
    const motivo = validarSubdominio("ab");
    assert.equal(typeof motivo, "string");
    assert.ok(motivo!.length > 0);
  });
});
