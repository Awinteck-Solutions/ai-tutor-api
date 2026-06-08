import request from "supertest";
import app from "../app";

describe("App HTTP", () => {
  it("GET / returns API info", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe("1.0.0");
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health/");
    expect(res.status).toBe(200);
  });

  it("returns 401 without token on protected route", async () => {
    const res = await request(app).get("/teacher/dashboard");
    expect(res.status).toBe(401);
  });
});
