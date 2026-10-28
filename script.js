import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client@1/dist/index.min.js";

/* ============ SETTINGS ============ */
const HF_TOKEN = "";
const MAX_MB = 10;
const MAX_SIDE = 1024;            
const TIMEOUT_MS = 5 * 60 * 1000; 
const SPACES = [
  { id: "yisol/IDM-VTON",              params: () => ({}) },
  { id: "jallenjia/Change-Clothes-AI", params: cat => ({ category: cat }) }
];
/* ================================= */

const $ = id => document.getElementById(id);
const files = { person: null, garment: null };
const goBtn = $("go"), statusEl = $("status"), glass = $("glass");

function setStatus(text, kind, detail){
  statusEl.textContent = text || "";
  statusEl.className = "status" + (kind ? " " + kind : "");
  if (detail){
    const d = document.createElement("div");
    d.className = "detail"; d.textContent = detail;
    statusEl.appendChild(d);
  }
}
function refresh(){ goBtn.disabled = !(files.person && files.garment && $("consent").checked); }

/* ---------- uploads ---------- */
function bindSlot(key, inputId, dropId, clearId){
  const input = $(inputId), drop = $(dropId), clear = $(clearId), img = drop.querySelector("img");

  function accept(file){
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)){ setStatus("Use a PNG, JPG, or WebP image.", "err"); return; }
    if (file.size > MAX_MB * 1024 * 1024){ setStatus("That image is larger than " + MAX_MB + " MB. Choose a smaller one.", "err"); return; }
    files[key] = file;
    if (img.dataset.url) URL.revokeObjectURL(img.dataset.url);
    const url = URL.createObjectURL(file);
    img.dataset.url = url; img.src = url;
    drop.classList.add("has"); clear.hidden = false;
    setStatus(""); refresh();
  }

  input.addEventListener("change", () => accept(input.files[0]));
  ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { accept(e.dataTransfer.files[0]); });
  clear.addEventListener("click", () => {
    files[key] = null; input.value = ""; img.removeAttribute("src");
    drop.classList.remove("has"); clear.hidden = true; refresh();
  });
}
bindSlot("person", "person", "dropPerson", "clearPerson");
bindSlot("garment", "garment", "dropGarment", "clearGarment");
$("consent").addEventListener("change", refresh);

/* ---------- helpers ---------- */
async function shrink(file){
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.92));
  if (!blob) throw new Error("Could not read that image. Try a different file.");
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

function errText(err){
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const parts = [err.title, err.message, err.detail, err.statusText].filter(Boolean);
  if (parts.length) return parts.join(": ");
  try { return JSON.stringify(err); } catch (e) { return String(err); }
}

function hint(text){
  const t = text.toLowerCase();
  if (t.includes("quota") || t.includes("gpu") || t.includes("zerogpu"))
    return "The free GPU allowance is used up. Paste a free Hugging Face token in the token box, or try again later.";
  if (t.includes("failed to fetch") || t.includes("networkerror") || t.includes("load failed"))
    return "The browser could not reach the AI service. Check your internet connection, turn off any VPN or ad blocker, and make sure you opened the page from http://localhost and not by double-clicking the file.";
  if (t.includes("sleeping") || t.includes("building") || t.includes("runtime") || t.includes("paused") || t.includes("not found") || t.includes("404"))
    return "The AI service is asleep, restarting, or no longer available. Wait a minute and try again.";
  if (t.includes("timed out"))
    return "The service took too long. It is probably busy. Try again in a few minutes.";
  return "";
}

async function showResult(url){
  let src = url;
  try {                                  
    const blob = await (await fetch(url)).blob();
    src = URL.createObjectURL(blob);
  } catch (e) { /* keep the remote url */ }
  $("resultImg").src = src;
  glass.classList.remove("busy"); glass.classList.add("done");
  const dl = $("download"); dl.href = src; dl.hidden = false;
}

async function tryOnWith(space, person, garment, category, token){
  $("glassMsg").textContent = "Connecting to " + space.id + "…";
  const client = await Client.connect(space.id, token ? { hf_token: token } : {});
  $("glassMsg").textContent = "Waiting for a free AI worker. This can take 1 to 3 minutes.";

  const job = client.submit("/tryon", {
    dict: { background: handle_file(person), layers: [], composite: null },
    garm_img: handle_file(garment),
    garment_des: "garment",
    is_checked: true,          
    is_checked_crop: false,
    denoise_steps: 30,
    seed: 42,
    ...space.params(category)
  });

  let output = null, timedOut = false;
  const timer = setTimeout(() => { timedOut = true; try { job.cancel(); } catch (e) {} }, TIMEOUT_MS);
  try {
    for await (const msg of job){
      if (msg.type === "status" && msg.stage === "error") throw new Error(errText(msg));
      if (msg.type === "status" && msg.queue && msg.position != null)
        $("glassMsg").textContent = "Place in line: " + (msg.position + 1) + ".";
      if (msg.type === "data") output = msg.data;
    }
  } finally { clearTimeout(timer); }
  if (timedOut) throw new Error("Timed out waiting for " + space.id);

  const first = output && output[0];
  const url = typeof first === "string" ? first : first && (first.url || first.path);
  if (!url) throw new Error("No image came back from " + space.id);
  return url;
}

/* ---------- main ---------- */
goBtn.addEventListener("click", async () => {
  goBtn.disabled = true;
  $("download").hidden = true;
  glass.classList.remove("done"); glass.classList.add("busy");
  $("glassMsg").textContent = "Preparing your photos…";
  setStatus("");

  const failures = [];
  try {
    const person = await shrink(files.person);
    const garment = await shrink(files.garment);
    
    // Safely grab category element value, defaulting to 'upper_body' if missing
    const categoryEl = $("category");
    const category = categoryEl ? categoryEl.value : "upper_body";
    
    const token = ($("token")?.value || HF_TOKEN).trim();

    for (const space of SPACES){
      try {
        const url = await tryOnWith(space, person, garment, category, token);
        await showResult(url);
        setStatus("Done. Check the fit before you decide.", "ok");
        return;
      } catch (err){
        console.error("Try-on failed on " + space.id, err);
        failures.push(space.id + ": " + errText(err));
      }
    }
    throw new Error("None of the AI services worked.");
  } catch (err){
    glass.classList.remove("busy");
    $("glassMsg").textContent = "Something went wrong. Try again.";
    const all = failures.join("\n") || errText(err);
    setStatus((hint(all) || "Could not create the try-on.") + " Details below.", "err", all);
  } finally {
    refresh();
  }
});