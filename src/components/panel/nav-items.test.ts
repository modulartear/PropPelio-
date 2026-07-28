import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NAV_ITEMS, navParaRol } from "./nav-items.ts";

describe("navParaRol", () => {
  it("un TENANT_USER no ve los items marcados soloAdmin", () => {
    const items = navParaRol("TENANT_USER");
    assert.ok(items.every((i) => !i.soloAdmin));
  });

  it("un TENANT_ADMIN ve todos los items", () => {
    const items = navParaRol("TENANT_ADMIN");
    assert.equal(items.length, NAV_ITEMS.length);
  });

  it("todos los href son relativos al namespace publico, nunca al interno", () => {
    // Un link a /tenants/... duplicaria el prefijo cuando el middleware lo
    // reescribe de nuevo. Ver el comentario en nav-items.ts.
    for (const item of NAV_ITEMS) {
      assert.ok(
        item.href.startsWith("/admin"),
        `${item.href} deberia empezar con /admin, no con el prefijo interno`,
      );
      assert.ok(!item.href.startsWith("/tenants/"), `${item.href} no debe usar el prefijo interno`);
    }
  });
});
