const developmentJournal = (() => {
  const key = "sophia_development_journal_v1";
  const format = "sophia-development-journal";
  const types = new Set(["Proposal", "Decision", "Test result", "Release"]);
  const maxEntries = 500;
  const maxBackupBytes = 32 * 1024 * 1024;
  const field = id => document.getElementById(id);
  const form = field("developmentForm");
  const status = field("developmentStatus");
  const backupStatus = field("developmentBackupStatus");
  const fileInput = field("developmentFile");

  function validate(entries) {
    if (!Array.isArray(entries) || entries.length > maxEntries) {
      throw new Error("The journal must contain at most 500 entries.");
    }
    const ids = new Set();
    return entries.map(entry => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid journal entry.");
      const { id, type, title, notes, createdAt } = entry;
      if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id) || ids.has(id) ||
          !types.has(type) || typeof title !== "string" || !title.trim() || title.length > 160 ||
          typeof notes !== "string" || !notes.trim() || notes.length > 8000 ||
          typeof createdAt !== "string" || !Number.isFinite(Date.parse(createdAt)) ||
          new Date(createdAt).toISOString() !== createdAt) {
        throw new Error("Invalid or duplicate journal entry.");
      }
      ids.add(id);
      return { id, type, title, notes, createdAt };
    });
  }

  function read() {
    return validate(JSON.parse(localStorage.getItem(key) ?? "[]"));
  }

  function write(entries) {
    localStorage.setItem(key, JSON.stringify(validate(entries)));
  }

  function render() {
    const list = field("developmentList");
    list.replaceChildren();
    let entries;
    try {
      entries = read();
    } catch {
      list.textContent = "The saved journal could not be read.";
      return;
    }
    if (!entries.length) list.textContent = "No development entries yet.";
    for (const entry of entries) {
      const article = document.createElement("article");
      article.className = "list-item";
      const content = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = entry.title;
      const details = document.createElement("p");
      details.textContent = entry.type + " · " + new Date(entry.createdAt).toLocaleString();
      const notes = document.createElement("p");
      notes.textContent = entry.notes;
      notes.style.whiteSpace = "pre-wrap";
      content.append(heading, details, notes);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "soft-button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + entry.title);
      remove.onclick = () => {
        if (!confirm("Remove this development entry from this browser?")) return;
        try {
          write(read().filter(item => item.id !== entry.id));
          render();
          status.textContent = "Entry removed.";
        } catch {
          status.textContent = "Could not remove the entry.";
        }
      };
      article.append(content, remove);
      list.append(article);
    }
  }

  form.onsubmit = event => {
    event.preventDefault();
    try {
      const entry = {
        id: crypto.randomUUID(),
        type: field("developmentKind").value,
        title: field("developmentTitle").value.trim(),
        notes: field("developmentNotes").value.trim(),
        createdAt: new Date().toISOString()
      };
      write([entry, ...read()]);
      form.reset();
      render();
      status.textContent = "Entry saved in this browser.";
    } catch (error) {
      status.textContent = "Could not save the entry. " + error.message;
    }
  };

  field("developmentExport").onclick = () => {
    try {
      const backup = { format, version: 1, entries: read() };
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "sophia-development-journal-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      backupStatus.textContent = "Journal download requested.";
    } catch {
      backupStatus.textContent = "Could not export the journal.";
    }
  };

  field("developmentImport").onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      if (file.size > maxBackupBytes) throw new Error("Backup file is too large.");
      const backup = JSON.parse(await file.text());
      if (backup?.format !== format || backup.version !== 1) throw new Error("Choose a Sophia development journal backup.");
      const incoming = validate(backup.entries);
      const current = read();
      const known = new Map(current.map(entry => [entry.id, entry]));
      const additions = incoming.filter(entry => {
        const existing = known.get(entry.id);
        if (!existing) return true;
        if (JSON.stringify(existing) !== JSON.stringify(entry)) {
          throw new Error("A backup entry conflicts with an existing entry.");
        }
        return false;
      });
      if (additions.length) {
        const merged = [...current, ...additions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        write(merged);
      }
      render();
      backupStatus.textContent = "Added " + additions.length + " development entries.";
    } catch (error) {
      backupStatus.textContent = "Could not import the journal. " + error.message;
    }
  };

  window.addEventListener("storage", event => {
    if (event.key === key || event.key === null) render();
  });
  return { render };
})();

function renderDevelopmentJournal() {
  developmentJournal.render();
}
