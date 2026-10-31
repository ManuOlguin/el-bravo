import { describe, expect, it } from "vitest";
import { isAuthorizedCron } from "./cron-auth";
import { isKnownPushEndpoint } from "@/src/server/notifications/push-endpoints";

describe("isAuthorizedCron", () => {
  it("solo con el Bearer exacto y con CRON_SECRET definido", () => {
    expect(isAuthorizedCron("Bearer s3cr3t", "s3cr3t")).toBe(true);
    expect(isAuthorizedCron("Bearer otro", "s3cr3t")).toBe(false);
    expect(isAuthorizedCron("s3cr3t", "s3cr3t")).toBe(false);
    expect(isAuthorizedCron(null, "s3cr3t")).toBe(false);
    expect(isAuthorizedCron("Bearer ", "")).toBe(false);
    expect(isAuthorizedCron("Bearer undefined", undefined)).toBe(false);
  });
});

describe("isKnownPushEndpoint", () => {
  it("acepta los servicios de push de los navegadores", () => {
    expect(isKnownPushEndpoint("https://fcm.googleapis.com/fcm/send/abc:def")).toBe(true);
    expect(isKnownPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/gAAA")).toBe(true);
    expect(isKnownPushEndpoint("https://web.push.apple.com/QH8x")).toBe(true);
    expect(isKnownPushEndpoint("https://wns2-bl2p.notify.windows.com/w/?token=x")).toBe(true);
  });
  it("rechaza hosts internos o parecidos (SSRF)", () => {
    expect(isKnownPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isKnownPushEndpoint("https://localhost/x")).toBe(false);
    expect(isKnownPushEndpoint("http://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isKnownPushEndpoint("https://fcm.googleapis.com.evil.test/x")).toBe(false);
    expect(isKnownPushEndpoint("https://evilfcm.googleapis.com.test/x")).toBe(false);
    expect(isKnownPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isKnownPushEndpoint("no es una url")).toBe(false);
  });
});
