import type { NextConfig } from "next";

/**
 * Origenes permitidos para Server Actions.
 *
 * Next protege las Server Actions contra CSRF comparando el header `Origin`
 * con el `Host`. Detras de un proxy que reescribe el Host, los dos difieren y
 * el request se rechaza con "Invalid Server Actions request".
 *
 * Es exactamente lo que pasa en Codespaces: el navegador manda
 * `Origin: https://<algo>-3000.app.github.dev` y el reenvio de puertos le
 * entrega a Next `Host: localhost:3000`.
 *
 * Se agrega SOLO en desarrollo. En produccion el Host y el Origin coinciden
 * —tanto en el dominio raiz como en los subdominios de cada tenant— asi que no
 * hace falta, y sumar origenes ahi seria ampliar la superficie de CSRF sin
 * ningun motivo.
 */
function origenesPermitidos(): string[] | undefined {
  if (process.env.NODE_ENV === "production") return undefined;

  const origenes = ["localhost:3000"];

  // Codespaces expone estas dos variables. Se arma el host exacto en vez de
  // usar un comodin sobre todo app.github.dev.
  const codespace = process.env.CODESPACE_NAME;
  const dominioDeReenvio = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

  if (codespace && dominioDeReenvio) {
    origenes.push(`${codespace}-3000.${dominioDeReenvio}`);
  }

  return origenes;
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: origenesPermitidos(),
    },
  },
};

export default nextConfig;
