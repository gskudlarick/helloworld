const request = require("supertest");
const app = require("../app");

describe("GET /api/hello", () => {
  it("returns default greeting", async () => {
    const res = await request(app).get("/api/hello");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Hello, World!");
    expect(res.body.id).toBeGreaterThan(0);
  });

  it("returns personalized greeting", async () => {
    const res = await request(app).get("/api/hello?name=React");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Hello, React!");
  });

  it("increments counter on each call", async () => {
    const res1 = await request(app).get("/api/hello");
    const res2 = await request(app).get("/api/hello");
    expect(res2.body.id).toBeGreaterThan(res1.body.id);
  });

  it("handles special characters in name", async () => {
    const res = await request(app).get("/api/hello?name=O'Brien");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Hello, O'Brien!");
  });
});

describe("GET /api/greetings", () => {
  it("returns list of greetings", async () => {
    const res = await request(app).get("/api/greetings");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
  });

  it("contains expected languages", async () => {
    const res = await request(app).get("/api/greetings");
    const messages = res.body.map((g) => g.message);
    expect(messages).toContain("Hello, World!");
    expect(messages).toContain("Hola, Mundo!");
    expect(messages).toContain("Bonjour, le Monde!");
  });

  it("each greeting has id and message", async () => {
    const res = await request(app).get("/api/greetings");
    res.body.forEach((greeting) => {
      expect(greeting).toHaveProperty("id");
      expect(greeting).toHaveProperty("message");
    });
  });
});

describe("GET /api/health", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
  });
});

describe("Security headers", () => {
  it("includes helmet security headers", async () => {
    const res = await request(app).get("/api/hello");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("404 handling", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/unknown");
    expect(res.status).toBe(404);
  });
});
