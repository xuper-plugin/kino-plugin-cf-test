// CF Test — exercises the Cloudflare bypass on a device.
//
// browser.page is only allowed from a content function (PAGE_FUNCTIONS: resolve, search, ...), never from
// screen/screenEvent. So the test runs inside resolve(): the screen takes a URL, "Probar" does go.play(ref=url),
// Kino calls resolve(url), which:
//   A) kino.browser.page(url)  -> the hidden WebView clears Cloudflare; we report status, size, whether the page
//      is still a CF challenge, and which cf_/__cf cookies it earned (the cf_clearance bridge, Change C + userAgent).
//   B) kino.plugins.call("resolver","resolve",{url})  -> the resolver DOOR (doorResolve gate) when url is a hoster.
// The combined result is shown via a thrown error's userMessage (resolve returns a stream on success, so we throw to
// surface text). Watch logcat (KinoBrowser) to see "kino.browser.page: ..." fire.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CF_RE = /Just a moment|cf-chl|challenge-platform|cf_clearance|Checking your browser|__cf_chl/i;

// Required alongside the "resolve" capability. Not used (the screen drives go.play directly).
export async function search(query) {
  return [];
}

export async function resolve(ref) {
  const url = String(ref == null ? "" : ref).trim();
  if (!/^https?:\/\//i.test(url)) throw kino.error("bad_request", "no url", { userMessage: "URL http(s) inválida" });

  let a;
  try {
    const p = await kino.browser.page(url, { timeoutMs: 22000, userAgent: UA });
    const html = (p && p.html) || "";
    const challenge = CF_RE.test(html);
    const names = p && p.cookies ? Object.keys(p.cookies) : [];
    const cf = names.filter((k) => k.startsWith("cf_") || k.startsWith("__cf"));
    a = `A) page: status ${p && p.status}, ${html.length}ch, CF ${challenge ? "NO limpió ✗" : "limpió ✓"}, cf:[${cf.join(",") || "ninguna"}]`;
  } catch (e) {
    a = "A) page ERROR: " + ((e && e.code) || (e && e.message) || "?");
  }

  let b;
  try {
    const r = await kino.plugins.call("resolver", "resolve", { url });
    const s = r && Array.isArray(r.streams) ? r.streams : [];
    b = s.length ? `B) door: ${s.length} stream(s) ✓ ${String(s[0].url).slice(0, 60)}` : `B) door: ${(r && r.error) || "?"}`;
  } catch (e) {
    b = "B) door throw: " + ((e && e.code) || (e && e.message) || "?");
  }

  throw kino.error("not_found", "cf-test-result", { userMessage: a + "  |  " + b });
}

function view(state) {
  const s = state || {};
  const url = typeof s.url === "string" ? s.url : "";
  const children = [
    { type: "Text", text: "Prueba de Cloudflare", textEn: "Cloudflare test", style: "h3" },
    { type: "Text", text: "Escribe una URL tras Cloudflare y pulsa Cargar, luego Probar. El resultado sale como mensaje.", textEn: "Enter a Cloudflare URL, press Load, then Run. The result shows as a message.", color: "secondary" },
    { type: "Form", key: "f", onSubmitted: "set", gap: 12, children: [
      { type: "TextField", key: "url", labelText: "URL", labelTextEn: "URL", value: url, maxLength: 2000 },
      { type: "ElevatedButton", labelText: "Cargar", labelTextEn: "Load", submit: true },
    ] },
  ];
  if (/^https?:\/\//i.test(url)) {
    children.push({ type: "Card", key: "go", children: [
      { type: "Text", text: "Listo: " + url, color: "secondary" },
      { type: "ElevatedButton", key: "run", labelText: "Probar (reproducir)", labelTextEn: "Run (play)", onPressed: { go: { play: { ref: url, kind: "movie", id: "cf-test", title: "CF Test" } } } },
    ] });
  }
  return { type: "Scaffold", key: "app", body: { type: "SingleChildScrollView", key: "p", children: [{ type: "Column", padding: 24, gap: 16, crossAxisAlignment: "stretch", children }] } };
}

export function screen(ctx) {
  return view((ctx && ctx.state) || {});
}

export async function screenEvent(ctx) {
  const { name, value } = ctx || {};
  if (name === "set") {
    const url = (value && typeof value.url === "string" ? value.url : "").trim();
    return { state: { url } };
  }
  return null;
}
