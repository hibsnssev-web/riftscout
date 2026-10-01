/* Rift Scout public site: champion strengths and weaknesses, abilities, lore and items.
   Routes are plain hash tokens: #champions, #items, #premium, #legal, #<championId> */
(function () {
  "use strict";

  // Who runs the site, shown on the Legal page. With a postal address (one array entry per
  // line) the page shows a full legal notice; without one it shows a contact section.
  const OPERATOR = { name: "Rift Scout", address: [], email: "hi.bsnssev@gmail.com" };
  // false leaves out everything about the planned paid tier: the nav link, the teaser,
  // the note on champion pages and the Premium page itself.
  const PREMIUM_PAGE = false;
  const LEGAL_TITLE = OPERATOR.address.length ? "Legal notice and privacy" : "Contact and privacy";

  const champs = window.RS_PUBLIC || [];
  const byId = {};
  champs.forEach(c => { byId[c.id] = c; });
  const app = document.getElementById("app");
  const ROLES = { top: "Top", jng: "Jungle", mid: "Mid", bot: "Bot", sup: "Support" };
  const GROUPS = { controller: "Controller", fighter: "Fighter", mage: "Mage", marksman: "Marksman", slayer: "Slayer", tank: "Tank", specialist: "Specialist" };
  const MATCHUPS = (champs.length * (champs.length - 1)).toLocaleString("en-US");

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const fmt = n => n.toLocaleString("en-US");
  const norm = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
  const nameIndex = {};
  champs.forEach(c => { nameIndex[norm(c.name)] = c; nameIndex[c.id] = c; });
  const findChamp = s => nameIndex[norm(s)] || null;
  const roleText = c => c.roles.map(r => ROLES[r]).join(" · ");
  const list = (items, cls) => `<ul class="list ${cls || ""}">${items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`;

  // Icons are Riot Data Dragon squares saved in assets/img/<id>.png; initials show if one fails to load.
  const portrait = (c, size) => `<span class="pt pt-${size} g-${c.group}" aria-hidden="true">${esc(c.initials)}<img src="assets/img/${c.id}.png" alt="" loading="lazy" decoding="async"></span>`;
  document.addEventListener("error", e => {
    const box = e.target.tagName === "IMG" && e.target.parentElement;
    if (box && (box.classList.contains("pt") || box.classList.contains("ic"))) e.target.remove();
  }, true);

  /* ---------- Riot's official data (Data Dragon): lore, abilities, items ----------
     Loaded live in the visitor's browser, so it always matches the current patch. */
  const DD = "https://ddragon.leagueoflegends.com";
  const LANGS = { en_US: "English", de_DE: "Deutsch", hu_HU: "Magyar" };
  const riot = { version: null, lang: "en_US", champ: {}, items: {} };
  try { const saved = localStorage.getItem("rs-lang"); if (LANGS[saved]) riot.lang = saved; } catch (e) { /* storage unavailable */ }
  function setLang(lang) {
    riot.lang = lang;
    try { localStorage.setItem("rs-lang", lang); } catch (e) { /* storage unavailable */ }
  }
  async function getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  }
  async function ddVersion() {
    if (!riot.version) riot.version = (await getJson(DD + "/api/versions.json"))[0];
    return riot.version;
  }
  async function ddChampion(c, lang) {
    const v = await ddVersion(), k = lang + ":" + c.key;
    if (!riot.champ[k]) riot.champ[k] = Object.values((await getJson(`${DD}/cdn/${v}/data/${lang}/champion/${c.key}.json`)).data)[0];
    return riot.champ[k];
  }
  async function ddItems(lang) {
    const v = await ddVersion();
    if (!riot.items[lang]) riot.items[lang] = shopItems((await getJson(`${DD}/cdn/${v}/data/${lang}/item.json`)).data);
    return riot.items[lang];
  }
  // Riot's descriptions carry their own markup; keep the line breaks and drop the tags.
  function riotText(html) {
    const doc = new DOMParser().parseFromString(String(html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/?li>/gi, "\n"), "text/html");
    return doc.body.textContent.replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  }
  const multiline = s => esc(s).replace(/\n/g, "<br>");
  // The normal Summoner's Rift shop: ids of 100000 and up are copies for other game modes.
  function shopItems(data) {
    const seen = new Set(), out = [];
    const real = id => +id < 100000 && data[id];
    Object.keys(data).forEach(id => {
      const it = data[id];
      if (+id >= 100000 || !it.maps || !it.maps["11"] || !it.gold || !it.gold.purchasable || it.inStore === false || it.requiredChampion || it.requiredAlly) return;
      if (seen.has(it.name)) return;
      seen.add(it.name);
      const tags = it.tags || [];
      const upgrades = (it.into || []).some(t => real(t) && data[t].gold.purchasable);
      const fromBoots = (it.from || []).some(f => real(f) && (data[f].tags || []).includes("Boots"));
      let cat = "starter";
      if (tags.includes("Boots") || fromBoots) cat = "boots";
      else if (!upgrades && it.gold.total >= 1400) cat = "completed";
      else if (upgrades && !["Consumable", "Trinket", "Jungle", "GoldPer"].some(t => tags.includes(t))) cat = "component";
      out.push({
        id, name: it.name, gold: it.gold.total, plain: it.plaintext || "", text: riotText(it.description), cat, icon: it.image.full,
        from: [...new Set((it.from || []).filter(real).map(x => data[x].name))],
        into: [...new Set((it.into || []).filter(real).map(x => data[x].name))]
      });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }
  const langToggle = () => `<span class="lang" role="group" aria-label="Language of Riot's text">${Object.keys(LANGS).map(l => `<button type="button" class="chip-btn" data-lang="${l}" aria-pressed="${riot.lang === l}">${LANGS[l]}</button>`).join("")}</span>`;
  function wireLang(scope, reload) {
    app.querySelectorAll(`${scope} [data-lang]`).forEach(btn => btn.addEventListener("click", () => {
      setLang(btn.dataset.lang);
      app.querySelectorAll(`${scope} [data-lang]`).forEach(x => x.setAttribute("aria-pressed", String(x.dataset.lang === riot.lang)));
      reload();
    }));
  }

  function setNav(key, title) {
    document.querySelectorAll(".nav a").forEach(a => {
      if (a.dataset.nav === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.title = title ? `${title} · Rift Scout` : "Rift Scout";
  }

  function chrome() {
    const header = document.createElement("header");
    header.className = "topbar";
    header.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="#champions"><span class="rift-mark" aria-hidden="true"></span>Rift Scout</a>
        <nav class="nav" aria-label="Sections">
          <a href="#champions" data-nav="champions">Champions</a>
          <a href="#items" data-nav="items">Items</a>
          ${PREMIUM_PAGE ? `<a href="#premium" data-nav="premium">Premium</a>` : ""}
        </nav>
        <form class="search" id="gsearch" role="search">
          <input type="search" id="gq" list="champ-names" placeholder="Find a champion" aria-label="Find a champion" autocomplete="off">
          <button type="submit">Go</button>
        </form>
      </div>`;
    document.body.insertBefore(header, app);
    const dl = document.createElement("datalist");
    dl.id = "champ-names";
    dl.innerHTML = champs.map(c => `<option value="${esc(c.name)}"></option>`).join("");
    document.body.appendChild(dl);
    const footer = document.createElement("footer");
    footer.innerHTML = `
      <p>Lore, ability and item text and their icons are loaded from Riot Games' Data Dragon. Strengths and weaknesses are Rift Scout's own notes.</p>
      <p>Rift Scout isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      <p><a href="#legal">${LEGAL_TITLE}</a></p>`;
    document.body.appendChild(footer);
    const form = header.querySelector("#gsearch");
    const input = header.querySelector("#gq");
    input.addEventListener("input", () => input.setCustomValidity(""));
    form.addEventListener("submit", e => {
      e.preventDefault();
      const c = findChamp(input.value);
      if (!c) { input.setCustomValidity("No champion by that name. Pick one from the list."); input.reportValidity(); return; }
      input.value = "";
      location.hash = c.id;
    });
  }

  /* ---------- Champions ---------- */
  const filt = { role: "all", group: "all", q: "" };

  function viewChampions() {
    setNav("champions");
    app.innerHTML = `
      <section class="intro">
        <div>
          <p class="eyebrow">League of Legends · free champion guide</p>
          <h1>Know the champion before you queue.</h1>
          <p class="lede">Strengths, weaknesses, abilities and lore for all ${champs.length} champions, and every item in the shop. Free to read, no account needed.</p>
        </div>
        ${PREMIUM_PAGE ? `<div class="panel teaser">
          <span><span class="status">In development</span></span>
          <h3>Rift Scout Premium</h3>
          <p class="muted">A plan for each of the ${MATCHUPS} matchups, and a desktop tracker that helps in champion select, during the game and after it.</p>
          <p><a class="btn" href="#premium">See what is planned</a></p>
        </div>` : `<div class="counts">
          <div><b>${champs.length}</b><span>Champions</span></div>
          <div><b>${Object.keys(ROLES).length}</b><span>Roles</span></div>
          <div><b>${Object.keys(LANGS).length}</b><span>Languages</span></div>
        </div>`}
      </section>
      <section class="section">
        <div class="section-head"><h2>Champions</h2><span class="muted num" id="count"></span></div>
        <div class="filters" id="filters">
          ${["all", ...Object.keys(ROLES)].map(r => `<button type="button" class="chip-btn" data-role="${r}" aria-pressed="${filt.role === r}">${r === "all" ? "All roles" : ROLES[r]}</button>`).join("")}
          <span class="spacer"></span>
          <input type="search" id="fq" placeholder="Filter by name" aria-label="Filter champions by name" value="${esc(filt.q)}">
        </div>
        <div class="filters">
          ${["all", ...Object.keys(GROUPS)].map(g => `<button type="button" class="chip-btn" data-group="${g}" aria-pressed="${filt.group === g}">${g === "all" ? "All classes" : GROUPS[g]}</button>`).join("")}
        </div>
        <div class="champ-grid" id="grid"></div>
      </section>`;
    const sync = () => {
      app.querySelectorAll("[data-role]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.role === filt.role)));
      app.querySelectorAll("[data-group]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.group === filt.group)));
    };
    app.querySelectorAll("[data-role]").forEach(b => b.addEventListener("click", () => { filt.role = b.dataset.role; sync(); renderGrid(); }));
    app.querySelectorAll("[data-group]").forEach(b => b.addEventListener("click", () => { filt.group = b.dataset.group; sync(); renderGrid(); }));
    app.querySelector("#fq").addEventListener("input", e => { filt.q = e.target.value; renderGrid(); });
    renderGrid();
  }
  function renderGrid() {
    const q = norm(filt.q);
    const shown = champs.filter(c =>
      (filt.role === "all" || c.roles.includes(filt.role)) &&
      (filt.group === "all" || c.group === filt.group) &&
      (!q || norm(c.name).includes(q)));
    app.querySelector("#count").textContent = `${shown.length} of ${champs.length}`;
    app.querySelector("#grid").innerHTML = shown.length
      ? shown.map(c => `<a class="tile" href="#${c.id}">${portrait(c, "s")}<span><b>${esc(c.name)}</b><small>${esc(c.cls)} · ${esc(roleText(c))}</small></span></a>`).join("")
      : `<p class="muted">No champion matches those filters.</p>`;
  }

  /* ---------- Champion page ---------- */
  function viewChampion(id) {
    const c = byId[id];
    setNav("champions", c.name);
    app.innerHTML = `
      <section class="champ-head">
        ${portrait(c, "l")}
        <div>
          <p class="eyebrow">${esc(c.cls)}</p>
          <h1>${esc(c.name)}</h1>
          <p class="title-line" id="riot-title"></p>
          <div class="tags">
            ${c.roles.map(r => `<span class="tag">${ROLES[r]}</span>`).join("")}
            <span class="tag">${esc(c.dmg)} damage</span>
            <span class="tag">${c.melee ? "Melee" : "Ranged"}</span>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Strengths and weaknesses</h2>
        <div class="grid-2">
          <div class="panel box-go"><div class="box-title"><h3>Strengths</h3></div>${list(c.st, "good")}</div>
          <div class="panel box-no"><div class="box-title"><h3>Weaknesses</h3></div>${list(c.wk, "bad")}</div>
        </div>
      </section>

      <section class="section" id="riot">
        <div class="section-head"><h2>Lore and abilities</h2>${langToggle()}</div>
        <div id="riot-body" class="section"><p class="muted">Loading Riot's champion data…</p></div>
      </section>

      ${PREMIUM_PAGE ? `<section class="section">
        <p class="locked"><b>More for ${esc(c.name)} in Rift Scout Premium (in development):</b> a plan against each of the other ${champs.length - 1} champions, risk limits, situational decisions and builds. <a href="#premium">See what is planned</a></p>
      </section>` : ""}`;
    wireLang("#riot", () => loadRiotChampion(c));
    loadRiotChampion(c);
  }

  // Fills the champion page's title, lore and abilities from Riot's data once it arrives.
  let riotToken = 0;
  async function loadRiotChampion(c) {
    const token = ++riotToken;
    const body = app.querySelector("#riot-body");
    if (!body) return;
    const stale = () => token !== riotToken || !app.contains(body);
    try {
      const d = await ddChampion(c, riot.lang), v = riot.version;
      if (stale()) return;
      const title = app.querySelector("#riot-title");
      if (title) title.textContent = d.title;
      const ability = (key, name, text, icon, meta) => `
        <div class="ability">
          <span class="ic"><img src="${icon}" alt="" loading="lazy"></span>
          <div>
            <h3><span class="key">${key}</span>${esc(name)}</h3>
            <p>${multiline(riotText(text))}</p>
            ${meta.length ? `<p class="meta num">${meta.map(esc).join(" · ")}</p>` : ""}
          </div>
        </div>`;
      const spellMeta = s => {
        const m = [];
        if (s.cooldownBurn && s.cooldownBurn !== "0") m.push(`Cooldown ${s.cooldownBurn} s`);
        if (s.costBurn && s.costBurn !== "0") m.push(`Cost ${s.costBurn}`);
        if (/^[\d/]+$/.test(s.rangeBurn || "") && Math.max(...s.rangeBurn.split("/").map(Number)) < 5000 && s.rangeBurn !== "0") m.push(`Range ${s.rangeBurn}`);
        return m;
      };
      body.innerHTML = `
        <div class="panel lore"><p>${esc(d.lore)}</p></div>
        <div class="panel abilities">
          ${ability("P", d.passive.name, d.passive.description, `${DD}/cdn/${v}/img/passive/${d.passive.image.full}`, [])}
          ${d.spells.map((s, i) => ability("QWER"[i] || "", s.name, s.description, `${DD}/cdn/${v}/img/spell/${s.image.full}`, spellMeta(s))).join("")}
        </div>`;
    } catch (e) {
      if (stale()) return;
      body.innerHTML = `<p class="muted">Riot's champion data couldn't be loaded right now. The rest of this page doesn't depend on it.</p>`;
    }
  }

  /* ---------- Items ---------- */
  const ICATS = { all: "All items", completed: "Completed items", boots: "Boots", component: "Components", starter: "Starter and consumables" };
  const ICAT_TAG = { completed: "Completed", boots: "Boots", component: "Component", starter: "Starter" };
  const ifilt = { cat: "all", q: "" };
  let itemsToken = 0;
  function viewItems() {
    setNav("items", "Items");
    app.innerHTML = `
      <section class="section">
        <p class="eyebrow">From Riot's official data · current patch</p>
        <h1>Items</h1>
        <p class="muted" style="max-width:65ch">Every item in the Summoner's Rift shop with its cost, stats and effects.</p>
      </section>
      <section class="section">
        <div class="filters" id="icats">
          ${Object.keys(ICATS).map(k => `<button type="button" class="chip-btn" data-icat="${k}" aria-pressed="${ifilt.cat === k}">${ICATS[k]}</button>`).join("")}
          <span class="spacer"></span>
          ${langToggle()}
        </div>
        <div class="filters">
          <input type="search" id="iq" placeholder="Search items" aria-label="Search items" value="${esc(ifilt.q)}">
          <span class="muted num" id="icount"></span>
        </div>
        <div class="item-grid" id="igrid"><p class="muted">Loading Riot's item data…</p></div>
      </section>`;
    const grid = app.querySelector("#igrid"), input = app.querySelector("#iq");
    const token = ++itemsToken;
    const stale = () => token !== itemsToken || !app.contains(grid);
    const draw = items => {
      const q = ifilt.q.trim().toLowerCase();
      const shown = items.filter(i => (ifilt.cat === "all" || i.cat === ifilt.cat) && (!q || i.name.toLowerCase().includes(q)));
      app.querySelector("#icount").textContent = `${shown.length} of ${items.length}`;
      grid.innerHTML = shown.map(i => `
        <article class="panel item-card">
          <div class="item-head">
            <span class="ic"><img src="${DD}/cdn/${riot.version}/img/item/${i.icon}" alt="" loading="lazy"></span>
            <div><h3>${esc(i.name)}</h3><span class="num gold">${fmt(i.gold)} gold</span> <span class="tag">${ICAT_TAG[i.cat]}</span></div>
          </div>
          ${i.plain ? `<p class="muted">${esc(i.plain)}</p>` : ""}
          ${i.text ? `<p class="item-text">${multiline(i.text)}</p>` : ""}
          ${i.from.length ? `<p class="note">Builds from: ${i.from.map(esc).join(", ")}</p>` : ""}
          ${i.into.length ? `<p class="note">Builds into: ${i.into.map(esc).join(", ")}</p>` : ""}
        </article>`).join("") || `<p class="muted">No item matches that search.</p>`;
    };
    const load = async () => {
      try {
        const items = await ddItems(riot.lang);
        if (stale()) return;
        draw(items);
        input.oninput = () => { ifilt.q = input.value; draw(items); };
        app.querySelectorAll("[data-icat]").forEach(b => { b.onclick = () => {
          ifilt.cat = b.dataset.icat;
          app.querySelectorAll("[data-icat]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.icat === ifilt.cat)));
          draw(items);
        }; });
      } catch (e) {
        if (stale()) return;
        grid.innerHTML = `<p class="muted">Riot's item data couldn't be loaded right now. Try again in a moment.</p>`;
      }
    };
    wireLang("#icats", () => {
      ifilt.q = ""; input.value = "";
      grid.innerHTML = `<p class="muted">Loading Riot's item data…</p>`;
      load();
    });
    load();
  }

  /* ---------- Premium (what is planned) ---------- */
  function viewPremium() {
    setNav("premium", "Premium");
    app.innerHTML = `
      <section class="section">
        <p class="eyebrow">Rift Scout Premium</p>
        <h1>A coach for the matchup, built on rules you can read.</h1>
        <p class="lede" style="max-width:68ch">Premium is in development. It is not available and not for sale yet. This page describes what it will be.</p>
        <p><span class="status">In development</span></p>
      </section>

      <section class="section">
        <h2>What stays free</h2>
        <div class="panel"><p>Everything on this site today: strengths, weaknesses, abilities and lore for all ${champs.length} champions, and every item in the shop. No account needed.</p></div>
      </section>

      <section class="section">
        <h2>What premium will add</h2>
        <div class="grid-2">
          <div class="panel feature">
            <h3>A plan for every matchup</h3>
            <p class="muted">${champs.length} champions against each other: ${MATCHUPS} matchups.</p>
            <ul>
              <li>Who is favored, and why, for the early, mid and late game.</li>
              <li>Risks worth taking and mistakes to avoid against that opponent.</li>
              <li>Build changes for that opponent.</li>
            </ul>
          </div>
          <div class="panel feature">
            <h3>Champion select assistant</h3>
            <p class="muted">Part of the desktop app for Windows.</p>
            <ul>
              <li>Your matchups against the enemy champions you can see.</li>
              <li>Your usual build at a glance.</li>
              <li>It reads champions and positions only. It never looks up other players, and it never picks or bans for you.</li>
            </ul>
          </div>
          <div class="panel feature">
            <h3>Match review</h3>
            <p class="muted">After the game.</p>
            <ul>
              <li>Grades for laning, fighting, macro, vision, farming and build.</li>
              <li>Findings with timestamps, split into micro and macro.</li>
              <li>Every death with what was happening around it.</li>
            </ul>
          </div>
          <div class="panel feature">
            <h3>In-game tips card</h3>
            <p class="muted">A small card during your own game.</p>
            <ul>
              <li>One reminder for the current situation.</li>
              <li>The next item of your build, and an alternative.</li>
              <li>It uses only what the game already shows you. It does not track enemy cooldowns or anything hidden.</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>How it works</h2>
        <div class="panel">
          <p>Matchup verdicts, grades and tips come from Rift Scout's own rule-based model of champion profiles. They are not win-rate statistics, and they are estimates meant to help you learn.</p>
          <p style="margin-top:10px">Premium will open only after Riot Games has reviewed the product under its developer policies.</p>
        </div>
      </section>`;
  }

  /* ---------- Legal ---------- */
  function viewLegal() {
    setNav("", LEGAL_TITLE);
    app.innerHTML = `
      <section class="section legal">
        <h1>${LEGAL_TITLE}</h1>

        ${OPERATOR.address.length ? `<h2>Legal notice (Impressum)</h2>
        <address>${esc(OPERATOR.name)}<br>${OPERATOR.address.map(esc).join("<br>")}</address>` : `<h2>Contact</h2>
        <p>${esc(OPERATOR.name)} is a fan project about League of Legends.</p>`}
        <p>Email: <a href="mailto:${esc(OPERATOR.email)}">${esc(OPERATOR.email)}</a></p>

        <h2>Privacy</h2>
        <p>This site has no accounts, no forms, no advertising, no analytics and no cookies. ${esc(OPERATOR.name)} is responsible for it and can be reached at the email address above.</p>
        <p><b>Hosting.</b> The site is hosted on GitHub Pages (GitHub, Inc., USA). When you open a page, GitHub's servers receive your IP address and the technical details your browser sends, and keep them in server logs for security. GitHub handles that under its own privacy statement.</p>
        <p><b>Game data from Riot Games.</b> Champion lore, abilities, items and their icons are loaded directly from Riot Games' Data Dragon servers when you open a champion or the item list. Your browser contacts Riot's servers to get them, so Riot receives your IP address as well.</p>
        <p><b>Storage in your browser.</b> The site remembers the language you chose for Riot's texts in your browser's local storage. It stays on your device and is not sent to anyone.</p>
        <p><b>Your rights.</b> Under the GDPR you can ask what data is held about you, have it corrected or deleted, and complain to a data protection authority. This site itself stores no personal data about visitors. For questions, write to the email address above.</p>

        <h2>Riot Games</h2>
        <p>Rift Scout isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      </section>`;
  }

  /* ---------- Router ---------- */
  let lastView = "";
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#/, "")).toLowerCase();
    let view = h;
    if (h === "items") viewItems();
    else if (h === "premium" && PREMIUM_PAGE) viewPremium();
    else if (h === "legal") viewLegal();
    else if (byId[h]) viewChampion(h);
    else { view = "champions"; viewChampions(); }
    if (view !== lastView) window.scrollTo(0, 0);
    lastView = view;
  }

  chrome();
  window.addEventListener("hashchange", route);
  route();
})();
