import { describe, expect, it } from "vitest";
import { mariadbConfig } from "./db-config";

describe("mariadbConfig", () => {
  it("local: sin TLS, puerto por defecto y 5 conexiones", () => {
    expect(mariadbConfig("mysql://elbravo:clave@127.0.0.1/elbravo")).toEqual({
      host: "127.0.0.1",
      port: 3306,
      user: "elbravo",
      password: "clave",
      database: "elbravo",
      connectionLimit: 5,
    });
  });

  it("nube: sslaccept=strict activa TLS con verificación; decodifica usuario y clave", () => {
    const c = mariadbConfig("mysql://4abc.root:p%40ss%2Fw0rd@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/elbravo?sslaccept=strict&connection_limit=3");
    expect(c).toMatchObject({
      host: "gateway01.us-east-1.prod.aws.tidbcloud.com",
      port: 4000,
      user: "4abc.root",
      password: "p@ss/w0rd",
      database: "elbravo",
      connectionLimit: 3,
      ssl: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });
  });

  it("otras formas de pedir TLS", () => {
    expect(mariadbConfig("mysql://u:p@h/db?ssl=true").ssl).toBeTruthy();
    expect(mariadbConfig("mysql://u:p@h/db?sslmode=REQUIRED").ssl).toBeTruthy();
    expect(mariadbConfig("mysql://u:p@h/db?sslmode=disabled").ssl).toBeUndefined();
    expect(mariadbConfig("mysql://u:p@h/db?sslaccept=accept_invalid_certs").ssl).toEqual({ rejectUnauthorized: false });
  });

  it("rechaza otros protocolos", () => {
    expect(() => mariadbConfig("postgres://u:p@h/db")).toThrow();
  });
});
