import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";

const configuredStatus = process.env.CLICKER_NATIVE_MODULE_STATUS ?? "";
const servers: ReturnType<typeof createServer>[] = [];

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.close();
  }
});

describe("clicker native module status configuration", () => {
  it("passes the configured status through a lightweight local endpoint", async () => {
    expect(configuredStatus).toBe("not-required");

    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ status: request.headers["x-clicker-status"] ?? null }));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not expose a port");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      headers: { "x-clicker-status": configuredStatus },
    });
    const body = (await response.json()) as { status: string | null };

    expect(response.ok).toBe(true);
    expect(body.status).toBe("not-required");
  });
});
