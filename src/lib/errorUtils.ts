export function getErrorMessage(err: any): string {
  if (!err) return 'An unknown error occurred.';
  
  let msg = err.message || String(err);
  
  // Obfuscate JSON-based error payloads
  // e.g. from handleFirestoreError
  try {
    const parsed = JSON.parse(msg);
    if (parsed && parsed.error) {
      if (parsed.error.includes("Missing or insufficient permissions")) {
         return "You do not have permission to perform this action.";
      }
      return parsed.error;
    }
  } catch (e) {
    // Not valid JSON, which is fine, we just fall through
  }

  // Common raw error replacements
  if (msg.includes("Missing or insufficient permissions")) {
    return "You do not have permission to perform this action.";
  }

  if (msg.includes("Failed to execute 'transaction'")) {
     return "Database transaction failed. Please try again.";
  }

  return msg;
}
