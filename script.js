import { Client, handle_file } from "https://cdn.jsdelivr.net/npm/@gradio/client@1/dist/index.min.js";

/* ============ SETTINGS ============
   This page runs the AI directly from the browser (HTML + JavaScript only)
   by calling a public IDM-VTON try-on Space on Hugging Face.
   - SPACE: any Gradio Space that exposes the same "/tryon" endpoint.
   - HF_TOKEN: optional. A free Hugging Face token (starts with "hf_") gives you
     a larger free GPU quota. Anything in this file is visible to visitors, so
     only use a token you are happy to share, or leave it empty. */
const SPACE = "yisol/IDM-VTON";
const HF_TOKEN = "";
const MAX_MB = 10;
/* ================================= */

const $ = id => document.getElementById(id);
const files = { person: null, garment: null };
const goBtn = $("go"), statusEl = $("status"), glass = $("glass");

function setStatus(text, kind){ statusEl.textContent = text || ""; statusEl.className = "status" + (kind ? " " + kind : ""); }

function refresh(){ goBtn.disabled = !(files.person && files.garment && $("consent").checked); }

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
  drop.addEventListener("drop", e => accept(e.dataTransfer.files[0]));
  clear.addEventListener("click", () => {
    files[key] = null; input.value = ""; img.removeAttribute("src");
    drop.classList.remove("has"); clear.hidden = true; refresh();
  });
}
bindSlot("person","person","dropPerson","clearPerson");
bindSlot("garment","garment","dropGarment","clearGarment");
$("consent").addEventListener("change", refresh);

function showResult(src){
  const out = $("resultImg");
  out.src = src;
  glass.classList.remove("busy"); glass.classList.add("done");
  const dl = $("download"); dl.href = src; dl.hidden = false;
}

goBtn.addEventListener("click", async () => {
  goBtn.disabled = true;
  $("download").hidden = true;
  glass.classList.remove("done"); glass.classList.add("busy");
  $("glassMsg").textContent = "Connecting to the AI service.";
  setStatus("");

  try {
    const client = await Client.connect(SPACE, HF_TOKEN ? { hf_token: HF_TOKEN } : {});
    $("glassMsg").textContent = "Waiting for a free AI worker. This can take 1 to 3 minutes.";

    const job = client.submit("/tryon", {
      dict: { background: handle_file(files.person), layers: [], composite: null },
      garm_img: handle_file(files.garment),
      garment_des: "garment",
      is_checked: true,        // auto-detect the clothing area
      is_checked_crop: false,
      denoise_steps: 30,
      seed: 42
    });

    let output = null;
    for await (const msg of job){
      if (msg.type === "status" && msg.stage === "error") throw new Error(msg.message || "The AI service reported an error.");
      if (msg.type === "status" && msg.queue && msg.position != null) $("glassMsg").textContent = "Place in line: " + (msg.position + 1) + ".";
      if (msg.type === "data") output = msg.data;
    }
    const img = output && output[0];
    const url = img && (img.url || img.path);
    if (!url) throw new Error("The AI service did not return an image. Try again later.");
    showResult(url);
    setStatus("Done. Check the fit before you decide.", "ok");
  } catch (err){
    glass.classList.remove("busy");
    $("glassMsg").textContent = "Something went wrong. Try again.";
    setStatus(err.message || "Could not create the try-on. Check your connection and try again.", "err");
  } finally {
    refresh();
  }
});
