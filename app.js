// Agent Builder front end. Tries the local server (/api/generate); if there is none
// (static hosting like GitHub Pages), runs the same heuristic engine in the browser.
(function(){
const D = window.ENGINE_DATA, $ = id => document.getElementById(id);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function find(desc, re){ const m = desc.match(re); return m ? m[1].trim().replace(/^[ .,;]+|[ .,;]+$/g, "") : null; }

function extract(desc){
  const d = desc.toLowerCase(), tools = [];
  for (const [k, v] of Object.entries(D.TOOLS)) if (new RegExp("\\b" + esc(k)).test(d) && !tools.includes(v)) tools.push(v);
  const tones = D.TONES.filter(t => new RegExp("\\b" + t).test(d));
  let aud = find(desc, /\baudience(?: is|:)\s*([^.;\n]{3,60})/i) || find(desc, /\bfor ((?:an? |the |my |our )?[^.,;\n]{3,60})/i) || "the user";
  aud = aud.replace(/^(my|our)\s/i, "your ").replace(/\s+(using|with|that|who|in|on)\b.*$/i, "");
  let best = 0, bi = -1;
  D.DOMAINS.forEach((dm, i) => { const s = dm.kw.filter(k => d.includes(k)).length; if (s > best) { best = s; bi = i; } });
  const dom = bi >= 0 ? D.DOMAINS[bi] : {label: D.GENERIC.label, tasks: D.GENERIC.tasks, guards: D.GENERIC.guards, starters: null};
  return {job: desc.trim().split("\n")[0].slice(0, 160), tools, tones: tones.length ? tones : ["clear", "friendly"],
          audience: aud, domain: dom.label, tasks: dom.tasks, guards: dom.guards, starters: dom.starters};
}

function heuristic(desc){
  const x = extract(desc);
  let name = x.domain.split(" & ")[0].split(/[^A-Za-z0-9]+/).filter(Boolean).map(cap).join("");
  name = (name.endsWith("Agent") ? name.slice(0, -5) : name) + "Agent";
  const toolsTxt = x.tools.length ? x.tools.join(", ") : "whatever the user pastes into the chat (no live integrations assumed)";
  const system = `# Role
You are ${name}, a dedicated ${x.domain} agent serving ${x.audience}.
Mission (from the brief): ${x.job}

# What you do
${x.tasks.map(t => "- " + cap(t) + ".").join("\n")}

# Tools & inputs
You work with: ${toolsTxt}.
If you don't have access to a tool, ask the user to paste the content instead of pretending.

# Tone
Be ${x.tones.slice(0, 3).join(" and ")}. Write the way ${x.audience} would want to read it: short paragraphs, bullets for lists, no filler.

# Rules
${x.guards.map(g => "- " + g).join("\n")}
- Ask at most 2 clarifying questions, only when the answer would change your output.
- End every response with a one-line "Next step:" suggestion.

# Output format
1. A short summary (max 3 lines).
2. The main deliverable (list, draft, or table).
3. "Next step:" line.`;
  const toolStep = x.tools.length
    ? `Connect or gather access to ${x.tools.join(", ")}. For v1, start copy-paste: paste content into the chat, and only add a live integration (e.g. Zapier/Make or the app's built-in AI) once outputs are reliable.`
    : "Decide what the agent reads: start by pasting content into the chat; add integrations (Zapier/Make, native app AI) only after outputs are reliable.";
  return {agent_name: name, system_prompt: system,
    checklist: [
      `Pick a home: create a Custom GPT (ChatGPT), a Claude Project, or a Gemini Gem, and name it ${name}.`,
      "Paste the system prompt above into the instructions field. Add 1-2 real examples of good output from your own work.",
      toolStep,
      "Upload reference docs (policies, past examples, price list, voice samples) as knowledge files so the agent stops guessing.",
      "Test with the 3 starter prompts on real data for 3 days, note every miss, and add a rule for each one to the prompt."],
    starter_prompts: x.starters || [
      `Here's my situation: [paste details]. Using your role, give me the first deliverable for: ${x.job}`,
      "Ask me the 2 most important questions you need answered to do this job well, then wait.",
      "Review what you produced last time and tell me 3 ways to make it faster or better."],
    meta: {engine: "heuristic (in browser)", domain: x.domain, tools: x.tools}};
}

const WHERE = "Where to paste it:\n- ChatGPT: Explore GPTs > Create > Configure > Instructions (or paste at the top of a new chat).\n- Claude: Projects > New project > Project instructions.\n- Gemini: Gems > New Gem > Instructions.";
const LIMITS = n => [
  `Not software or an automation. ${n} is a set of instructions for an AI chat app you already use. It doesn't run by itself or log into your accounts.`,
  "Not connected to your apps out of the box. You paste content in; live connections (Zapier, Make, built-in app AI) are optional.",
  "Not always right. Check anything before you send, pay, publish, or delete.",
  "Not a guarantee of income or time saved, and not legal, tax, medical, or financial advice.",
  "Needs a ChatGPT, Claude, or Gemini account (free tiers work for basic use)."];

function render(desc, r){
  const n = r.agent_name || "CustomAgent";
  $("kname").textContent = n;
  $("start").innerHTML = "";
  [`Open ChatGPT, Claude, or Gemini and create a new assistant named ${n} (steps below).`,
   "Tap Copy on the System prompt and paste it into the assistant's instructions.",
   "Tap Copy on Starter prompt 1, paste it, and add your real data.",
   "When it gets something wrong, add one line to the Rules section. Do that for 3 days."]
   .forEach(s => { const li = document.createElement("li"); li.textContent = s; $("start").appendChild(li); });
  $("sp").textContent = r.system_prompt;
  $("cl").innerHTML = ""; r.checklist.forEach(s => { const li = document.createElement("li"); li.textContent = s; $("cl").appendChild(li); });
  $("where").textContent = WHERE;
  const st = $("st"); st.innerHTML = "";
  r.starter_prompts.slice(0, 3).forEach((s, i) => {
    const c = document.createElement("div"); c.className = "starter";
    c.innerHTML = `<div class="h"><b>Starter ${i + 1}</b><button class="copy" type="button">Copy</button></div><pre></pre>`;
    c.querySelector("pre").textContent = s; c.querySelector("button").onclick = e => copy(s, e.target); st.appendChild(c);
  });
  $("lim").innerHTML = ""; LIMITS(n).forEach(s => { const li = document.createElement("li"); li.textContent = s; $("lim").appendChild(li); });
  $("meta").textContent = "Engine: " + ((r.meta && r.meta.engine) || "?");
  window.__kit = [`# ${n} - your AI assistant kit`, "", "You described: " + desc.trim(), "",
    "## System prompt (paste into instructions)", "", r.system_prompt, "",
    "## Setup checklist", ...r.checklist.map((s, i) => `${i + 1}. ${s}`), "", WHERE, "",
    "## Starter prompts", ...r.starter_prompts.slice(0, 3).map((s, i) => `${i + 1}. ${s}`), "",
    "## What this is not", ...LIMITS(n).map(s => "- " + s)].join("\n");
  $("out").hidden = false; $("out").scrollIntoView({behavior: "smooth"});
}

function copy(t, btn){
  const done = () => { const o = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(() => btn.textContent = o, 1300); };
  const fallback = () => { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.top = "-1000px";
    document.body.appendChild(a); a.select(); a.setSelectionRange(0, t.length); try { document.execCommand("copy"); } catch (e) {} a.remove(); done(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
}

async function run(desc){
  if (location.protocol.startsWith("http")) {
    try {
      const r = await fetch("api/generate", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({description: desc})});
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("json")) { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Error"); return j; }
    } catch (e) { if (e.message && !/fetch|network|load/i.test(e.message)) throw e; }
  }
  return heuristic(desc);  // static hosting: no server
}

$("f").onsubmit = async e => {
  e.preventDefault(); const desc = $("d").value.trim(); $("err").textContent = "";
  if (desc.length < 8) { $("err").textContent = "Describe your agent in at least a few words."; return; }
  $("b").disabled = true; $("b").textContent = "Building…";
  try { render(desc, await run(desc)); } catch (x) { $("err").textContent = x.message; }
  finally { $("b").disabled = false; $("b").textContent = "Build my agent"; }
};
document.querySelectorAll("[data-ex]").forEach(b => b.onclick = () => { $("d").value = b.dataset.ex; $("d").focus(); });
document.querySelectorAll("[data-copy]").forEach(btn => btn.onclick = () => {
  const id = btn.dataset.copy;
  if (id === "all") return copy(window.__kit || "", btn);
  const el = $(id); copy(el.tagName === "PRE" ? el.textContent : [...el.children].map((li, i) => (i + 1) + ". " + li.textContent).join("\n"), btn);
});
})();
