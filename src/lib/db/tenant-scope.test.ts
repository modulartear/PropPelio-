import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aplicarScopeDeTenant, delegadoDe } from "./tenant-scope.ts";

/**
 * Tests del scoping por tenant.
 *
 * Este es el punto del sistema donde un bug significa que una inmobiliaria ve
 * los datos de otra. Por eso la logica se aislo en una funcion pura: para
 * poder verificarla sin base de datos y en milisegundos.
 *
 * Corren con el runner nativo de Node (`node --test`), sin dependencias extra.
 */

const T = "tenant_abc";

describe("aplicarScopeDeTenant", () => {
  describe("lecturas", () => {
    it("agrega tenantId conservando el where existente", () => {
      const r = aplicarScopeDeTenant("User", "findMany", { where: { role: "TENANT_USER" } }, T);
      assert.deepEqual(r.args.where, { role: "TENANT_USER", tenantId: T });
    });

    it("crea el where cuando el query no traia ninguno", () => {
      const r = aplicarScopeDeTenant("User", "findMany", undefined, T);
      assert.deepEqual(r.args.where, { tenantId: T });
    });

    for (const op of ["count", "aggregate", "groupBy", "findFirst"]) {
      it(`filtra ${op}`, () => {
        const r = aplicarScopeDeTenant("User", op, {}, T);
        assert.equal(r.args.where?.tenantId, T);
      });
    }
  });

  describe("findUnique", () => {
    // El `where` de findUnique solo acepta campos unicos, asi que no se le
    // puede agregar tenantId. Se reescribe a findFirst, que devuelve lo mismo
    // cuando el where original ya era unico.
    it("se reescribe a findFirst", () => {
      const r = aplicarScopeDeTenant("User", "findUnique", { where: { id: "u1" } }, T);
      assert.equal(r.operacion, "findFirst");
      assert.deepEqual(r.args.where, { id: "u1", tenantId: T });
    });

    it("findUniqueOrThrow se reescribe a findFirstOrThrow", () => {
      const r = aplicarScopeDeTenant("User", "findUniqueOrThrow", { where: { id: "u1" } }, T);
      assert.equal(r.operacion, "findFirstOrThrow");
      assert.equal(r.args.where?.tenantId, T);
    });
  });

  describe("escrituras", () => {
    it("create inyecta tenantId en data", () => {
      const r = aplicarScopeDeTenant("User", "create", { data: { email: "a@b.c" } }, T);
      assert.deepEqual(r.args.data, { email: "a@b.c", tenantId: T });
    });

    it("createMany inyecta tenantId en cada fila", () => {
      const r = aplicarScopeDeTenant(
        "User",
        "createMany",
        { data: [{ email: "a@b.c" }, { email: "d@e.f" }] },
        T,
      );
      assert.deepEqual(r.args.data, [
        { email: "a@b.c", tenantId: T },
        { email: "d@e.f", tenantId: T },
      ]);
    });

    it("update no puede alcanzar filas de otro tenant", () => {
      const r = aplicarScopeDeTenant("User", "update", { where: { id: "u1" }, data: {} }, T);
      assert.equal(r.args.where?.tenantId, T);
    });

    it("delete no puede alcanzar filas de otro tenant", () => {
      const r = aplicarScopeDeTenant("User", "delete", { where: { id: "u1" } }, T);
      assert.equal(r.args.where?.tenantId, T);
    });

    it("deleteMany sin where no borra la tabla entera", () => {
      const r = aplicarScopeDeTenant("User", "deleteMany", {}, T);
      assert.deepEqual(r.args.where, { tenantId: T });
    });

    it("upsert filtra e inyecta tambien en create", () => {
      const r = aplicarScopeDeTenant(
        "TenantModule",
        "upsert",
        { where: { id: "m1" }, create: { module: "LEADS" }, update: {} },
        T,
      );
      assert.equal(r.args.where?.tenantId, T);
      assert.equal(r.args.create?.tenantId, T);
    });
  });

  describe("garantias de aislamiento", () => {
    it("un tenantId pasado a mano no puede sobrescribir el del scope", () => {
      // Si esto fallara, bastaria con que un parametro de la URL llegara al
      // where para leer los datos de cualquier otra inmobiliaria.
      const r = aplicarScopeDeTenant("User", "findMany", { where: { tenantId: "OTRO" } }, T);
      assert.equal(r.args.where?.tenantId, T);
    });

    it("un modelo nuevo se filtra por defecto, sin tocar este archivo", () => {
      // La lista es de exclusiones: agregar `Property` al schema no requiere
      // acordarse de nada para que quede protegido.
      const r = aplicarScopeDeTenant("Property", "findMany", {}, T);
      assert.equal(r.args.where?.tenantId, T);
    });

    it("Tenant queda excluido porque se identifica por id", () => {
      const r = aplicarScopeDeTenant("Tenant", "findMany", { where: { subdomain: "x" } }, T);
      assert.equal(r.sinCambios, true);
      assert.equal(r.args.where?.tenantId, undefined);
    });

    it("no muta los argumentos del llamador", () => {
      const original = { where: { role: "X" } };
      aplicarScopeDeTenant("User", "findMany", original, T);
      assert.deepEqual(original, { where: { role: "X" } });
    });
  });
});

describe("delegadoDe", () => {
  it("convierte el nombre del modelo al del delegado de Prisma", () => {
    assert.equal(delegadoDe("User"), "user");
    assert.equal(delegadoDe("TenantModule"), "tenantModule");
  });
});
