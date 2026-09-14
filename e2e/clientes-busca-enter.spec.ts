import { test, expect, type Page } from "@playwright/test";

const MOCK_CLIENTES = [
  { id: "c1", nome: "Maria Silva", telefone: "11999990001", atendimentos_count: 2 },
  { id: "c2", nome: "João Souza", telefone: "11999990002", atendimentos_count: 0 },
  { id: "c3", nome: "Ana Lima", telefone: "11999990003", atendimentos_count: 1 },
];

function clientesPayload(
  all: typeof MOCK_CLIENTES,
  q?: string | null,
) {
  const query = (q ?? "").trim().toLowerCase();
  const clientes = query
    ? all.filter((c) => c.nome.toLowerCase().includes(query))
    : all;
  return {
    clientes,
    total: clientes.length,
    hasMore: false,
    duplicatas: [],
    stats: null,
    storage: "google_drive",
  };
}

async function mockClientesApis(
  page: Page,
  calls: { q: string[] },
  allClientes: typeof MOCK_CLIENTES = MOCK_CLIENTES,
) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "turquesa-agenda-cookie-consent",
      JSON.stringify({ version: "2026-08-10", acceptedAt: new Date().toISOString() }),
    );
    window.localStorage.setItem(
      "turquesa-tour-prefs:dev-local@turquesaagenda.local",
      JSON.stringify({ tour_completed_at: new Date().toISOString(), hints_dismissed: [] }),
    );
  });
  await page.route("**/api/perfil/tour**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tour_completed_at: new Date().toISOString(),
        hints_dismissed: [],
      }),
    });
  });
  await page.route("**/api/auth/google-connections**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        connected: true,
        drive: true,
        calendar: true,
        contacts: true,
        needsConnect: false,
        healthy: true,
        driveHealthy: true,
        calendarHealthy: true,
      }),
    });
  });
  await page.route("**/api/config/anamnese", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ campos: [] }),
    });
  });
  await page.route("**/api/config/agenda", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ duracao_padrao_minutos: 60 }),
    });
  });
  await page.route("**/api/perfil", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        full_name: "Dev Local",
        clinic_name: "Salão Dev Local",
        onboarding_completed: true,
      }),
    });
  });
  await page.route("**/api/clientes/sync-formularios", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ sincronizados: 0 }),
    });
  });
  await page.route("**/api/clientes/sync-agendamentos", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/clientes?**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const q = url.searchParams.get("q") ?? "";
    calls.q.push(q);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(clientesPayload(allClientes, q)),
    });
  });
}

test.describe("Busca de clientes só no Enter", () => {
  test.skip(!process.env.PLAYWRIGHT_BYPASS, "Requer servidor com DEV_BYPASS_AUTH");
  test.use({ viewport: { width: 1280, height: 800 } });

  test("digitar não consulta; Enter e Buscar consultam", async ({ page }) => {
    const calls = { q: [] as string[] };
    await mockClientesApis(page, calls);

    await page.goto("/clientes");
    const search = page.getByRole("textbox", { name: /buscar clientes/i });
    await expect(search).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Maria Silva")).toBeVisible();

    const afterLoad = calls.q.length;
    expect(afterLoad).toBeGreaterThan(0);
    expect(calls.q.every((q) => q === "")).toBeTruthy();

    await search.fill("Maria");
    await expect(page.getByText("Pressione Enter ou Buscar para pesquisar.")).toBeVisible();
    await page.waitForTimeout(500);
    expect(calls.q.length).toBe(afterLoad);

    await search.press("Enter");
    await expect(page.getByText("Maria Silva")).toBeVisible();
    await expect(page.getByText("João Souza")).toHaveCount(0);
    expect(calls.q.slice(afterLoad)).toEqual(["Maria"]);

    await search.fill("");
    await expect(page.getByText("João Souza")).toBeVisible();
    expect(calls.q.at(-1)).toBe("");

    await search.fill("Ana");
    await page.getByRole("button", { name: "Buscar" }).first().click();
    await expect(page.getByText("Ana Lima")).toBeVisible();
    await expect(page.getByText("Maria Silva")).toHaveCount(0);
    expect(calls.q.at(-1)).toBe("Ana");
  });

  test("lista de clientes rola com o mouse", async ({ page }) => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i + 1}`,
      nome: `Cliente ${String(i + 1).padStart(2, "0")} Teste`,
      telefone: `1199999${String(i + 1).padStart(4, "0")}`,
      atendimentos_count: 0,
    }));
    const calls = { q: [] as string[] };
    await mockClientesApis(page, calls, many);

    await page.goto("/clientes");
    await expect(page.getByText("Cliente 01 Teste")).toBeVisible({ timeout: 20_000 });

    const scroller = page.locator(".touch-pan-y").first();
    await expect(scroller).toBeVisible();

    const before = await scroller.evaluate((el) => ({
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      bodyOverflow: document.body.style.overflow,
    }));
    expect(before.bodyOverflow).not.toBe("hidden");
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    await scroller.hover();
    await page.mouse.wheel(0, 600);
    await expect
      .poll(async () => scroller.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(before.scrollTop);

    if (process.env.WALKTHROUGH_ARTIFACTS) {
      await page.screenshot({
        path: "/opt/cursor/artifacts/clientes_lista_apos_rolar_mouse.png",
        fullPage: false,
      });
    }
  });
});
