// Real PostgreSQL integration test. Uses a new disposable schema, never existing accounts.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import pg from "pg";
import { getPool } from "../server/database.ts";
import { migrateDatabase } from "../server/migrations.ts";
import { registerApiRoutes } from "../server/routes.ts";
import { verifyPassword } from "../server/security.ts";

if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL para o teste PostgreSQL.");
const originalUrl = new URL(process.env.DATABASE_URL);
const sslMode = originalUrl.searchParams.get("sslmode");
const ssl =
  process.env.DATABASE_SSL === "true" ||
  (process.env.DATABASE_SSL !== "false" &&
    ["require", "verify-full"].includes(sslMode));
const control = new pg.Pool({
  connectionString: originalUrl.toString(),
  ssl: ssl ? { rejectUnauthorized: false } : undefined,
});
const schema = `larume_admin_test_${randomUUID().replaceAll("-", "")}`;
let server;
let created = false;
try {
  await control.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  originalUrl.searchParams.set("options", `-c search_path=${schema}`);
  process.env.DATABASE_URL = originalUrl.toString();
  process.env.COOKIE_SECURE = "false";
  process.env.ADMIN_LOGIN = "gestor-teste";
  process.env.ADMIN_PASSWORD = randomBytes(24).toString("base64url");
  await migrateDatabase();
  // Re-running migrations must preserve the newly added flags.
  await migrateDatabase();
  const app = express();
  app.use(express.json());
  registerApiRoutes(app);
  server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  function agent() {
    let cookie = "";
    return {
      get cookie() {
        return cookie;
      },
      async call(path, method = "GET", body, extraHeaders = {}) {
        const response = await fetch(`${base}/api${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
            ...extraHeaders,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const setCookie = response.headers
          .getSetCookie()
          .find((value) =>
            value.startsWith(
              path.startsWith("/admin")
                ? "larume_admin_session="
                : "enxoval_session=",
            ),
          );
        if (setCookie) cookie = setCookie.split(";")[0];
        return {
          status: response.status,
          data: response.status === 204 ? undefined : await response.json(),
        };
      },
    };
  }
  const admin = agent();
  const customer = agent();
  const outsider = agent();
  const adminPassword = process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_PASSWORD;
  assert.equal(
    (
      await admin.call("/admin/login", "POST", {
        login: "gestor-teste",
        password: adminPassword,
      })
    ).status,
    503,
  );
  process.env.ADMIN_PASSWORD = adminPassword;
  assert.equal(
    (
      await admin.call("/admin/login", "POST", {
        login: "gestor-teste",
        password: "incorreta",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await admin.call("/admin/login", "POST", {
        login: "gestor-teste",
        password: adminPassword,
      })
    ).status,
    200,
  );
  assert.equal((await admin.call("/admin/session")).status, 200);
  const originalPassword = randomBytes(16).toString("base64url");
  const email = "cliente@example.invalid";
  const signup = await customer.call("/auth/register", "POST", {
    name: "Cliente Teste",
    email,
    password: originalPassword,
  });
  assert.equal(signup.status, 201);
  const id = signup.data.user.id;
  const workspace = (
    await customer.call("/enxovais", "POST", {
      name: "Lista preservada",
      useDefaultTemplate: false,
    })
  ).data;
  const item = (
    await customer.call("/items", "POST", {
      name: "Toalha preservada",
      enxovalId: workspace.enxoval.id,
      categoryName: "Banheiro",
    })
  ).data.item;
  assert.ok(item.id);
  assert.equal((await outsider.call("/admin/users")).status, 401);
  assert.equal((await customer.call("/admin/users")).status, 401);
  const listing = await admin.call("/admin/users");
  assert.equal(listing.status, 200);
  assert.equal(listing.data.users.length, 1);
  assert.equal(listing.data.users[0].isActive, true);
  assert.equal(listing.data.users[0].workspaceCount, 1);
  assert.equal(Object.hasOwn(listing.data.users[0], "password_hash"), false);
  assert.equal(
    (await outsider.call(`/admin/users/${id}/reset-password`, "POST")).status,
    401,
  );
  assert.equal(
    (await customer.call(`/admin/users/${id}/reset-password`, "POST")).status,
    401,
  );
  assert.equal(
    (await admin.call("/admin/users/not-an-id/reset-password", "POST")).status,
    404,
  );
  assert.equal(
    (
      await admin.call(
        `/admin/users/${id}/reset-password`,
        "POST",
        {},
        { Origin: "https://other.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await admin.call(
        `/admin/users/${id}/reset-password`,
        "POST",
        {},
        { "Content-Type": "text/plain" },
      )
    ).status,
    415,
  );
  console.log(
    "PASS: gestão restrita ao admin, configuração obrigatória, proteção de origem e listagem sem hashes.",
  );

  const reset = await admin.call(`/admin/users/${id}/reset-password`, "POST");
  assert.equal(reset.status, 200);
  const temp = reset.data.temporaryPassword;
  assert.ok(temp.length >= 16);
  const row = (await getPool().query("SELECT * FROM users WHERE id = $1", [id]))
    .rows[0];
  assert.equal(row.must_change_password, true);
  assert.equal(await verifyPassword(temp, row.password_hash), true);
  assert.equal(JSON.stringify(row).includes(temp), false);
  assert.equal((await customer.call("/bootstrap")).status, 401);
  assert.equal(
    (
      await customer.call("/auth/login", "POST", {
        email,
        password: originalPassword,
      })
    ).status,
    401,
  );
  assert.equal(
    (await customer.call("/auth/login", "POST", { email, password: temp }))
      .status,
    200,
  );
  const restrictedCookie = customer.cookie;
  const restricted = await customer.call("/bootstrap");
  assert.equal(restricted.data.user.mustChangePassword, true);
  assert.deepEqual(restricted.data.items, []);
  assert.deepEqual(restricted.data.enxovais, []);
  assert.equal(
    (await customer.call(`/enxovais/${workspace.enxoval.id}`)).status,
    403,
  );
  assert.equal(
    (await customer.call(`/items?enxovalId=${workspace.enxoval.id}`)).status,
    403,
  );
  assert.equal(
    (await customer.call("/enxovais", "POST", { name: "Acesso indevido" }))
      .status,
    403,
  );
  const newPassword = randomBytes(18).toString("base64url");
  assert.equal(
    (
      await customer.call("/auth/change-password", "POST", {
        password: "curta",
        confirmation: "curta",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await customer.call("/auth/change-password", "POST", {
        password: newPassword,
        confirmation: "diferente",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await customer.call("/auth/change-password", "POST", {
        password: temp,
        confirmation: temp,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await outsider.call("/auth/change-password", "POST", {
        password: newPassword,
        confirmation: newPassword,
      })
    ).status,
    401,
  );
  const change = await customer.call("/auth/change-password", "POST", {
    password: newPassword,
    confirmation: newPassword,
  });
  assert.equal(change.status, 200);
  assert.equal(change.data.user.mustChangePassword, false);
  assert.equal(change.data.items[0].id, item.id);
  const oldSession = await fetch(`${base}/api/bootstrap`, {
    headers: { Cookie: restrictedCookie },
  });
  assert.equal(oldSession.status, 401);
  assert.equal(
    (await customer.call("/auth/login", "POST", { email, password: temp }))
      .status,
    401,
  );
  assert.equal(
    (
      await customer.call("/auth/login", "POST", {
        email,
        password: newPassword,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await customer.call("/auth/change-password", "POST", {
        password: originalPassword,
        confirmation: originalPassword,
      })
    ).status,
    409,
  );
  const changedRow = (
    await getPool().query(
      "SELECT must_change_password, password_reset_expires_at, last_login_at FROM users WHERE id = $1",
      [id],
    )
  ).rows[0];
  assert.equal(changedRow.must_change_password, false);
  assert.equal(changedRow.password_reset_expires_at, null);
  assert.ok(changedRow.last_login_at);
  console.log(
    "PASS: senha temporária, sessões revogadas, troca obrigatória no servidor e listas preservadas.",
  );

  const secondTemp = (
    await admin.call(`/admin/users/${id}/reset-password`, "POST")
  ).data.temporaryPassword;
  const latestTemp = (
    await admin.call(`/admin/users/${id}/reset-password`, "POST")
  ).data.temporaryPassword;
  assert.equal(
    (
      await customer.call("/auth/login", "POST", {
        email,
        password: secondTemp,
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await customer.call("/auth/login", "POST", {
        email,
        password: latestTemp,
      })
    ).status,
    200,
  );
  await getPool().query(
    "UPDATE users SET password_reset_expires_at = now() - interval '1 second' WHERE id = $1",
    [id],
  );
  assert.equal((await customer.call("/bootstrap")).status, 401);
  assert.equal(
    (
      await customer.call("/auth/login", "POST", {
        email,
        password: latestTemp,
      })
    ).status,
    401,
  );
  const activeTemp = (
    await admin.call(`/admin/users/${id}/reset-password`, "POST")
  ).data.temporaryPassword;
  assert.equal(
    (
      await customer.call("/auth/login", "POST", {
        email,
        password: activeTemp,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await admin.call(`/admin/users/${id}/status`, "PATCH", {
        isActive: false,
      })
    ).status,
    204,
  );
  assert.equal((await customer.call("/bootstrap")).status, 401);
  assert.equal(
    (
      await customer.call("/auth/login", "POST", {
        email,
        password: activeTemp,
      })
    ).status,
    403,
  );
  assert.equal(
    (await admin.call(`/admin/users/${id}/reset-password`, "POST")).status,
    409,
  );
  assert.equal(
    (await admin.call("/admin/users")).data.users[0].isActive,
    false,
  );
  assert.equal(
    (await admin.call(`/admin/users/${id}/status`, "PATCH", { isActive: true }))
      .status,
    204,
  );
  assert.equal(
    (
      await customer.call("/auth/login", "POST", {
        email,
        password: activeTemp,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await getPool().query(
        "SELECT COUNT(*)::int AS count FROM items WHERE id = $1",
        [item.id],
      )
    ).rows[0].count,
    1,
  );
  console.log(
    "PASS: regeneração invalida senha anterior, expiração, desativação e reativação sem perda de dados.",
  );

  process.env.ADMIN_PASSWORD = randomBytes(24).toString("base64url");
  assert.equal((await admin.call("/admin/session")).status, 401);
  assert.equal(
    (
      await admin.call("/admin/login", "POST", {
        login: "gestor-teste",
        password: process.env.ADMIN_PASSWORD,
      })
    ).status,
    200,
  );
  assert.equal((await admin.call("/admin/logout", "POST")).status, 204);
  assert.equal((await admin.call("/admin/users")).status, 401);
  let limited = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const result = await admin.call("/admin/login", "POST", {
      login: "gestor-teste",
      password: "incorreta",
    });
    limited ||= result.status === 429;
  }
  assert.equal(limited, true);
  console.log(
    "PASS: rotação de credenciais, logout e limite de tentativas administrativas.",
  );
} finally {
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  await getPool().end();
  if (created) await control.query(`DROP SCHEMA "${schema}" CASCADE`);
  await control.end();
}
