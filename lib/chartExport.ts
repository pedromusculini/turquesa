/** Exportação de gráficos Recharts como PNG e impressão (sem dependências extras). */

export function periodSuffixForFilename(
  startDate?: string,
  endDate?: string,
): string {
  if (startDate && endDate) return `${startDate}_a_${endDate}`;
  if (startDate) return `desde-${startDate}`;
  if (endDate) return `ate-${endDate}`;
  return new Date().toISOString().slice(0, 10);
}

export async function downloadChartCardPng(
  cardEl: HTMLElement,
  filename: string,
): Promise<void> {
  const svg =
    cardEl.querySelector("svg.recharts-surface") ??
    cardEl.querySelector(".recharts-wrapper svg") ??
    cardEl.querySelector("svg");
  if (!svg) {
    throw new Error("Gráfico não encontrado para exportação.");
  }

  const scale = 2;
  const padding = 24;
  const titleEl = cardEl.querySelector<HTMLElement>("[data-chart-title]");
  const subtitleEl = cardEl.querySelector<HTMLElement>("[data-chart-subtitle]");
  const chartWrap =
    cardEl.querySelector<HTMLElement>("[data-chart-body]") ?? svg.parentElement;

  const chartRect = (chartWrap ?? svg).getBoundingClientRect();
  const cardWidth = Math.max(cardEl.offsetWidth, chartRect.width + padding * 2);
  const titleHeight = subtitleEl?.textContent ? 56 : 36;
  const chartHeight = chartRect.height || 288;
  const totalHeight = padding + titleHeight + chartHeight + padding;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cardWidth * scale);
  canvas.height = Math.round(totalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a imagem.");

  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cardWidth, totalHeight);

  if (titleEl?.textContent) {
    ctx.fillStyle = "#2d652d";
    ctx.font = "600 14px system-ui, -apple-system, sans-serif";
    ctx.fillText(titleEl.textContent, padding, padding + 16);
  }
  if (subtitleEl?.textContent) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px system-ui, -apple-system, sans-serif";
    ctx.fillText(subtitleEl.textContent, padding, padding + 40);
  }

  const svgClone = svg.cloneNode(true) as SVGElement;
  svgClone.setAttribute("width", String(chartRect.width));
  svgClone.setAttribute("height", String(chartHeight));
  const svgData = new XMLSerializer().serializeToString(svgClone);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        padding,
        padding + titleHeight,
        chartRect.width,
        chartHeight,
      );
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Falha ao gerar PNG."));
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename.endsWith(".png") ? filename : `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("Falha ao renderizar o gráfico."));
    img.src = svgUrl;
  });
}

export function printChartCard(cardEl: HTMLElement): void {
  const clone = cardEl.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(".financeiro-chart-actions, .financeiro-graficos-toolbar")
    .forEach((el) => el.remove());

  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) {
    window.print();
    return;
  }

  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Gráfico financeiro</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #0f172a; }
    .chart-card { border: 1px solid #e2e8f0; border-radius: 24px; padding: 24px; max-width: 900px; }
    .chart-title { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.18em; color: #2d652d; }
    .chart-subtitle { margin-top: 4px; font-size: 14px; color: #64748b; }
    .chart-body { margin-top: 24px; height: 288px; }
    svg { width: 100%; height: 100%; }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`);
  win.document.close();
  win.focus();
  win.onload = () => {
    win.print();
    win.close();
  };
}

export function printAllCharts(sectionEl: HTMLElement): void {
  sectionEl.setAttribute("data-print-all", "true");
  window.print();
  sectionEl.removeAttribute("data-print-all");
}
