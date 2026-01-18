// Minimal stub for sendEmail and sendBatchEmails used during development
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  console.log('sendEmail stub:', { to, subject, length: html?.length });
  return { success: true };
}

export async function sendBatchEmails(templateId: string, subject: string, contactIds: string[]) {
  console.log('sendBatchEmails stub:', { templateId, subject, contacts: contactIds.length });
  return { success: true, successCount: contactIds.length, errorCount: 0, total: contactIds.length };
}
