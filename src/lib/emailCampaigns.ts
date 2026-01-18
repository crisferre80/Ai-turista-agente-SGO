// Minimal CSV helpers for contacts
export async function importContactsFromCSV(csv: string) {
  // Very naive CSV parsing (expects email,name lines)
  const lines = csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const contacts = lines.map(line => {
    const [email, name] = line.split(',').map(s => s && s.trim());
    return { email, name: name || null };
  });
  return { imported: contacts.length, contacts };
}

export async function exportContactsToCSV() {
  // Placeholder: produce a minimal CSV from an empty set
  return 'email,name\nexample@domain.com,Usuario Ejemplo';
}
