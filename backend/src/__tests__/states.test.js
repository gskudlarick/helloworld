const request = require("supertest");

jest.mock("../db", () => ({
  query: jest.fn(),
}));

const pool = require("../db");
const app = require("../app");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/states", () => {
  it("returns all states", async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, name: "Alabama", abbreviation: "AL", capital: "Montgomery" },
        { id: 2, name: "Alaska", abbreviation: "AK", capital: "Juneau" },
      ],
    });

    const res = await request(app).get("/api/states");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty("name", "Alabama");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SELECT")
    );
  });

  it("filters states by search query", async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 2, name: "Alaska", abbreviation: "AK", capital: "Juneau" },
      ],
    });

    const res = await request(app).get("/api/states?search=alas");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("ILIKE"),
      ["%alas%"]
    );
  });

  it("returns empty array when no states match", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app).get("/api/states?search=zzz");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    pool.query.mockRejectedValue(new Error("connection refused"));

    const res = await request(app).get("/api/states");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch states");
  });
});

describe("GET /api/states/:id", () => {
  it("returns a single state", async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, name: "Alabama", abbreviation: "AL", capital: "Montgomery" },
      ],
    });

    const res = await request(app).get("/api/states/1");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alabama");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $1"),
      ["1"]
    );
  });

  it("returns 404 for non-existent state", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app).get("/api/states/999");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("State not found");
  });

  it("returns 500 on database error", async () => {
    pool.query.mockRejectedValue(new Error("connection refused"));

    const res = await request(app).get("/api/states/1");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to fetch state");
  });
});
