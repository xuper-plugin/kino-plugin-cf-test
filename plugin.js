// CF Test — a throwaway plugin to exercise the Cloudflare bypass on a device.
//
// One screen: paste a Cloudflare-protected URL (a hoster embed works best), press "Probar".
//   A) kino.browser.page(url) directly  -> tests the hidden WebView clearing CF, the cf_clearance
//      cookie bridge, and the userAgent pinning (this plugin declares "browser": "pages").
//   B) kino.plugins.call("resolver","resolve",{url})  -> tests the resolver DOOR path: the broker's
//      doorResolve gate letting the resolver open browser.page as a door provider during a user press.
//
// Watch logcat (KinoBrowser) while pressing: "kino.browser.page: ..." from the resolver proves the gate.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CF_RE = /Just a moment|cf-chl|challenge-platform|cf_clearance|Checking your browser|__cf_chl/i;

function render(state) {
  const s = state || {};
  const r = s.result || null;
  const children = [
    { type: "Text", text: "Prueba de Cloudflare", textEn: "Cloudflare test", style: "h3" },
    { type: "Text", text: "Pega una URL tras Cloudflare (idealmente un embed de un hoster que el resolver conozca). Pruebo browser.page directo y la door del resolver.", textEn: "Paste a Cloudflare-protected URL. I test browser.page directly and the resolver door.", color: "secondary" },
    { type: "Form", key: "f", onSubmitted: "run", gap: 12, children: [
      { type: "TextField", key: "url", labelText: "URL", labelTextEn: "URL", value: s.url || "", maxLength: 2000 },
      { type: "ElevatedButton", labelText: "Probar", labelTextEn: "Run", submit: true },
    ] },
  ];
  if (r) {
    children.push({ type: "Card", key: "res", children: [
      { type: "Text", text: "A) kino.browser.page (directo)", textEn: "A) kino.browser.page (direct)", style: "h4" },
      { type: "Text", text: r.page || "-", color: "secondary" },
      { type: "Text", text: "B) resolver door", style: "h4" },
      { type: "Text", text: r.door || "-", color: "secondary" },
    ] });
  }
  return { type: "Scaffold", key: "app", body: { type: "SingleChildScrollView", key: "p", children: [{ type: "Column", padding: 24, gap: 16, crossAxisAlignment: "stretch", children }] } };
}

export function screen(ctx) {
  return render((ctx && ctx.state) || {});
}

export async function screenEvent(ctx) {
  const { name, value } = ctx || {};
  if (name !== "run") return null;
  const url = (value && typeof value.url === "string" ? value.url : "").trim();
  if (!/^https?:\/\//i.test(url)) return { state: { url, result: { page: "URL http(s) inválida", door: "-" } } };

  // A) browser.page directly (this plugin's own screen is user-initiated, so this is always allowed).
  let page;
  try {
    const p = await kino.browser.page(url, { timeoutMs: 20000, userAgent: UA });
    const html = (p && p.html) || "";
    const challenge = CF_RE.test(html);
    const names = p && p.cookies ? Object.keys(p.cookies) : [];
    const cf = names.filter((k) => k.startsWith("cf_") || k.startsWith("__cf"));
    page = `status ${p && p.status} · ${html.length} chars · CF ${challenge ? "NO limpió ✗" : "limpió ✓"} · cookies:[${cf.join(", ") || "ninguna cf_"}]`;
  } catch (e) {
    page = "error: " + ((e && e.code) || (e && e.message) || "?");
  }

  // B) resolver door (tests the doorResolve gate; the resolver opens browser.page as a door provider).
  let door;
  try {
    const res = await kino.plugins.call("resolver", "resolve", { url });
    const streams = res && Array.isArray(res.streams) ? res.streams : [];
    door = streams.length ? `${streams.length} stream(s) ✓ · ${String(streams[0].url).slice(0, 70)}` : `sin streams · error: ${(res && res.error) || "?"}`;
  } catch (e) {
    door = "throw: " + ((e && e.code) || (e && e.message) || "?");
  }

  return { state: { url, result: { page, door } } };
}
